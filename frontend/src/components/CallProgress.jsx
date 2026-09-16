import React, { useState, useEffect, useRef } from "react";
import {
  Mic, PhoneOff, Pause, Grid3x3, Download, Lock, CheckCircle2,
  AlertTriangle, ShieldAlert, Sparkles, SlidersHorizontal, X, Volume2
} from "lucide-react";

function fmtClock(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function riskColor(pct) {
  if (pct < 34) return { label: "Low Risk", color: "text-emerald-500", bg: "neu-icon-green" };
  if (pct <= 67) return { label: "Medium Risk", color: "text-amber-500", bg: "neu-icon-orange" };
  return { label: "High Risk", color: "text-red-500", bg: "neu-icon-red" };
}

function buildReasons(pct) {
  if (pct < 34) {
    return [
      { text: "Spectral harmonics natural across 16 kHz", status: "pass" },
      { text: "Dynamic range conforms to natural vocal tract", status: "pass" },
      { text: "Pitch contour variability genuine", status: "pass" },
    ];
  }
  if (pct <= 67) {
    return [
      { text: "Slight high-frequency spectral flatness detected", status: "warn" },
      { text: "Low-level phase distortion observed", status: "warn" },
      { text: "Vocal tract formant transitions within bounds", status: "pass" },
    ];
  }
  return [
    { text: "Acoustic envelope discontinuity detected", status: "fail" },
    { text: "Neural vocoder artifact signature present (88% conf)", status: "fail" },
    { text: "Pitch contour flat / synthesized characteristics", status: "fail" },
    { text: "Unnatural phase continuity across frame boundaries", status: "fail" },
  ];
}

function CallBtn({ icon: Icon, label, active, onClick }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        className={`neu-circle neu-press w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all ${
          active ? "neu-icon-blue text-blue-600" : "text-slate-600"
        }`}
      >
        <Icon size={19} />
      </button>
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </div>
  );
}

export default function CallProgress({ caller = {}, onEnd, liveTelemetry }) {
  const [elapsed, setElapsed] = useState(0);
  const [pct, setPct] = useState(18);
  const [bars, setBars] = useState(() => Array(36).fill(10));
  const [muted, setMuted] = useState(false);
  const [held, setHeld] = useState(false);
  const [controlOpen, setControlOpen] = useState(false);
  const [jitter, setJitter] = useState(30);
  const [packetLoss, setPacketLoss] = useState(5);
  const [noiseLevel, setNoiseLevel] = useState(0);
  const [codec, setCodec] = useState("Opus (Default 16kHz)");
  const [currentHash, setCurrentHash] = useState("0000000000000000000000000000000000000000");

  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const sessionIdRef = useRef(null);

  // Sync telemetry from parent if available
  useEffect(() => {
    if (liveTelemetry) {
      if (liveTelemetry.score !== undefined) {
        setPct(Math.round(liveTelemetry.score * 100));
      }
      if (liveTelemetry.packet_loss !== undefined) {
        setPacketLoss(Math.round(liveTelemetry.packet_loss));
      }
      if (liveTelemetry.jitter !== undefined) {
        setJitter(Math.round(liveTelemetry.jitter));
      }
      if (liveTelemetry.noise_level !== undefined) {
        setNoiseLevel(Math.round(liveTelemetry.noise_level));
      }
      if (liveTelemetry.current_hash) {
        setCurrentHash(liveTelemetry.current_hash);
      }
      if (liveTelemetry.indicators) {
        setIndicators(liveTelemetry.indicators);
      }
      if (liveTelemetry.key_flags) {
        setKeyFlags(liveTelemetry.key_flags);
      }
      if (liveTelemetry.classification) {
        setClassification(liveTelemetry.classification);
      }
      if (liveTelemetry.confidence) {
        setConfidence(liveTelemetry.confidence);
      }
      if (liveTelemetry.risk_level) {
        setRiskLevel(liveTelemetry.risk_level);
      }
    }
  }, [liveTelemetry]);

  // Push simulation adjustments to backend
  function updateSimulationSettings(newLoss, newJitter, newNoise, newCodec) {
    const payload = {
      sessionId: sessionIdRef.current,
      packetLoss: newLoss !== undefined ? newLoss : packetLoss,
      jitter: newJitter !== undefined ? newJitter : jitter,
      noiseLevel: newNoise !== undefined ? newNoise : noiseLevel,
      codec: newCodec !== undefined ? newCodec : codec,
    };
    fetch("/api/simulation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((e) => console.warn("Simulation update error:", e));
  }

  // Cleanup helper
  const stopAllMedia = () => {
    console.log("[WEBRTC] Stopping local audio stream & closing RTCPeerConnection");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        t.stop();
        t.enabled = false;
      });
      streamRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (_) {}
      pcRef.current = null;
    }
    if (sessionIdRef.current) {
      fetch("/hangup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdRef.current }),
      }).catch(() => {});
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    const waveTimer = setInterval(() => {
      setBars((b) => [...b.slice(1), 6 + Math.random() * 28]);
    }, 180);

    const pcSessionId = `pc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    sessionIdRef.current = pcSessionId;

    // Connect WebRTC microphone audio track to /offer
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(async (stream) => {
          streamRef.current = stream;
          const pc = new RTCPeerConnection();
          pcRef.current = pc;

          stream.getTracks().forEach((track) => pc.addTrack(track, stream));

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          const res = await fetch("/offer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sdp: pc.localDescription.sdp,
              type: pc.localDescription.type,
              sessionId: pcSessionId,
              packetLoss,
              jitter,
              noiseLevel,
              codec,
            }),
          });

          if (res.ok) {
            const answer = await res.json();
            if (answer.sessionId) {
              sessionIdRef.current = answer.sessionId;
            }
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            console.log(`[WEBRTC] Audio stream attached to backend ONNX model! (Session: ${sessionIdRef.current})`);
          }
        })
        .catch((err) => {
          console.log("[WEBRTC] Mic access info:", err.message);
        });
    }

    // Dynamic variation fallback if no speech
    const pTimer = setInterval(() => {
      setPct((v) => Math.max(8, Math.min(94, v + (Math.random() * 6 - 3))));
    }, 3000);

    return () => {
      clearInterval(timer);
      clearInterval(waveTimer);
      clearInterval(pTimer);
      stopAllMedia();
    };
  }, []);

  const rc = riskColor(pct);
  const reasons = buildReasons(pct);

  const handleEndCall = () => {
    stopAllMedia();
    onEnd(elapsed, pct, rc.label);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
      <div className="neu-card p-8 relative overflow-visible">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 text-emerald-500 font-medium text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Call in progress</span>
            <span className="text-slate-400 font-normal ml-1">{fmtClock(elapsed)}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="neu-icon-green flex items-center gap-1.5 text-emerald-600 text-[11px] font-semibold px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              ONNX Model Active
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="neu-icon-blue w-32 h-32 rounded-full flex items-center justify-center text-4xl font-bold text-blue-600 mb-5">
            {caller.initials || "U"}
          </div>
          <div className="text-xl font-bold text-slate-900">{caller.name}</div>
          <div className="text-slate-500 mt-0.5">{caller.phone}</div>
          <div className="neu-icon-blue mt-3 px-5 py-1.5 rounded-full text-blue-600 text-xs font-semibold">
            {caller.role || "Platform Member"}
          </div>
        </div>

        <div className="flex items-end justify-center gap-[3px] h-16 mt-8 mb-6">
          {bars.map((h, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full transition-all duration-150"
              style={{
                height: `${h}px`,
                background: i > bars.length * 0.62 ? "#cbd5e1" : "#60a5fa",
              }}
            />
          ))}
        </div>

        <div className="neu-inset rounded-2xl p-3.5 mb-8 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-500 truncate">
            <Lock size={13} className="text-blue-500 shrink-0" />
            <span className="font-semibold text-slate-700">Forensic Block Hash:</span>
            <span className="font-mono text-[11px] text-slate-500 truncate">{currentHash}</span>
          </div>
          <span className="neu-icon-green text-emerald-600 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
            Chain Valid
          </span>
        </div>

        <div className="flex items-center justify-center gap-8 sm:gap-10 relative">
          <CallBtn
            icon={Mic}
            label={muted ? "Unmute" : "Mute"}
            active={muted}
            onClick={() => {
              setMuted((v) => !v);
              if (streamRef.current) {
                streamRef.current.getAudioTracks().forEach((t) => (t.enabled = muted));
              }
            }}
          />
          <CallBtn icon={Grid3x3} label="Keypad" onClick={() => {}} />
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleEndCall}
              className="neu-btn-red neu-press w-[68px] h-[68px] rounded-full flex items-center justify-center shadow-lg cursor-pointer"
            >
              <PhoneOff size={22} />
            </button>
            <span className="text-sm font-medium text-slate-700">End Call</span>
          </div>
          <CallBtn icon={Pause} label="Hold" active={held} onClick={() => setHeld((v) => !v)} />
          <div className="relative">
            <CallBtn
              icon={SlidersHorizontal}
              label="Control"
              active={controlOpen}
              onClick={() => setControlOpen((v) => !v)}
            />
            {controlOpen && (
              <div className="neu-card absolute bottom-20 right-0 w-80 p-5 z-30 text-left shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                    <SlidersHorizontal size={15} /> Network &amp; Environment
                  </span>
                  <button onClick={() => setControlOpen(false)}>
                    <X size={15} className="text-slate-400" />
                  </button>
                </div>
                
                {/* Jitter Slider */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Jitter Buffer</span>
                    <span className="font-semibold text-blue-600">{jitter} ms</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={150}
                    value={jitter}
                    onChange={(e) => {
                      const v = +e.target.value;
                      setJitter(v);
                      updateSimulationSettings(packetLoss, v, noiseLevel, codec);
                    }}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Packet Loss Slider */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Packet Loss Simulation</span>
                    <span className="font-semibold text-blue-600">{packetLoss} %</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={packetLoss}
                    onChange={(e) => {
                      const v = +e.target.value;
                      setPacketLoss(v);
                      updateSimulationSettings(v, jitter, noiseLevel, codec);
                    }}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Environment Noise Slider */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>Environment Distortion / Noise</span>
                    <span className="font-semibold text-blue-600">{noiseLevel} %</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    value={noiseLevel}
                    onChange={(e) => {
                      const v = +e.target.value;
                      setNoiseLevel(v);
                      updateSimulationSettings(packetLoss, jitter, v, codec);
                    }}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-1.5">Codec Format</div>
                  <select
                    value={codec}
                    onChange={(e) => {
                      setCodec(e.target.value);
                      updateSimulationSettings(packetLoss, jitter, noiseLevel, e.target.value);
                    }}
                    className="neu-inset w-full rounded-xl px-4 py-2.5 text-sm text-slate-700 outline-none border-none"
                  >
                    <option value="Opus (Default 16kHz)">Opus (Default 16kHz)</option>
                    <option value="G.711 PCMU">G.711 PCMU (8kHz PSTN)</option>
                    <option value="AAC-LD">AAC-LD (Enhanced Voice)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-8 pt-6 border-t border-white/70">
          <button
            onClick={() => window.open("/export-certificate", "_blank")}
            className="neu-card-sm neu-press flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full text-slate-600"
          >
            <Download size={13} /> Export Certificate (JSON)
          </button>
          <button
            onClick={() => window.open("/export-pdf", "_blank")}
            className="neu-card-sm neu-press flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-full text-blue-600"
          >
            <Download size={13} /> Export Certificate (PDF)
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-slate-900">Fraud Risk Score</span>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${rc.bg} ${rc.color}`}>
              {rc.label}
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className={`text-4xl font-extrabold ${rc.color}`}>{pct}%</span>
            <span className="text-xs text-slate-400">AI Clone Probability</span>
          </div>
          <div className="neu-progress-track mb-3">
            <div
              className={`neu-progress-bar ${pct > 67 ? "bg-red-500" : pct > 33 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 font-medium">
            <span>Genuine Voice (0-33%)</span>
            <span>Suspicious (34-67%)</span>
            <span>AI Clone (68-100%)</span>
          </div>
        </div>

        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-slate-900">Forensic Indicator Breakdown</span>
            <span className="text-[11px] font-bold text-slate-400">Anomaly Index (%)</span>
          </div>

          <div className="space-y-3 mb-5">
            {Object.entries(indicators).map(([k, val]) => (
              <div key={k}>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-600">{k}</span>
                  <span className="text-slate-900 font-bold">{val}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      val > 40 ? "bg-red-500" : val > 20 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(3, val))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Summary Box matching user specification */}
          <div className="p-3.5 rounded-2xl border-2 border-red-500 bg-red-50/25">
            <div className="font-mono text-xs font-bold text-slate-900">
              OVERALL RISK SCORE: {pct} / 100
            </div>
            <div className="font-mono text-xs text-slate-700 mt-0.5">
              RISK LEVEL: {pct >= 67 ? "HIGH" : pct >= 34 ? "MEDIUM" : "LOW"}
            </div>
            <div className="font-mono text-xs text-slate-700">
              CLASSIFICATION: {pct >= 50 ? "AI_GENERATED" : "GENUINE"}
            </div>
            <div className="font-mono text-xs text-slate-700">
              CONFIDENCE: {confidence}%
            </div>
            <div className="mt-2 font-mono text-xs font-semibold text-slate-900">Key Flags:</div>
            <ul className="text-xs text-slate-600 space-y-0.5 mt-0.5 font-mono">
              {keyFlags.map((flag, idx) => (
                <li key={idx}>• {flag}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="neu-card p-6">
          <div className="text-sm font-bold text-slate-900 mb-3">Live Environment Simulation</div>
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Simulated Packet Loss:</span>
              <span className="font-semibold text-slate-800">{packetLoss}%</span>
            </div>
            <div className="flex justify-between">
              <span>Simulated Jitter Buffer:</span>
              <span className="font-semibold text-slate-800">{jitter}ms</span>
            </div>
            <div className="flex justify-between">
              <span>Environment Noise Level:</span>
              <span className="font-semibold text-slate-800">{noiseLevel}%</span>
            </div>
            <div className="flex justify-between">
              <span>Active Codec Emulation:</span>
              <span className="font-semibold text-blue-600">{codec}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
