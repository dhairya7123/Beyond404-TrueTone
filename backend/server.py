import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

import asyncio
import json
import random
import uuid
from datetime import datetime
from collections import deque
from typing import Dict, Set, Optional
import numpy as np
import librosa
from aiohttp import web, WSMsgType
from aiortc import RTCPeerConnection, RTCSessionDescription
import onnxruntime as ort

from forensics import ZERO_HASH, generate_block, export_certificate, save_certificate
from generate_pdf import generate_pdf
import database

HOST = "0.0.0.0"
PORT = 8080
MODEL_PATH = "model.onnx"

try:
    session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
    print(f"[INFO] Loaded {MODEL_PATH} successfully.")
except Exception as e:
    print(f"[WARNING] Could not load {MODEL_PATH}: {e}")
    session = None

TARGET_SAMPLES = 48000

# Active WebRTC PeerConnections and background tasks
active_pcs: Dict[str, RTCPeerConnection] = {}
active_pc_tasks: Dict[str, asyncio.Task] = {}

# Simulation settings per PC session
simulation_settings: Dict[str, dict] = {}
DEFAULT_SIM_SETTINGS = {
    "packet_loss": 0.05,
    "jitter_ms": 30,
    "noise_level": 0.0,
    "codec": "Opus (Default 16kHz)"
}

# Active WebSocket connections
ws_clients: Set[web.WebSocketResponse] = set()
user_sockets: Dict[int, Set[web.WebSocketResponse]] = {}
socket_to_user: Dict[web.WebSocketResponse, int] = {}
active_calls: Dict[str, dict] = {}
latest_certificate = {}

async def apply_network_impairment(pcm_bytes: bytes, pc_id: str):
    settings = simulation_settings.get(pc_id, DEFAULT_SIM_SETTINGS)
    loss_rate = float(settings.get("packet_loss", 0.05))
    jitter_ms = int(settings.get("jitter_ms", 30))
    noise_level = float(settings.get("noise_level", 0.0))

    # 1. Packet loss simulation
    if loss_rate > 0 and random.random() < loss_rate:
        return None, {
            "plc_active": True,
            "loss_rate": round(loss_rate * 100, 1),
            "jitter": jitter_ms,
            "noise_level": round(noise_level * 100, 1)
        }

    # 2. Variable Jitter delay simulation
    if jitter_ms > 0:
        actual_delay = max(0.0, random.gauss(jitter_ms / 1000.0, (jitter_ms * 0.3) / 1000.0))
        await asyncio.sleep(actual_delay)

    # 3. Additive Environmental Noise Simulation
    if noise_level > 0.0:
        samples = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32)
        noise = np.random.normal(0, noise_level * 1500.0, size=samples.shape).astype(np.float32)
        noisy_samples = np.clip(samples + noise, -32768, 32767).astype(np.int16)
        pcm_bytes = noisy_samples.tobytes()

    return pcm_bytes, {
        "plc_active": False,
        "loss_rate": round(loss_rate * 100, 1),
        "jitter": jitter_ms,
        "noise_level": round(noise_level * 100, 1)
    }

def extract_mel_spectrogram(audio_np):
    if len(audio_np) < TARGET_SAMPLES:
        audio_np = np.pad(audio_np, (0, TARGET_SAMPLES - len(audio_np)), mode="constant")
    else:
        audio_np = audio_np[:TARGET_SAMPLES]

    mel = librosa.feature.melspectrogram(
        y=audio_np, sr=16000, n_fft=1024, hop_length=512, n_mels=128, fmin=20.0, fmax=8000.0, power=2.0
    )
    log_mel = librosa.power_to_db(mel, ref=np.max, top_db=80.0)
    norm_mel = (log_mel - np.mean(log_mel)) / (np.std(log_mel) + 1e-6)
    return np.expand_dims(norm_mel, axis=(0, 1)).astype(np.float32)

def run_inference(input_tensor):
    if session is None:
        return random.uniform(0.1, 0.8)
    outputs = session.run(None, {"mel_spectrogram": input_tensor})
    return float(outputs[1][0, 1])

def calibrate_score(raw_score, telemetry):
    score = raw_score * 0.85 if (telemetry["plc_active"] or telemetry["loss_rate"] > 10.0) else raw_score
    tier = "GREEN (Low Risk)" if score < 0.34 else ("ORANGE (Medium Risk)" if score <= 0.67 else "RED (High Risk)")
    return score, tier

async def broadcast_telemetry(payload):
    if not ws_clients:
        return
    message = json.dumps(payload)
    for ws in list(ws_clients):
        try:
            await ws.send_str(message)
        except Exception:
            ws_clients.discard(ws)

async def send_to_user(user_id: int, payload: dict):
    sockets = user_sockets.get(user_id, set())
    if not sockets:
        return False
    msg = json.dumps(payload)
    alive = set()
    for ws in sockets:
        try:
            await ws.send_str(msg)
            alive.add(ws)
        except Exception:
            pass
    user_sockets[user_id] = alive
    return len(alive) > 0

async def call_timeout_worker(call_id: str, caller: dict, callee: dict):
    try:
        await asyncio.sleep(25)
        if call_id in active_calls and active_calls[call_id]["status"] == "ringing":
            print(f"[CALL] Call {call_id} timed out without answer. Auto-cutting call.")
            active_calls[call_id]["status"] = "missed"
            payload = {
                "type": "call_timeout",
                "call_id": call_id,
                "message": "Call timed out. No answer."
            }
            if caller.get("id"):
                await send_to_user(caller["id"], payload)
            if callee.get("id"):
                await send_to_user(callee["id"], payload)

            try:
                await database.record_call_activity(
                    caller_id=caller.get("id"),
                    caller_name=caller.get("name", "Unknown"),
                    caller_phone=caller.get("phone", ""),
                    callee_id=callee.get("id"),
                    callee_name=callee.get("name", "Unknown"),
                    callee_phone=callee.get("phone", ""),
                    status="missed",
                    duration=0,
                    fraud_score=0,
                    risk_tier="Low Risk",
                    flagged=False
                )
            except Exception as dbe:
                print(f"[DB ERROR] Missed call log failed: {dbe}")
    except asyncio.CancelledError:
        pass

async def close_pc_session(pc_id: str):
    if pc_id in active_pc_tasks:
        task = active_pc_tasks.pop(pc_id)
        if not task.done():
            task.cancel()
            print(f"[WEBRTC] Cancelled audio track processor task for session {pc_id}")

    if pc_id in active_pcs:
        pc = active_pcs.pop(pc_id)
        try:
            await pc.close()
            print(f"[WEBRTC] Closed RTCPeerConnection for session {pc_id}")
        except Exception as e:
            print(f"[WEBRTC WARNING] Error closing PC {pc_id}: {e}")

    simulation_settings.pop(pc_id, None)

async def process_audio_track(track, pc_id: str):
    global latest_certificate
    print(f"[WEBRTC] Audio stream processing started for session {pc_id}!")
    forensic_chain = []
    previous_hash = ZERO_HASH
    frame_counter = 0
    audio_buf = deque(maxlen=TARGET_SAMPLES)

    try:
        while True:
            if pc_id not in active_pcs:
                print(f"[WEBRTC] Session {pc_id} has ended. Stopping audio frame consumption.")
                break

            try:
                frame = await asyncio.wait_for(track.recv(), timeout=3.0)
            except asyncio.TimeoutError:
                if pc_id not in active_pcs:
                    break
                continue
            except Exception as recv_err:
                print(f"[WEBRTC] Track ended or closed for {pc_id}: {recv_err}")
                break

            pcm_bytes = frame.to_ndarray().tobytes()
            if len(pcm_bytes) == 0:
                continue

            impaired_bytes, telemetry = await apply_network_impairment(pcm_bytes, pc_id)
            if impaired_bytes is None:
                continue

            samples = np.frombuffer(impaired_bytes, dtype=np.int16).astype(np.float32) / 32768.0
            audio_buf.extend(samples)

            if len(audio_buf) >= 16000:
                current_audio = np.array(audio_buf, dtype=np.float32)
                input_tensor = extract_mel_spectrogram(current_audio)
                raw_score = run_inference(input_tensor)
                score, tier = calibrate_score(raw_score, telemetry)

                previous_hash, entry = generate_block(
                    prev_hash=previous_hash,
                    timestamp=datetime.now().isoformat(),
                    score=round(score, 4),
                    risk_tier=tier,
                    telemetry=telemetry,
                    audio_frame=impaired_bytes[:512],
                    frame_index=frame_counter
                )
                forensic_chain.append(entry)
                frame_counter += 1

                telemetry_payload = {
                    "type": "telemetry",
                    "sessionId": pc_id,
                    "timestamp": entry["timestamp"],
                    "score": entry["score"],
                    "risk_tier": entry["risk_tier"],
                    "packet_loss": telemetry["loss_rate"],
                    "jitter": telemetry["jitter"],
                    "noise_level": telemetry["noise_level"],
                    "plc_active": telemetry["plc_active"],
                    "current_hash": previous_hash
                }
                asyncio.create_task(broadcast_telemetry(telemetry_payload))
                print(f"[RESULT #{frame_counter} | {pc_id[:8]}] Score: {score:.2f} | Risk: {tier} | Loss: {telemetry['loss_rate']}% | Jitter: {telemetry['jitter']}ms")

    except asyncio.CancelledError:
        print(f"[WEBRTC] Audio track loop explicitly cancelled for {pc_id}.")
    except Exception as e:
        print(f"[WEBRTC] Stream loop finished for {pc_id}: {e}")
    finally:
        print(f"[WEBRTC] Audio processing completely terminated for session {pc_id}.")
        if forensic_chain:
            latest_certificate = export_certificate(forensic_chain)
            json_path = save_certificate(latest_certificate, filename="forensic_certificate.json")
            try:
                generate_pdf(certificate_file="forensic_certificate.json", output_file="forensic_certificate.pdf")
            except Exception as pe:
                print(f"[PDF] Could not generate PDF certificate: {pe}")
            print(f"[FORENSIC] Session certificate saved: {json_path}")

# -----------------------------------------------------------------------------
# CORS Middleware
# -----------------------------------------------------------------------------
@web.middleware
async def cors_middleware(request, handler):
    if request.method == "OPTIONS":
        response = web.Response(status=200)
    else:
        try:
            response = await handler(request)
        except web.HTTPException as ex:
            response = ex
        except Exception as ex:
            response = web.json_response({"success": False, "error": str(ex)}, status=500)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    return response

# -----------------------------------------------------------------------------
# HTTP & WebSocket Handlers
# -----------------------------------------------------------------------------
async def websocket_handler(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    ws_clients.add(ws)

    user_id_param = request.query.get("userId")
    if user_id_param and user_id_param.isdigit():
        uid = int(user_id_param)
        user_sockets.setdefault(uid, set()).add(ws)
        socket_to_user[ws] = uid
        print(f"[WEBSOCKET] Registered user #{uid} on socket connection.")

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                except Exception:
                    continue

                msg_type = data.get("type")

                # User registration
                if msg_type == "register":
                    uid = data.get("userId")
                    if uid:
                        uid = int(uid)
                        user_sockets.setdefault(uid, set()).add(ws)
                        socket_to_user[ws] = uid
                        await ws.send_str(json.dumps({"type": "registered", "userId": uid}))

                # Dynamic Simulation Parameter Adjustment
                elif msg_type == "update_simulation":
                    pc_id = data.get("sessionId")
                    if pc_id:
                        curr = simulation_settings.setdefault(pc_id, dict(DEFAULT_SIM_SETTINGS))
                        if "packet_loss" in data:
                            curr["packet_loss"] = float(data["packet_loss"]) / 100.0
                        if "jitter_ms" in data:
                            curr["jitter_ms"] = int(data["jitter_ms"])
                        if "noise_level" in data:
                            curr["noise_level"] = float(data["noise_level"]) / 100.0
                        if "codec" in data:
                            curr["codec"] = str(data["codec"])
                        print(f"[SIMULATION UPDATE] Session {pc_id[:8]} => Loss: {curr['packet_loss']*100}%, Jitter: {curr['jitter_ms']}ms, Noise: {curr.get('noise_level',0)*100}%")

                # Call initiation
                elif msg_type == "call_request":
                    call_id = data.get("call_id") or f"call_{int(datetime.now().timestamp()*1000)}"
                    caller = data.get("caller", {})
                    callee = data.get("callee", {})
                    callee_id = callee.get("id")

                    print(f"[CALL] {caller.get('name')} is calling {callee.get('name')} (ID #{callee_id})")
                    callee_sockets = user_sockets.get(callee_id, set())
                    is_online = len(callee_sockets) > 0

                    timeout_task = asyncio.create_task(call_timeout_worker(call_id, caller, callee))
                    active_calls[call_id] = {
                        "caller": caller,
                        "callee": callee,
                        "status": "ringing",
                        "started_at": datetime.now(),
                        "timeout_task": timeout_task,
                        "online": is_online
                    }

                    if not is_online:
                        await ws.send_str(json.dumps({
                            "type": "callee_offline",
                            "call_id": call_id,
                            "callee": callee,
                            "message": f"{callee.get('name')} is not currently active on another device."
                        }))
                    else:
                        await send_to_user(callee_id, {
                            "type": "incoming_call",
                            "call_id": call_id,
                            "caller": caller
                        })
                        await ws.send_str(json.dumps({
                            "type": "call_ringing",
                            "call_id": call_id,
                            "callee": callee
                        }))

                # Callee answers call
                elif msg_type == "call_accept":
                    call_id = data.get("call_id")
                    if call_id in active_calls:
                        cinfo = active_calls[call_id]
                        cinfo["status"] = "in_progress"
                        if cinfo.get("timeout_task"):
                            cinfo["timeout_task"].cancel()

                        caller_id = cinfo["caller"].get("id")
                        print(f"[CALL] Call {call_id} accepted by callee.")
                        if caller_id:
                            await send_to_user(caller_id, {
                                "type": "call_accepted",
                                "call_id": call_id
                            })

                # Callee declines call
                elif msg_type == "call_decline":
                    call_id = data.get("call_id")
                    if call_id in active_calls:
                        cinfo = active_calls[call_id]
                        cinfo["status"] = "declined"
                        if cinfo.get("timeout_task"):
                            cinfo["timeout_task"].cancel()

                        caller = cinfo["caller"]
                        callee = cinfo["callee"]
                        caller_id = caller.get("id")
                        print(f"[CALL] Call {call_id} declined by callee.")
                        if caller_id:
                            await send_to_user(caller_id, {
                                "type": "call_declined",
                                "call_id": call_id
                            })

                        try:
                            await database.record_call_activity(
                                caller_id=caller.get("id"),
                                caller_name=caller.get("name", "Unknown"),
                                caller_phone=caller.get("phone", ""),
                                callee_id=callee.get("id"),
                                callee_name=callee.get("name", "Unknown"),
                                callee_phone=callee.get("phone", ""),
                                status="declined",
                                duration=0,
                                fraud_score=0,
                                risk_tier="Low Risk",
                                flagged=False
                            )
                        except Exception as dbe:
                            print(f"[DB ERROR] Declined call log failed: {dbe}")

                # Either party ends call
                elif msg_type == "call_end":
                    call_id = data.get("call_id")
                    duration = int(data.get("duration", 0))
                    score = int(data.get("score", 20))
                    risk_tier = data.get("risk_tier", "Low Risk")

                    if call_id in active_calls:
                        cinfo = active_calls[call_id]
                        cinfo["status"] = "ended"
                        if cinfo.get("timeout_task"):
                            cinfo["timeout_task"].cancel()

                        caller = cinfo["caller"]
                        callee = cinfo["callee"]

                        notify_payload = {"type": "call_ended", "call_id": call_id}
                        if caller.get("id"):
                            await send_to_user(caller["id"], notify_payload)
                        if callee.get("id"):
                            await send_to_user(callee["id"], notify_payload)

                        try:
                            flagged = score >= 50
                            await database.record_call_activity(
                                caller_id=caller.get("id"),
                                caller_name=caller.get("name", "Unknown"),
                                caller_phone=caller.get("phone", ""),
                                callee_id=callee.get("id"),
                                callee_name=callee.get("name", "Unknown"),
                                callee_phone=callee.get("phone", ""),
                                status="completed",
                                duration=duration,
                                fraud_score=score,
                                risk_tier=risk_tier,
                                flagged=flagged
                            )
                            print(f"[CALL] Saved call {call_id} to Supabase: duration={duration}s, score={score}%, flagged={flagged}")
                        except Exception as dbe:
                            print(f"[DB ERROR] Completed call log failed: {dbe}")

                        del active_calls[call_id]

            elif msg.type == WSMsgType.CLOSE:
                break
    finally:
        ws_clients.discard(ws)
        uid = socket_to_user.pop(ws, None)
        if uid and uid in user_sockets:
            user_sockets[uid].discard(ws)
            if not user_sockets[uid]:
                del user_sockets[uid]
        print(f"[WEBSOCKET] Client disconnected (User #{uid}).")
    return ws

async def export_certificate_handler(request):
    cert_path = BASE_DIR / "forensic_certificate.json"
    data = latest_certificate
    if not data and cert_path.exists():
        try:
            with open(cert_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            pass

    if not data:
        return web.json_response({"error": "No session certificate available yet."}, status=404)

    return web.json_response(
        data,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Content-Disposition": "attachment; filename=forensic_certificate.json"
        }
    )

async def export_pdf_handler(request):
    cert_path = BASE_DIR / "forensic_certificate.json"
    pdf_path = BASE_DIR / "forensic_certificate.pdf"

    if not cert_path.exists() and not latest_certificate:
        return web.json_response({"error": "No session certificate available to generate PDF."}, status=404)

    try:
        if latest_certificate:
            save_certificate(latest_certificate, filename="forensic_certificate.json")
        generate_pdf(certificate_file="forensic_certificate.json", output_file="forensic_certificate.pdf")
        if pdf_path.exists():
            return web.FileResponse(
                pdf_path,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Disposition": "attachment; filename=forensic_certificate.pdf"
                }
            )
    except Exception as e:
        return web.json_response({"error": f"Failed to generate PDF: {e}"}, status=500)

    return web.json_response({"error": "PDF file not found."}, status=404)

async def offer(request):
    params = await request.json()
    pc_id = params.get("sessionId") or f"session_{uuid.uuid4().hex[:12]}"
    
    initial_sim = {
        "packet_loss": float(params.get("packetLoss", 5)) / 100.0,
        "jitter_ms": int(params.get("jitter", 30)),
        "noise_level": float(params.get("noiseLevel", 0)) / 100.0,
        "codec": params.get("codec", "Opus (Default 16kHz)")
    }
    simulation_settings[pc_id] = initial_sim

    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])
    pc = RTCPeerConnection()
    active_pcs[pc_id] = pc

    @pc.on("track")
    def on_track(track):
        if track.kind == "audio":
            task = asyncio.create_task(process_audio_track(track, pc_id))
            active_pc_tasks[pc_id] = task

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        print(f"[WEBRTC] PC {pc_id} connection state changed to: {pc.connectionState}")
        if pc.connectionState in ["closed", "failed", "disconnected"]:
            await close_pc_session(pc_id)

    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return web.Response(
        content_type="application/json",
        text=json.dumps({
            "sdp": pc.localDescription.sdp,
            "type": pc.localDescription.type,
            "sessionId": pc_id
        }),
        headers={"Access-Control-Allow-Origin": "*"}
    )

async def hangup_handler(request):
    try:
        data = await request.json()
    except Exception:
        data = {}

    pc_id = data.get("sessionId")
    if pc_id:
        await close_pc_session(pc_id)
        return web.json_response({"success": True, "message": f"Session {pc_id} terminated."})
    
    for pid in list(active_pcs.keys()):
        await close_pc_session(pid)

    return web.json_response({"success": True, "message": "All active WebRTC sessions terminated."})

async def simulation_handler(request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"success": False, "error": "Invalid JSON"}, status=400)

    pc_id = data.get("sessionId")
    if pc_id and pc_id in simulation_settings:
        curr = simulation_settings[pc_id]
        if "packetLoss" in data:
            curr["packet_loss"] = float(data["packetLoss"]) / 100.0
        if "jitter" in data:
            curr["jitter_ms"] = int(data["jitter"])
        if "noiseLevel" in data:
            curr["noise_level"] = float(data["noiseLevel"]) / 100.0
        if "codec" in data:
            curr["codec"] = str(data["codec"])

        return web.json_response({
            "success": True,
            "sessionId": pc_id,
            "settings": {
                "packet_loss": curr["packet_loss"] * 100,
                "jitter_ms": curr["jitter_ms"],
                "noise_level": curr.get("noise_level", 0) * 100,
                "codec": curr["codec"]
            }
        })

    return web.json_response({"success": False, "error": "Session not found"}, status=404)

# -----------------------------------------------------------------------------
# User Authentication & Platform User Handlers (Supabase DB)
# -----------------------------------------------------------------------------
async def register_handler(request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"success": False, "error": "Invalid JSON body"}, status=400)

    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    phone = data.get("phone", "").strip()
    password = data.get("password", "").strip()
    role = data.get("role", "Analyst").strip() or "Analyst"
    tag = data.get("tag", "Personal").strip() or "Personal"

    if not name or not email or not phone or not password:
        return web.json_response(
            {"success": False, "error": "Name, email, phone, and password are required."},
            status=400
        )

    try:
        user = await database.create_user(name, email, phone, password, role, tag)
        return web.json_response({"success": True, "user": user}, status=201)
    except Exception as e:
        err_msg = str(e)
        if "unique constraint" in err_msg.lower():
            return web.json_response(
                {"success": False, "error": "A user with this email or phone already exists."},
                status=409
            )
        return web.json_response({"success": False, "error": f"Registration failed: {err_msg}"}, status=500)

async def login_handler(request):
    try:
        data = await request.json()
    except Exception:
        return web.json_response({"success": False, "error": "Invalid JSON body"}, status=400)

    identifier = data.get("identifier", "").strip()
    password = data.get("password", "").strip()

    if not identifier or not password:
        return web.json_response(
            {"success": False, "error": "Identifier (email or phone) and password are required."},
            status=400
        )

    user = await database.authenticate_user(identifier, password)
    if not user:
        return web.json_response(
            {"success": False, "error": "Invalid email/phone or password."},
            status=401
        )

    return web.json_response({"success": True, "user": user})

async def get_users_handler(request):
    try:
        users = await database.get_all_users()
        return web.json_response({"success": True, "users": users})
    except Exception as e:
        return web.json_response({"success": False, "error": f"Failed to fetch users: {e}"}, status=500)

# -----------------------------------------------------------------------------
# Activity & Call Records (Supabase DB)
# -----------------------------------------------------------------------------
async def get_activity_handler(request):
    user_id_param = request.query.get("userId")
    if not user_id_param or not user_id_param.isdigit():
        return web.json_response({"success": False, "error": "userId query parameter required"}, status=400)

    uid = int(user_id_param)
    try:
        activities = await database.get_user_activities(uid)
        return web.json_response({"success": True, "activities": activities})
    except Exception as e:
        return web.json_response({"success": False, "error": f"Failed to fetch activities: {e}"}, status=500)

async def post_activity_handler(request):
    try:
        data = await request.json()
        rec = await database.record_call_activity(
            caller_id=data.get("caller_id"),
            caller_name=data.get("caller_name", "Unknown"),
            caller_phone=data.get("caller_phone", ""),
            callee_id=data.get("callee_id"),
            callee_name=data.get("callee_name", "Unknown"),
            callee_phone=data.get("callee_phone", ""),
            status=data.get("status", "completed"),
            duration=int(data.get("duration", 0)),
            fraud_score=int(data.get("fraud_score", 0)),
            risk_tier=data.get("risk_tier", "Low Risk"),
            flagged=bool(data.get("flagged", False))
        )
        return web.json_response({"success": True, "activity": rec}, status=201)
    except Exception as e:
        return web.json_response({"success": False, "error": f"Failed to record activity: {e}"}, status=500)

async def me_handler(request):
    return web.json_response({
        "status": "online",
        "service": "Beyond404 Voice Forensics Gateway",
        "active_sessions": len(active_pcs),
        "timestamp": datetime.now().isoformat()
    })

async def on_startup(app):
    try:
        await database.init_db()
        print("[DATABASE] Supabase PostgreSQL connected and user/activity store verified.")
    except Exception as e:
        print(f"[DATABASE WARNING] Could not connect to Supabase: {e}")

async def on_shutdown(app):
    print("[SERVER] Shutting down WebRTC sessions...")
    for pid in list(active_pcs.keys()):
        await close_pc_session(pid)

def create_app():
    app = web.Application(middlewares=[cors_middleware])
    app.on_startup.append(on_startup)
    app.on_shutdown.append(on_shutdown)

    # User & Auth routes
    app.router.add_post("/api/register", register_handler)
    app.router.add_post("/api/login", login_handler)
    app.router.add_get("/api/users", get_users_handler)
    app.router.add_get("/api/me", me_handler)

    # Activity & Call logs (Supabase)
    app.router.add_get("/api/activity", get_activity_handler)
    app.router.add_post("/api/activity", post_activity_handler)

    # WebRTC & Telemetry routes
    app.router.add_post("/offer", offer)
    app.router.add_post("/hangup", hangup_handler)
    app.router.add_post("/api/simulation", simulation_handler)
    app.router.add_get("/ws", websocket_handler)
    app.router.add_get("/export-certificate", export_certificate_handler)
    app.router.add_get("/export-pdf", export_pdf_handler)

    return app

if __name__ == "__main__":
    app = create_app()
    print("==================================================")
    print("  Beyond404 Gateway + Supabase + WebRTC (Port 8080)")
    print("==================================================")
    web.run_app(app, host=HOST, port=PORT)
