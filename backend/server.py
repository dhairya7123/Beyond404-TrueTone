import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

import asyncio
import json
import random
import time
import uuid
from datetime import datetime
from collections import deque
from typing import Dict, Set, Optional
import numpy as np
import librosa
from aiohttp import web, WSMsgType
from aiortc import RTCPeerConnection, RTCSessionDescription
import onnxruntime as ort

from logger import setup_logging, get_logger, log_audit_event, APP_LOG_FILE, AUDIT_LOG_FILE
from forensics import ZERO_HASH, generate_block, export_certificate, save_certificate
from generate_pdf import generate_pdf
import database
import io
import base64
from forensic_visualizer import compute_forensic_indicators, generate_mel_forensic_plot
from local_model import local_model

# Initialize central logging
setup_logging()
logger = get_logger("Gateway")
webrtc_log = get_logger("WebRTC")
forensic_log = get_logger("Forensics")
ws_log = get_logger("Signaling")
http_log = get_logger("HTTP")

HOST = "0.0.0.0"
PORT = 8080
MODEL_PATH = str(BASE_DIR / "model.onnx")
LOCAL_MODEL_DIR = str(BASE_DIR / "local_model")

# Keep original ONNX model preserved in the codebase
try:
    logger.info("Verifying original ONNX model presence at %s...", MODEL_PATH)
    session = ort.InferenceSession(MODEL_PATH, providers=["CPUExecutionProvider"])
    logger.info("Preserved original ONNX model verified at %s.", MODEL_PATH)
except Exception as e:
    logger.warning("Could not initialize ONNX session for %s: %s", MODEL_PATH, e)
    session = None

# Active Inference Engine: Pretrained Wav2Vec2 named as 'local_model'
logger.info("Active inference engine: 'local_model' (Pretrained Wav2Vec2) from %s", LOCAL_MODEL_DIR)

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

def run_inference(audio_or_tensor):
    """
    Primary inference call: evaluates synthetic score using local_model (Pretrained Wav2Vec2).
    Compatible with raw audio numpy waveforms as well as tensor inputs.
    """
    return local_model.run_inference(audio_or_tensor)

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

def get_user_sockets(user_id):
    if user_id is None:
        return set()
    keys = {user_id, str(user_id)}
    try:
        keys.add(int(user_id))
    except (ValueError, TypeError):
        pass
    alive = set()
    for k in keys:
        if k in user_sockets:
            for ws in list(user_sockets[k]):
                if not ws.closed:
                    alive.add(ws)
                else:
                    user_sockets[k].discard(ws)
    return alive

async def send_to_user(user_id, payload: dict):
    sockets = get_user_sockets(user_id)
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
    return len(alive) > 0

async def call_timeout_worker(call_id: str, caller: dict, callee: dict):
    try:
        await asyncio.sleep(25)
        if call_id in active_calls and active_calls[call_id]["status"] == "ringing":
            ws_log.warning("Call %s timed out after 25s without answer. Auto-cutting call.", call_id)
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
                logger.error("Missed call DB logging failed: %s", dbe)
    except asyncio.CancelledError:
        pass

async def close_pc_session(pc_id: str):
    if pc_id in active_pc_tasks:
        task = active_pc_tasks.pop(pc_id)
        if not task.done():
            task.cancel()
            webrtc_log.info("Cancelled audio processor task for session %s", pc_id)

    if pc_id in active_pcs:
        pc = active_pcs.pop(pc_id)
        try:
            await pc.close()
            webrtc_log.info("Closed RTCPeerConnection for session %s", pc_id)
        except Exception as e:
            webrtc_log.warning("Error closing PC %s: %s", pc_id, e)

    simulation_settings.pop(pc_id, None)

async def process_audio_track(track, pc_id: str):
    global latest_certificate
    webrtc_log.info("Audio stream ingestion started for session %s (16kHz Opus mono)", pc_id)
    forensic_chain = []
    previous_hash = ZERO_HASH
    frame_counter = 0
    audio_buf = deque(maxlen=TARGET_SAMPLES)

    try:
        while True:
            if pc_id not in active_pcs:
                webrtc_log.info("Session %s has ended. Halting frame consumption.", pc_id)
                break

            try:
                frame = await asyncio.wait_for(track.recv(), timeout=3.0)
            except asyncio.TimeoutError:
                if pc_id not in active_pcs:
                    break
                continue
            except Exception as recv_err:
                webrtc_log.info("Audio track closed for session %s: %s", pc_id, recv_err)
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

                # Primary inference using local_model (Pretrained Wav2Vec2)
                pred_result = local_model.predict(current_audio, sr=16000)
                raw_score = pred_result["score"]
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

                # Calculate real-time Mel spectrogram reasons & forensic indicators
                analysis = compute_forensic_indicators(current_audio, sr=16000, model_score=score)
                if "classification" in pred_result:
                    analysis["classification"] = pred_result["classification"]
                    analysis["confidence"] = pred_result["confidence"]

                telemetry_payload = {
                    "type": "telemetry",
                    "sessionId": pc_id,
                    "timestamp": entry["timestamp"],
                    "score": entry["score"],
                    "overall_risk_score": analysis["overall_risk_score"],
                    "risk_tier": entry["risk_tier"],
                    "risk_level": analysis["risk_level"],
                    "classification": analysis["classification"],
                    "confidence": analysis["confidence"],
                    "indicators": analysis["indicators"],
                    "key_flags": analysis["key_flags"],
                    "packet_loss": telemetry["loss_rate"],
                    "jitter": telemetry["jitter"],
                    "noise_level": telemetry["noise_level"],
                    "plc_active": telemetry["plc_active"],
                    "current_hash": previous_hash,
                    "model_engine": "local_model (Wav2Vec2 Pretrained)"
                }
                asyncio.create_task(broadcast_telemetry(telemetry_payload))

                forensic_log.info(
                    "Block #%04d | Sess: %s | Score: %5.1f%% (%s) | Vocoder: %4.1f%% | Silence: %4.1f%% | Hash: %s... | Engine: local_model",
                    frame_counter,
                    pc_id[:8],
                    analysis["overall_risk_score"],
                    analysis["risk_level"],
                    analysis["indicators"].get("Vocoder", 0),
                    analysis["indicators"].get("Dead Silence", 0),
                    previous_hash[:12]
                )

    except asyncio.CancelledError:
        webrtc_log.info("Audio track loop cancelled for %s.", pc_id)
    except Exception as e:
        webrtc_log.error("Stream loop exception for %s: %s", pc_id, e)
    finally:
        webrtc_log.info("Audio processing finalized for session %s (Total blocks: %d)", pc_id, len(forensic_chain))
        if forensic_chain:
            latest_certificate = export_certificate(forensic_chain)
            json_path = save_certificate(latest_certificate, filename="forensic_certificate.json")
            try:
                generate_pdf(certificate_file="forensic_certificate.json", output_file="forensic_certificate.pdf")
                forensic_log.info("Generated PDF forensic certificate: forensic_certificate.pdf")
            except Exception as pe:
                forensic_log.error("Could not generate PDF certificate: %s", pe)
            forensic_log.info("Forensic session certificate saved: %s", json_path)
            log_audit_event("FORENSIC_CERTIFICATE_SAVED", {
                "sessionId": pc_id,
                "blocks_count": len(forensic_chain),
                "terminal_hash": previous_hash,
                "certificate_path": str(json_path)
            })

# -----------------------------------------------------------------------------
# HTTP Middlewares (CORS + Request Logging)
# -----------------------------------------------------------------------------
@web.middleware
async def request_logging_middleware(request, handler):
    start_time = time.time()
    client_ip = request.remote or "unknown"
    path = request.path_qs

    try:
        response = await handler(request)
        duration_ms = (time.time() - start_time) * 1000
        # Don't log spammy ws pings
        if not path.startswith("/ws"):
            http_log.info("%s %s -> %d (%.1fms, %s)", request.method, path, response.status, duration_ms, client_ip)
        return response
    except web.HTTPException as ex:
        duration_ms = (time.time() - start_time) * 1000
        http_log.warning("%s %s -> %d (%.1fms, %s)", request.method, path, ex.status, duration_ms, client_ip)
        raise
    except Exception as ex:
        duration_ms = (time.time() - start_time) * 1000
        http_log.error("Unhandled error on %s %s (%.1fms, %s): %s", request.method, path, duration_ms, client_ip, ex)
        return web.json_response({"success": False, "error": str(ex)}, status=500)

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
    ws = web.WebSocketResponse(heartbeat=15.0)
    await ws.prepare(request)
    ws_clients.add(ws)

    user_id_param = request.query.get("userId")
    uid = None
    if user_id_param:
        try:
            uid = int(user_id_param)
        except (ValueError, TypeError):
            uid = str(user_id_param)
        user_sockets.setdefault(uid, set()).add(ws)
        user_sockets.setdefault(str(uid), set()).add(ws)
        socket_to_user[ws] = uid
        ws_log.info("WebSocket connected and bound to User #%s (active sockets: %d)", uid, len(get_user_sockets(uid)))

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                except Exception:
                    continue

                msg_type = data.get("type")

                # JSON heartbeat ping
                if msg_type == "ping":
                    await ws.send_str(json.dumps({"type": "pong", "timestamp": time.time()}))
                    continue

                # User registration
                elif msg_type == "register":
                    uid_val = data.get("userId") or uid
                    if uid_val is not None:
                        try:
                            uid = int(uid_val)
                        except (ValueError, TypeError):
                            uid = str(uid_val)
                        user_sockets.setdefault(uid, set()).add(ws)
                        user_sockets.setdefault(str(uid), set()).add(ws)
                        socket_to_user[ws] = uid
                        ws_log.info("Registered User #%s (%s) on active socket. Active user sockets: %d", uid, data.get("userName", "Analyst"), len(get_user_sockets(uid)))
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
                        webrtc_log.info(
                            "Simulation updated for session %s => Loss: %.1f%%, Jitter: %dms, Noise: %.1f%%",
                            pc_id[:8], curr["packet_loss"] * 100, curr["jitter_ms"], curr.get("noise_level", 0) * 100
                        )

                # Call initiation
                elif msg_type == "call_request":
                    call_id = data.get("call_id") or f"call_{int(datetime.now().timestamp()*1000)}"
                    caller = data.get("caller", {})
                    callee = data.get("callee", {})
                    callee_id = callee.get("id")

                    ws_log.info("Call signaling initiated: %s (ID #%s) -> %s (ID #%s) [Call ID: %s]",
                                caller.get("name"), caller.get("id"), callee.get("name"), callee_id, call_id)
                    callee_sockets = get_user_sockets(callee_id)
                    is_online = len(callee_sockets) > 0
                    ws_log.info("Call signaling initiated: %s (ID #%s) -> %s (ID #%s) [Call ID: %s] | Callee active sockets: %d",
                                caller.get("name"), caller.get("id"), callee.get("name"), callee_id, call_id, len(callee_sockets))

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
                        ws_log.info("Callee #%s is offline. Sending callee_offline event to caller #%s", callee_id, caller.get("id"))
                        await ws.send_str(json.dumps({
                            "type": "callee_offline",
                            "call_id": call_id,
                            "callee": callee,
                            "message": f"{callee.get('name', 'User')} is not currently active on another device."
                        }))
                    else:
                        ws_log.info("Ringing Callee #%s (%d active sockets) for Call %s...", callee_id, len(callee_sockets), call_id)
                        sent = await send_to_user(callee_id, {
                            "type": "incoming_call",
                            "call_id": call_id,
                            "caller": caller
                        })
                        ws_log.info("Dispatched incoming_call to Callee #%s (success=%s)", callee_id, sent)
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
                        ws_log.info("Call %s accepted by Callee. Notifying caller #%s.", call_id, caller_id)
                        if caller_id:
                            await send_to_user(caller_id, {
                                "type": "call_accepted",
                                "call_id": call_id
                            })

                # WebRTC P2P signaling relay for direct 2-way audio (offer / answer / ice candidate)
                elif msg_type == "webrtc_signal":
                    call_id = data.get("call_id")
                    signal = data.get("signal")
                    target_id = data.get("target_user_id")

                    if not target_id and call_id in active_calls:
                        cinfo = active_calls[call_id]
                        c_caller_id = cinfo.get("caller", {}).get("id")
                        c_callee_id = cinfo.get("callee", {}).get("id")
                        if str(uid) == str(c_caller_id):
                            target_id = c_callee_id
                        else:
                            target_id = c_caller_id

                    if target_id and signal:
                        sig_type = signal.get("type", "candidate")
                        ws_log.info("Relaying WebRTC P2P audio signal (%s) User #%s -> User #%s for Call %s",
                                    sig_type, uid, target_id, call_id)
                        await send_to_user(target_id, {
                            "type": "webrtc_signal",
                            "call_id": call_id,
                            "from_user_id": uid,
                            "signal": signal
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
                        ws_log.info("Call %s declined by Callee. Notifying caller #%s.", call_id, caller_id)
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
                            logger.error("Declined call DB logging failed: %s", dbe)

                # Either party ends call
                elif msg_type == "call_end":
                    call_id = data.get("call_id")
                    target_id = data.get("target_user_id")
                    duration = int(data.get("duration", 0))
                    score = int(data.get("score", 20))
                    risk_tier = data.get("risk_tier", "Low Risk")
                    ws_log.info("Call end requested by User #%s for Call %s (target=%s)", uid, call_id, target_id)

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
                            ws_log.info(
                                "Call %s completed: %s -> %s (Duration: %ds, Score: %d%%, Flagged: %s)",
                                call_id, caller.get("name"), callee.get("name"), duration, score, flagged
                            )
                        except Exception as dbe:
                            logger.error("Completed call DB logging failed: %s", dbe)

                        del active_calls[call_id]

            elif msg.type == WSMsgType.CLOSE:
                break
    finally:
        ws_clients.discard(ws)
        uid = socket_to_user.pop(ws, None)
        if uid is not None:
            for k in [uid, str(uid)]:
                if k in user_sockets:
                    user_sockets[k].discard(ws)
                    if not user_sockets[k]:
                        user_sockets.pop(k, None)
        ws_log.info("WebSocket disconnected for User #%s (has other active sockets: %s)", uid, bool(get_user_sockets(uid)))
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

    forensic_log.info("Exporting JSON forensic certificate to client.")
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
            forensic_log.info("Serving PDF forensic certificate to client.")
            return web.FileResponse(
                pdf_path,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Content-Disposition": "attachment; filename=forensic_certificate.pdf"
                }
            )
    except Exception as e:
        forensic_log.error("Failed to generate PDF: %s", e)
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

    webrtc_log.info("Received WebRTC Offer for session %s (Loss: %.1f%%, Jitter: %dms)",
                    pc_id, initial_sim["packet_loss"]*100, initial_sim["jitter_ms"])

    @pc.on("track")
    def on_track(track):
        if track.kind == "audio":
            webrtc_log.info("Binding inbound audio track to analysis engine for session %s", pc_id)
            task = asyncio.create_task(process_audio_track(track, pc_id))
            active_pc_tasks[pc_id] = task

    @pc.on("connectionstatechange")
    async def on_connectionstatechange():
        webrtc_log.info("WebRTC session %s state changed -> %s", pc_id, pc.connectionState)
        if pc.connectionState in ["closed", "failed", "disconnected"]:
            await close_pc_session(pc_id)

    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    webrtc_log.info("Created WebRTC Answer for session %s. Signaling handshake ready.", pc_id)
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
        webrtc_log.info("Explicit hangup requested for session %s", pc_id)
        await close_pc_session(pc_id)
        return web.json_response({"success": True, "message": f"Session {pc_id} terminated."})
    
    webrtc_log.info("Hangup requested for all active sessions (%d active).", len(active_pcs))
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

        webrtc_log.info("Updated network simulation via REST for %s: Loss=%.1f%%, Jitter=%dms",
                        pc_id, curr["packet_loss"]*100, curr["jitter_ms"])
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

def decode_uploaded_audio(audio_bytes: bytes, target_sr: int = 16000) -> np.ndarray:
    """
    Decodes audio bytes from any supported audio format (WAV, MP3, M4A, AAC, OGG, WebM, FLAC, raw PCM)
    into a 1D float32 numpy array resampled to target_sr mono.
    Tries PyAV first (with bundled ffmpeg libraries), then librosa/soundfile, then raw PCM.
    """
    if not audio_bytes:
        return np.array([], dtype=np.float32)

    # 1. Try PyAV (handles mp3, wav, m4a, aac, ogg, webm, flac, etc.)
    try:
        import av
        with av.open(io.BytesIO(audio_bytes)) as container:
            stream = next((s for s in container.streams if s.type == "audio"), None)
            if stream is not None:
                resampler = av.AudioResampler(format="fltp", layout="mono", rate=target_sr)
                chunks = []
                for frame in container.decode(stream):
                    for resampled_frame in resampler.resample(frame):
                        chunks.append(resampled_frame.to_ndarray())
                if chunks:
                    return np.concatenate(chunks, axis=1).squeeze().astype(np.float32)
    except Exception as av_err:
        forensic_log.debug("PyAV audio decode fallback: %s", av_err)

    # 2. Try librosa / soundfile
    try:
        with io.BytesIO(audio_bytes) as bio:
            audio_np, _ = librosa.load(bio, sr=target_sr, mono=True)
            if len(audio_np) > 0:
                return audio_np.astype(np.float32)
    except Exception as sf_err:
        forensic_log.debug("librosa/soundfile decode fallback: %s", sf_err)

    # 3. Try raw 16-bit PCM fallback
    try:
        raw_pcm = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        if len(raw_pcm) > 0:
            return raw_pcm
    except Exception:
        pass

    return np.array([], dtype=np.float32)

async def analyze_audio_handler(request):
    """
    POST /api/analyze-audio endpoint:
    Accepts multipart/form-data audio file or raw audio.
    Computes standardized waveform, log-mel spectrogram, 4-tier forensic indicator breakdown,
    and returns both the structured metrics and the high-res base64 visualization plot.
    Utilizes local_model (Pretrained Wav2Vec2) as the active inference engine.
    """
    try:
        audio_bytes = None
        filename = "uploaded_audio.wav"

        if request.content_type.startswith("multipart/"):
            reader = await request.multipart()
            while True:
                part = await reader.next()
                if part is None:
                    break
                if part.name == "file":
                    filename = part.filename or "uploaded_audio.wav"
                    chunks = []
                    while True:
                        chunk = await part.read_chunk(1024 * 1024)
                        if not chunk:
                            break
                        chunks.append(chunk)
                    audio_bytes = b"".join(chunks)
                    break
        else:
            try:
                body = await request.json()
                if "audio_base64" in body:
                    audio_bytes = base64.b64decode(body["audio_base64"])
                    filename = body.get("filename", "uploaded_audio.wav")
            except Exception:
                audio_bytes = await request.read()

        if not audio_bytes or len(audio_bytes) == 0:
            return web.json_response({"success": False, "error": "No audio file provided."}, status=400)

        forensic_log.info("Audio analysis initiated for file '%s' (%d bytes)", filename, len(audio_bytes))

        # Robust multi-format audio decoding to 16kHz mono float32
        audio_np = decode_uploaded_audio(audio_bytes, target_sr=16000)

        if len(audio_np) == 0:
            return web.json_response({"success": False, "error": "Audio file is empty or unsupported format."}, status=400)

        # Pretrained Wav2Vec2 inference via local_model
        infer_t0 = time.time()
        pred_result = local_model.predict(audio_np, sr=16000)
        raw_score = pred_result["score"]
        infer_dt = (time.time() - infer_t0) * 1000

        # Calculate indicators in exact requested format
        analysis = compute_forensic_indicators(audio_np, sr=16000, model_score=raw_score)
        if "classification" in pred_result:
            analysis["classification"] = pred_result["classification"]
            analysis["confidence"] = pred_result["confidence"]

        # Generate exact 3-panel figure
        plot_b64 = generate_mel_forensic_plot(
            audio_np=audio_np,
            sr=16000,
            overall_score=analysis["overall_risk_score"],
            indicators=analysis["indicators"],
            key_flags=analysis["key_flags"]
        )

        forensic_log.info(
            "Audio analysis complete for '%s' (%.2fs duration, local_model [Wav2Vec2]: %.1fms) => Score: %.1f/100, Tier: %s, Class: %s",
            filename, float(len(audio_np)/16000.0), infer_dt, analysis["overall_risk_score"], analysis["risk_level"], analysis["classification"]
        )
        log_audit_event("AUDIO_FILE_ANALYZED", {
            "filename": filename,
            "duration_sec": round(float(len(audio_np) / 16000.0), 2),
            "score": analysis["overall_risk_score"],
            "risk_level": analysis["risk_level"],
            "classification": analysis["classification"],
            "inference_engine": "local_model (Wav2Vec2 Pretrained)"
        })

        return web.json_response({
            "success": True,
            "name": filename,
            "duration": round(float(len(audio_np) / 16000.0), 2),
            "score": int(round(analysis["overall_risk_score"])),
            "overall_risk_score": analysis["overall_risk_score"],
            "risk_level": analysis["risk_level"],
            "classification": analysis["classification"],
            "confidence": analysis["confidence"],
            "indicators": analysis["indicators"],
            "key_flags": analysis["key_flags"],
            "model_engine": "local_model (Wav2Vec2 Pretrained)",
            "plot_image": f"data:image/png;base64,{plot_b64}"
        })
    except Exception as e:
        forensic_log.error("Audio analysis failed: %s", e)
        return web.json_response({"success": False, "error": f"Audio analysis failed: {str(e)}"}, status=500)

# -----------------------------------------------------------------------------
# System Status & Logs API
# -----------------------------------------------------------------------------

async def download_apk_handler(request):
    apk_candidates = [
        Path(r"E:\copy-backend-tunneling\beyond404.apk"),
        Path(r"E:\copy-backend-tunneling\app\android\app\build\outputs\apk\debug\app-debug.apk"),
    ]
    for apk in apk_candidates:
        if apk.exists():
            return web.FileResponse(apk, headers={
                "Content-Disposition": "attachment; filename=\"beyond404.apk\""
            })
    return web.Response(text="APK not found on server.", status=404)

async def get_online_users_handler(request):
    online_ids = set()
    for k, sockets in user_sockets.items():
        if any(not s.closed for s in sockets):
            try:
                online_ids.add(int(k))
            except (ValueError, TypeError):
                online_ids.add(str(k))
    return web.json_response({"success": True, "online_user_ids": list(online_ids)})

async def me_handler(request):
    return web.json_response({
        "status": "online",
        "service": "Beyond404 Voice Forensics Gateway",
        "inference_engine": "local_model (Wav2Vec2 Pretrained)",
        "active_sessions": len(active_pcs),
        "timestamp": datetime.now().isoformat()
    })

async def get_logs_handler(request):
    """
    GET /api/logs:
    Returns the latest N lines of server application logs.
    Query params: lines=100 (default 100, max 1000)
    """
    lines_count = int(request.query.get("lines", 100))
    lines_count = max(1, min(lines_count, 1000))
    target = request.query.get("type", "app")  # 'app' or 'audit'

    log_path = AUDIT_LOG_FILE if target == "audit" else APP_LOG_FILE

    if not log_path.exists():
        return web.json_response({"success": True, "logs": [], "total_lines": 0})

    try:
        with open(log_path, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
        tail = all_lines[-lines_count:]
        return web.json_response({
            "success": True,
            "type": target,
            "total_lines": len(all_lines),
            "returned_lines": len(tail),
            "logs": [l.rstrip("\r\n") for l in tail]
        })
    except Exception as e:
        return web.json_response({"success": False, "error": f"Failed reading logs: {e}"}, status=500)

async def on_startup(app):
    logger.info("Initializing Beyond404 Gateway services...")
    try:
        await database.init_db()
        logger.info("Database connection and schema tables verified.")
    except Exception as e:
        logger.error("Could not connect to Supabase: %s", e)

async def on_shutdown(app):
    logger.info("Gateway shutdown initiated. Closing all active WebRTC sessions...")
    for pid in list(active_pcs.keys()):
        await close_pc_session(pid)
    logger.info("All WebRTC sessions gracefully terminated. Gateway offline.")

def create_app():
    app = web.Application(
        client_max_size=100 * 1024 * 1024,
        middlewares=[cors_middleware, request_logging_middleware]
    )
    app.on_startup.append(on_startup)
    app.on_shutdown.append(on_shutdown)

    # User & Auth routes
    app.router.add_post("/api/register", register_handler)
    app.router.add_post("/api/login", login_handler)
    app.router.add_get("/api/users", get_users_handler)
    app.router.add_get("/api/online-users", get_online_users_handler)
    app.router.add_get("/api/me", me_handler)
    app.router.add_get("/download-apk", download_apk_handler)
    app.router.add_get("/apk", download_apk_handler)
    app.router.add_get("/api/logs", get_logs_handler)

    # Activity & Call logs (Supabase)
    app.router.add_get("/api/activity", get_activity_handler)
    app.router.add_post("/api/activity", post_activity_handler)
    app.router.add_post("/api/analyze-audio", analyze_audio_handler)

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
    logger.info("Starting Beyond404 Gateway HTTP + WebSockets server on %s:%d", HOST, PORT)
    web.run_app(app, host=HOST, port=PORT, print=None)
