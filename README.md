# Beyond404 - Real-Time Voice Forensics & AI Clone Detection Platform

Beyond404 is an end-to-end voice fraud detection system designed to identify and flag AI-synthesized and deepfake voices in real time during live WebRTC calls and offline audio uploads.

## 🚀 Key Features

- **Live WebRTC Call Signaling & Audio Stream Analysis**: Peer-to-peer audio streaming with real-time inference against an ONNX voice forensics deep learning model.
- **Auto-Cut & Call Timeout**: 25-second auto-timeout cutoff for unanswered calls, plus instant decline and end-call teardown.
- **Cryptographic Forensic Chain**: Generates SHA-256 block hash chains on every audio frame for tamper-evident call verification and certificate export (JSON/PDF).
- **Network & Environment Simulation**: Dynamic real-time sliders for Packet Loss (0-30%), Jitter Buffering (0-150ms), and Acoustic Environment Noise.
- **Supabase Authentication & Activity Isolation**: Complete user authentication, contacts directory, and per-user isolated forensic activity logs in PostgreSQL.
- **Modern Soft-UI / Neumorphic Dashboard**: React frontend with real-time spectral risk scoring, harmonic metrics, and activity charts.

---

## 🛠️ Architecture

```
Sih_complete_prototype/
├── backend/
│   ├── server.py              # aiohttp + aiortc WebRTC gateway & WebSocket signaling
│   ├── database.py            # Supabase PostgreSQL async database layer
│   ├── forensics.py           # SHA-256 blockchain-style hash chain generator
│   ├── generate_pdf.py        # PDF certificate generator
│   ├── model.onnx             # Deep learning voice fraud classification model
│   └── requirements.txt       # Backend dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # Main app router & WebSocket client
│   │   └── components/        # React components (Auth, Dashboard, CallProgress, etc.)
│   ├── package.json           # Frontend dependencies
│   └── vite.config.js         # Vite configuration with backend proxy
├── start_all.ps1              # Unified startup script
└── .gitignore                 # Root git ignore
```

---

## ⚙️ Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+

### 2. Automatic Launch (Windows PowerShell)
```powershell
.\start_all.ps1
```

### 3. Manual Launch

**Backend Gateway:**
```powershell
cd backend
.\.venv\Scripts\Activate.ps1   # Or create: python -m venv .venv
pip install -r requirements.txt
python server.py
```
*Backend runs on `http://localhost:8080`*

**Frontend UI:**
```powershell
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:5173`*
