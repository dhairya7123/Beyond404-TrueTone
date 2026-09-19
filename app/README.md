# Beyond404 Mobile App — Android & Capacitor

Native mobile application for the Beyond404 Real-Time AI Voice Forensics & Deepfake Detection Platform.

Built with **React**, **Vite**, **Tailwind CSS**, and **Capacitor**, providing cross-platform mobile functionality with native Android hardware integration.

---

## 🚀 Key Mobile Features

- **Direct 2-Way WebRTC Audio Calling**: Full peer-to-peer voice streaming between mobile devices with STUN negotiation.
- **Dynamic Backend Link Configuration**: In-app modal accessible from the header settings gear icon allowing users to switch between local development IPs and public Cloudflare Tunnel URLs (`https://*.trycloudflare.com`) on the fly.
- **Live Voice Forensics Telemetry**: Displays real-time risk scores, synthetic probability indicators, vocoder anomaly flags, and live audio frequency spectrum waves during calls.
- **Auto-Cut & Guaranteed End Call**: Safe audio teardown with `try...finally` guarantees that pressing the red End Call button immediately disconnects both peers.
- **Native Android Microphone Permissions**: Auto-prompts for `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` on initial launch.
- **Precompiled APK**: Ships with a precompiled debug APK in the root directory: [`beyond404.apk`](../beyond404.apk).

---

## 📦 How to Build and Run

### Prerequisites
- Node.js 18+ & npm
- Android Studio / Android SDK (API 33+)
- Java JDK 17 / JBR (`C:\Program Files\Android\Android Studio\jbr`)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Web Development Preview
```bash
npm run dev
```

### 3. Build Web Assets & Sync with Capacitor
```bash
npm run build
npx cap sync
```

### 4. Build Android Debug APK
```powershell
cd android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat assembleDebug
```
The output APK is generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔧 Configuring the Backend URL in the App

1. Open the app on your Android phone.
2. Tap the **gear icon** (Settings) in the top-right corner.
3. Enter your backend host URL (e.g. `https://your-tunnel.trycloudflare.com` or `http://192.168.1.50:8080`).
4. Tap **Save & Reconnect**. The app stores the URL in `localStorage` and reconnects to WebSocket signaling and REST endpoints immediately.
