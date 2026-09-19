# Beyond404-TrueTone- Real-Time AI Voice Forensics & Deepfake Detection Platform

Beyond404 is an end-to-end voice fraud detection platform that detects AI-synthesized, cloned, and deepfake voices in real time during live calls and offline audio uploads. The system integrates real-time WebRTC audio streaming, state-of-the-art acoustic inference engines (Pretrained Wav2Vec2 + ONNX fallback), cryptographic forensic hashing, a responsive web dashboard, and a native Android mobile application with automated Cloudflare Tunneling support.

---

## 🚀 Key Features

- **2-Way P2P WebRTC Voice Calling**: Crystal-clear bidirectional voice communication between mobile devices and web clients with automatic STUN server ICE negotiation.
- **Dual AI Inference Engines**:
  - **Pretrained Wav2Vec2 Local Model**: High-accuracy acoustic transformer evaluating raw 16 kHz audio waveforms for synthetic voice artifacts and vocoder anomalies.
  - **Preserved ONNX Pipeline**: Optimized lightweight fallback model for low-latency scoring and cross-platform compatibility.
- **Native Android App (Capacitor + React)**:
  - Full mobile APK supporting direct 2-way WebRTC calling, incoming call notifications, microphone runtime permissions, and soft-UI call controls.
  - **Dynamic Backend Link Configuration**: Built-in modal to dynamically set or update the backend URI (local IP or Cloudflare Tunnel) without recompiling the app.
  - **Direct APK Distribution**: Precompiled APK served directly from the backend gateway via `/download-apk` and stored in the repository root (`beyond404.apk`).
- **Cloudflare Tunneling Integration**:
  - Zero-configuration scripts (`start_tunnel.bat`, `start_all.bat`) exposing the local backend server via secure HTTPS/WSS tunnels (`https://*.trycloudflare.com`) for instant external mobile access.
- **Cryptographic Forensic Chain of Custody**:
  - SHA-256 blockchain-style hash chain generated across every audio frame to guarantee tamper-evident verification.
  - Exportable forensic certificates in JSON and PDF formats.
- **Real-Time Network & Environment Simulation**:
  - Interactive sliders to dynamically simulate packet loss (0–30%), jitter buffering (0–150ms), and background acoustic noise during live calls.
- **Persistent Database & Telemetry**:
  - Supabase PostgreSQL async database layer handling user authentication, contacts directory, and isolated forensic call history logs.
- **Modern Soft-UI / Neumorphic Interface**:
  - Web dashboard and mobile UI built with Tailwind CSS, animated audio frequency spectrums, live telemetry cards, and integrated diagnostic log modals.

---

## 🛠️ Repository Architecture

```text
Sih_web_code/
├── app/                               # Native Android / Mobile Application
│   ├── android/                       # Capacitor Android Studio native project
│   │   ├── app/src/main/              # Android manifest, Java source, and resources
│   │   └── build.gradle               # Gradle build configuration
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthScreen.jsx         # User login & registration
│   │   │   ├── BackendSettingsModal.jsx # Dynamic backend URL input modal
│   │   │   ├── CallProgress.jsx       # 2-Way WebRTC call screen & audio controls
│   │   │   ├── ContactsView.jsx       # Contacts list & call launcher
│   │   │   ├── DashboardView.jsx      # Telemetry & call statistics
│   │   │   └── LogsModal.jsx          # Mobile diagnostic log viewer
│   │   ├── utils/api.js               # Dynamic API & WebSocket URL resolution
│   │   └── App.jsx                    # Mobile app router & WebSocket event handlers
│   ├── capacitor.config.json          # Capacitor bridge settings
│   └── package.json                   # Mobile frontend dependencies
├── backend/                           # Python Backend Gateway & AI Pipeline
│   ├── local_model/                   # Pretrained Wav2Vec2 weights (Git LFS)
│   │   ├── config.json
│   │   ├── model.safetensors          # 360MB transformer model tracked via Git LFS
│   │   └── preprocessor_config.json
│   ├── local_model.py                 # Wav2Vec2 inference engine loader & audio processor
│   ├── model.onnx                     # Standby ONNX voice classification model
│   ├── server.py                      # aiohttp + aiortc HTTP & WebRTC/WebSocket gateway
│   ├── database.py                    # Supabase async PostgreSQL database client
│   ├── forensics.py                   # Cryptographic SHA-256 block chain manager
│   ├── generate_pdf.py                # Forensic certificate PDF generator
│   ├── logger.py                      # Structured multi-target application logger
│   └── requirements.txt               # Backend Python dependencies
├── frontend/                          # React Web Dashboard
│   ├── src/
│   │   ├── components/                # Neumorphic web UI components
│   │   ├── utils/                     # Web logging and API utilities
│   │   └── App.jsx                    # Web dashboard router & WebRTC client
│   ├── package.json                   # Frontend dependencies
│   └── vite.config.js                 # Vite development & build configuration
├── beyond404.apk                      # Ready-to-install Android APK release
├── start_all.bat                      # One-click Windows launcher (Backend + Tunnel)
├── start_backend.bat                  # Backend server launcher
├── start_tunnel.bat                   # Cloudflare Tunnel launcher
├── APPLICATION_LOGGING_ARCHITECTURE.md# Comprehensive logging system documentation
└── README.md                          # Project documentation
```

---

## 📱 Android Mobile Application (`app/`)

The mobile client is packaged using **Capacitor** and **React**. It connects seamlessly to either a local backend on your LAN or an internet-facing Cloudflare Tunnel URL.

### Quick APK Download
- Directly download the compiled APK from the repository: [`beyond404.apk`](beyond404.apk)
- Or download directly from a running backend gateway at `https://<YOUR_TUNNEL_URL>/download-apk`.

### Setting the Backend URL on Mobile
1. Launch the Beyond404 app on your Android device.
2. Grant the **Microphone** (`RECORD_AUDIO`) permission when prompted.
3. Tap the **Settings** (gear) icon in the top header.
4. Enter your backend URL:
   - For Cloudflare Tunnel: `https://your-tunnel-name.trycloudflare.com`
   - For Local LAN: `http://192.168.x.x:8080`
5. Tap **Save & Reconnect**. The app will automatically establish WebSocket and REST connections to the backend.

### Building the Mobile App from Source
```powershell
cd app
npm install
npm run build
npx cap sync
cd android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat assembleDebug
```
The newly built APK will be located at `app/android/app/build/outputs/apk/debug/app-debug.apk`.

---

## ⚡ Quick Start: Backend & Tunneling

### 1. Prerequisites
- **Python 3.10+** (64-bit)
- **Node.js 18+** & **npm**
- **Git & Git LFS** (`git lfs install`)
- **Cloudflared CLI** (optional, for remote mobile tunneling)

### 2. Automated One-Click Launch (Windows)
Double-click [`start_all.bat`](start_all.bat) or run in PowerShell:
```powershell
.\start_all.bat
```
This automatically:
1. Starts the Python backend on `http://127.0.0.1:8080` in a dedicated console.
2. Initializes the Cloudflare tunnel in a second window and outputs your public `https://*.trycloudflare.com` link.

### 3. Manual Launch

#### Step A: Setup Backend Virtual Environment & Dependencies
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

> **Note on Model Weights:**
> The Wav2Vec2 transformer weights (`backend/local_model/model.safetensors`, ~360MB) are managed via **Git LFS**. Ensure you have executed `git lfs pull` to fetch the complete binary weights file.

#### Step B: Start Backend Server
```powershell
python -u server.py
```
*Backend runs on `http://localhost:8080`.*

#### Step C: Start Cloudflare Tunnel (for Mobile Access)
In a separate terminal:
```powershell
cloudflared tunnel --url http://127.0.0.1:8080
```
Copy the generated `https://<random-words>.trycloudflare.com` URL and paste it into the mobile app settings.

#### Step D: Run Web Frontend (Optional)
```powershell
cd frontend
npm install
npm run dev
```
*Web dashboard runs on `http://localhost:5173`.*

---

## 🌐 WebRTC Signaling & Audio Architecture

```
 Mobile Peer A (Caller)         Backend Gateway (aiohttp)         Mobile Peer B (Callee)
      │                                     │                                  │
      │── ws: call_user (target_id) ───────>│                                  │
      │                                     │── ws: incoming_call ────────────>│
      │                                     │<── ws: call_accept ──────────────│
      │<── ws: call_accepted ───────────────│                                  │
      │                                     │                                  │
      │── ws: webrtc_signal (SDP Offer) ───>│── ws: webrtc_signal (Offer) ────>│
      │<── ws: webrtc_signal (Answer) ──────│<── ws: webrtc_signal (Answer) ───│
      │── ws: webrtc_signal (ICE) ─────────>│── ws: webrtc_signal (ICE) ──────>│
      │<── ws: webrtc_signal (ICE) ─────────│<── ws: webrtc_signal (ICE) ──────│
      │                                     │                                  │
      │═════════════════════ P2P Encrypted Audio Stream ═══════════════════════│
      │                                     │                                  │
      │── aiortc: /offer (Local Stream) ───>│ (Real-Time AI Forensic Model)    │
      │<── Telemetry (Risk Score, Flags) ───│                                  │
      │                                     │                                  │
      │── ws: call_end ────────────────────>│── ws: call_ended ────────────────>│
```

1. **Signaling Exchange**: All call setup packets (`call_user`, `call_ringing`, `call_accept`, `call_decline`, `call_end`) and WebRTC ICE handshakes (`webrtc_signal`) are mediated via the backend WebSocket handler with user ID socket tracking.
2. **2-Way P2P Media**: Audio is streamed peer-to-peer using Opus codec with hardware echo cancellation and noise suppression.
3. **Continuous AI Monitoring**: Concurrently, audio frames are analyzed by the backend AI engine to compute real-time risk scores, spectral flux, pitch variance, and synthetic speech probabilities.
4. **Guaranteed Call Teardown**: Hitting End Call on either end immediately cleans up local tracks, stops WebRTC peer connections, notifies the remote peer, and synchronizes call activity to the Supabase database.

---

## 🔒 Security & Forensics

- **Cryptographic Chain of Custody**: Every analyzed 1-second audio frame is hashed in sequential order linking to the previous block's SHA-256 hash. Any post-call manipulation or truncation invalidates the block chain.
- **Exportable Evidence Certificates**: Downloadable verification report containing call metadata, caller/callee IDs, risk breakdown, and tamper verification proofs.
- **Role & Activity Isolation**: Supabase Row-Level Security and indexed database queries ensure users only access call history and forensic logs linked to their registered user accounts.

---

## 📄 License

This project is developed for voice security, research, and fraud prevention applications.
