# Beyond404 Voice Forensics — Application Lifecycle Trace & Logging Architecture

This document details the end-to-end logging architecture and execution lifecycle for the **Beyond404 Real-Time AI Voice Cloning Detection and Integrity Verification Framework**.

---

## 1. Logging Architecture Overview

```
                                  +---------------------------------------+
                                  |     Beyond404 Centralized Logger      |
                                  +---------------------------------------+
                                                     |
             +---------------------------------------+---------------------------------------+
             |                                                                               |
   [ Backend (Python 3.12) ]                                                       [ Frontend (React 18) ]
   • backend/logger.py                                                             • frontend/src/utils/logger.js
   • Rotating File: backend/logs/beyond404.log                                     • Circular Buffer (500 entries)
   • Audit Log:     backend/logs/audit.log (JSON-L)                                • Live Subscription Hooks
   • Console Stream Handler (Stdout)                                               • System Logs Terminal Modal
   • HTTP Request Middleware (Method, Path, Latency)                               • Export Log File (.log / .jsonl)
   • REST Endpoint: GET /api/logs?type=app|audit&lines=N
```

---

## 2. End-to-End Lifecycle Phases (Start to Finish)

### Phase 1: Boot & Environment Initialization
- Central logger configuration via `logger.setup_logging()`.
- Handlers attached for console stdout and rotating disk files (`logs/beyond404.log` and `logs/audit.log`).
- External loggers silenced (aioice, aiortc, aiohttp access).

### Phase 2: Deep Learning Model Validation
- Path resolution and checksum verification of `model.onnx`.
- `onnxruntime.InferenceSession` initialization with `CPUExecutionProvider`.
- Log-Mel spectrogram input shape validation `[1, 1, 128, 94]`.

### Phase 3: Database & Security Schema Check
- `asyncpg` connection pool creation (`aws-0-ap-south-1.pooler.supabase.com:5432`).
- Auto-migration check for tables `public.users` and `public.call_activities`.
- Automatic platform user seeding if user count is zero.

### Phase 4: HTTP Gateway & WebSocket Server Launch
- Registering REST endpoints (`/api/register`, `/api/login`, `/api/users`, `/api/activity`, `/api/analyze-audio`, `/api/logs`).
- Attaching CORS middleware and `request_logging_middleware` to measure millisecond request latency.
- Gateway bound to `0.0.0.0:8080`.

### Phase 5: Client Authentication & Session Restore
- User signs in via `/api/login` or restores token from localStorage.
- Immutable audit event recorded: `AUTH_SUCCESS` with user ID, name, role, and timestamp.
- User directory and historical activities fetched from Supabase.

### Phase 6: WebSocket Signaling Handshake
- WebSocket connected at `ws://localhost:8080/ws?userId={id}`.
- User socket mapped to `user_sockets[uid]` dictionary.
- Duplex heartbeat ping/pong established.

### Phase 7: Voice Call Initiation & Routing
- Caller clicks "Call" on contact card.
- Signaling message `call_request` dispatched over WebSocket.
- Callee device notified with `incoming_call` (or `callee_offline` if target is offline).
- 25-second timeout worker spawned (`call_timeout_worker`).

### Phase 8: WebRTC Audio Pipeline Establishment
- Callee accepts call via `call_accept` (or user connects directly via test mode).
- Browser captures microphone audio via `navigator.mediaDevices.getUserMedia({ audio: true })`.
- `RTCPeerConnection` creates SDP Offer and sends to `POST /offer`.
- Server creates SDP Answer and binds audio track to `process_audio_track()`.

### Phase 9: Real-Time Audio Chunk Ingestion & Impairment Emulation
- Inbound 16 kHz mono Opus audio frames converted to PCM bytes.
- Network simulation filters applied dynamically (packet loss, variable jitter buffer delay, environmental noise).

### Phase 10: Multi-Factor Forensic Anomaly Breakdown
- 16,000-sample audio window converted to 128-band log-Mel spectrogram.
- ONNX neural inference runs in ~8ms to determine synthetic probability score.
- Score calibrated against Packet Loss Concealment (PLC).
- Digital Signal Processing (DSP) engine calculates 4 core indicators:
  1. **Spectral Flux**: Measures abnormal high-frequency shifts.
  2. **Dead Silence Ratio**: Flags unnatural digital gating between words.
  3. **Pitch Anomaly Index**: Detects robotic, flatlined F0 pitch contours.
  4. **Vocoder Artifact Index**: Detects phase inconsistencies and neural vocoder glitching.

### Phase 11: Real-Time Telemetry & Threat Alerting
- Real-time telemetry broadcasted via WebSocket to all connected peers.
- UI renders fraud gauge: Green (0–33%), Amber (34–67%), Red (68–100%).
- If risk crosses 67%, High-Risk alert banner triggers and `HIGH_RISK_FRAUD_FLAGGED` is written to `audit.log`.

### Phase 12: Cryptographic SHA-256 Block Chaining
- Each 1-second audio frame generates a cryptographic block:
  `Hash = SHA256(prev_hash + timestamp + score + risk_tier + audio_sha256 + telemetry)`
- Forms a tamper-evident blockchain of audio integrity.

### Phase 13: Call Termination & Forensic Certificate Export
- User ends call via `call_end`.
- Call metadata (duration, fraud score, risk tier, flagged status) saved to Supabase `call_activities`.
- Terminal block hash exported to `forensic_certificate.json`.
- ReportLab compiles official PDF Certificate `forensic_certificate.pdf`.
- Audit event recorded: `FORENSIC_CERTIFICATE_SAVED`.

### Phase 14: Graceful Shutdown
- Peer connections closed and audio stream tracks cancelled.
- Supabase connection pool released.
- Log handlers flushed to disk.

---

## 3. Log File Reference

- **Rotating Server Log**: [backend/logs/beyond404.log](file:///E:/Sih_complete_prototype/backend/logs/beyond404.log)
- **Security Audit Trail**: [backend/logs/audit.log](file:///E:/Sih_complete_prototype/backend/logs/audit.log)
- **Full Lifecycle Simulation Trace**: [backend/logs/application_lifecycle_trace.log](file:///E:/Sih_complete_prototype/backend/logs/application_lifecycle_trace.log)
- **Frontend Logger Utility**: [frontend/src/utils/logger.js](file:///E:/Sih_complete_prototype/frontend/src/utils/logger.js)
- **Interactive UI Terminal Modal**: [frontend/src/components/LogsModal.jsx](file:///E:/Sih_complete_prototype/frontend/src/components/LogsModal.jsx)
