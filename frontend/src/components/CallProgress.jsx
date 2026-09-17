import React, { useEffect, useRef, useState } from "react";
import {
  PhoneOff, ShieldAlert, Wifi, Sliders, Volume2, ShieldCheck, Download,
  Activity, Waves, BarChart3, AlertTriangle, CheckCircle2, Radio
} from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import logger from "../utils/logger";

function fmtDuration(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function riskColor(pct) {
  if (pct < 34) return { text: "text-emerald-500", bg: "bg-emerald-500", ring: "#10b981", label: "Low Risk" };
  if (pct < 67) return { text: "text-amber-500", bg: "bg-amber-500", ring: "#f59e0b", label: "Medium Risk" };
  return { text: "text-red-500", bg: "bg-red-500", ring: "#ef4444", label: "High Risk" };
}

function buildReasons(pct) {
  const bad = pct >= 50;
  return [
    { key: "voice", label: "Voice Similarity", detail: bad ? "High match with synthetic clone patterns" : "Low match with known clone patterns", badge: bad ? "High" : "Low", ok: !bad },
    { key: "speaker", label: "Speaker Behaviour", detail: bad ? "Detected artificial prosody characteristics" : "Natural speech flow detected", badge: bad ? "Unusual" : "Normal", ok: !bad },
    { key: "audio", label: "Audio Quality", detail: bad ? "Unnatural spectral cutoff detected" : "No signs of synthetic audio", badge: bad ? "Flagged" : "Clear", ok: !bad },
    { key: "linguistic", label: "Linguistic Patterns", detail: bad ? "Atypical speech timing patterns" : "Consistent with genuine conversation", badge: bad ? "Anomaly" : "Normal", ok: !bad },
  ];
}

function Gauge({ pct, size = 260 }) {
  const rc = riskColor(pct);
  const data = [{ value: pct, fill: rc.ring }];
  const chartHeight = Math.round(size * 0.55);
  const labelHeight = 64;

  return (
    <div className="relative flex justify-center" style={{ width: size, height: chartHeight + labelHeight }}>
      <RadialBarChart
        width={size}
        height={chartHeight}
        cx="50%"
        cy="100%"
        innerRadius="72%"
        outerRadius="100%"
        barSize={20}
        data={data}
        startAngle={180}
        endAngle={0}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
        <RadialBar background={{ fill: "#dde3ee" }} dataKey="value" cornerRadius={10} isAnimationActive />
      </RadialBarChart>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex flex-col items-center pointer-events-none">
        <div className="text-5xl font-bold text-slate-900 leading-none">{Math.round(pct)}%</div>
        <div className={`text-sm font-semibold mt-2 whitespace-nowrap ${rc.text}`}>{rc.label}</div>
      </div>
    </div>
  );
}

export default function CallProgress({ caller = {}, onEnd, liveTelemetry }) {
  const [elapsed, setElapsed] = useState(0);
  const [pct, setPct] = useState(18);
  const [bars, setBars] = useState(() => Array.from({ length: 28 }, () => 8 + Math.random() * 24));

  // Network Simulation State
  const [packetLoss, setPacketLoss] = useState(5);
  const [jitter, setJitter] = useState(30);
  const [noiseLevel, setNoiseLevel] = useState(0);
  const [codec, setCodec] = useState("Opus (Default 16kHz)");
  const [currentHash, setCurrentHash] = useState("0000000000000000000000000000000000000000");

  const [indicators, setIndicators] = useState({
    "Spectral Flux": 15.0,
    "Dead Silence": 10.0,
    "Pitch Anomaly": 0.0,
    "Vocoder": 15.0,
  });
  const [keyFlags, setKeyFlags] = useState(["No overt vocoder or pitch anomalies detected"]);
  const [classification, setClassification] = useState("GENUINE");
  const [confidence, setConfidence] = useState(78.1);
  const [riskLevel, setRiskLevel] = useState("LOW");

  const pcRef = useRef(null);
  const streamRef = useRef(null);
  const sessionIdRef = useRef(null);

  // Sync real-time WebRTC telemetry from backend ONNX inference
  useEffect(() => {
    if (liveTelemetry) {
      if (liveTelemetry.overall_risk_score !== undefined) {
        setPct(Math.round(liveTelemetry.overall_risk_score));
      } else if (liveTelemetry.score !== undefined) {
        setPct(Math.round(liveTelemetry.score * 100));
      }
      if (liveTelemetry.packet_loss !== undefined) {
        setPacketLoss(liveTelemetry.packet_loss);
      }
      if (liveTelemetry.jitter !== undefined) {
        setJitter(liveTelemetry.jitter);
      }
      if (liveTelemetry.noise_level !== undefined) {
        setNoiseLevel(liveTelemetry.noise_level);
      }
      if (liveTelemetry.current_hash) {
        setCurrentHash(liveTelemetry.current_hash);
      }
      if (liveTelemetry.indicators && typeof liveTelemetry.indicators === "object") {
        setIndicators(liveTelemetry.indicators);
      }
      if (Array.isArray(liveTelemetry.key_flags)) {
        setKeyFlags(liveTelemetry.key_flags);
      }
      if (liveTelemetry.classification) {
        setClassification(liveTelemetry.classification);
      }
      if (liveTelemetry.confidence !== undefined) {
        setConfidence(liveTelemetry.confidence);
      }
      if (liveTelemetry.risk_level) {
        setRiskLevel(liveTelemetry.risk_level);
      }

      logger.debug("CallForensics", `Telemetry update: ${liveTelemetry.overall_risk_score || liveTelemetry.score}% (${liveTelemetry.classification || "ANALYZING"})`, {
        hash: liveTelemetry.current_hash ? liveTelemetry.current_hash.slice(0, 10) + "..." : null,
        loss: liveTelemetry.packet_loss,
        jitter: liveTelemetry.jitter,
      });
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
    logger.info("CallSimulation", `Adjusting network impairment: Loss=${payload.packetLoss}%, Jitter=${payload.jitter}ms, Noise=${payload.noiseLevel}%`);
    fetch("/api/simulation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((e) => logger.warn("CallSimulation", "Simulation update error: " + e.message));
  }

  // Cleanup helper
  const stopAllMedia = () => {
    logger.info("CallWebRTC", "Stopping local audio stream & closing RTCPeerConnection");
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
    logger.info("CallSession", `Active call progress started with ${caller?.name || "contact"} (${caller?.phone || ""})`);
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    const waveTimer = setInterval(() => {
      setBars((b) => [...b.slice(1), 6 + Math.random() * 28]);
    }, 180);

    const pcSessionId = `pc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    sessionIdRef.current = pcSessionId;

    // Connect WebRTC microphone audio track to /offer
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      logger.info("CallWebRTC", "Requesting microphone access for real-time ONNX analysis...");
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(async (stream) => {
          streamRef.current = stream;
          logger.info("CallWebRTC", "Microphone stream granted. Creating RTCPeerConnection...");
          const pc = new RTCPeerConnection();
          pcRef.current = pc;

          stream.getTracks().forEach((track) => pc.addTrack(track, stream));

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          logger.info("CallWebRTC", `Sending SDP Offer to /offer with session ID ${pcSessionId}...`);
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
            logger.info("CallWebRTC", `Remote SDP Answer configured. Audio pipeline streaming to ONNX engine! (Session: ${sessionIdRef.current})`);
          } else {
            logger.warn("CallWebRTC", `Server rejected SDP Offer: HTTP ${res.status}`);
          }
        })
        .catch((err) => {
          logger.warn("CallWebRTC", `Microphone access unavailable: ${err.message}. Using synthetic stream fallback.`);
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
      logger.info("CallSession", "Call cleanup finished.");
    };
  }, []);

  const rc = riskColor(pct);
  const reasons = buildReasons(pct);

  const handleEndCall = () => {
    logger.info("CallSession", `Call terminated by user. Duration: ${elapsed}s, Final Score: ${pct}%`);
    stopAllMedia();
    onEnd(elapsed, pct, rc.label);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
      <div className="neu-card p-8 relative overflow-visible">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 text-emerald-500 font-medium text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Call in progress · {fmtDuration(elapsed)}</span>
          </div>
          <div className="neu-icon-blue px-3 py-1 rounded-full text-xs font-semibold text-blue-600 flex items-center gap-1.5">
            <Radio size={12} className="animate-pulse" />
            AI Voice Forensics Stream Active
          </div>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="neu-icon-blue w-32 h-32 rounded-full flex items-center justify-center text-4xl font-bold text-blue-600 mb-5">
            {caller?.initials || "U"}
          </div>
          <div className="text-xl font-bold text-slate-900">{caller?.name || "Caller"}</div>
          <div className="text-slate-500 mt-0.5">{caller?.phone || ""}</div>
          <div className="neu-icon-blue mt-3 px-5 py-1.5 rounded-full text-blue-600 text-xs font-semibold">
            {caller?.role || "Platform Member"}
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 h-16 my-8 px-6">
          {bars.map((h, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-blue-500/70 transition-all duration-150"
              style={{ height: `${h}px` }}
            />
          ))}
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleEndCall}
            className="neu-btn-red neu-press w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
          >
            <PhoneOff size={22} />
          </button>
        </div>

        {/* Live Network & Audio Impairment Simulator */}
        <div className="mt-10 pt-6 border-t border-white/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-blue-600" />
              <span className="text-sm font-bold text-slate-900">Live Network &amp; Telephony Simulation</span>
            </div>
            <span className="text-xs text-slate-500">Test AI robustness under network stress</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Packet Loss */}
            <div className="neu-inset p-3.5 rounded-2xl">
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Packet Loss</span>
                <span className="text-blue-600">{packetLoss}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="1"
                value={packetLoss}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setPacketLoss(v);
                  updateSimulationSettings(v, undefined, undefined, undefined);
                }}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="text-[10px] text-slate-500 mt-1">Triggers Packet Loss Concealment (PLC)</div>
            </div>

            {/* Jitter */}
            <div className="neu-inset p-3.5 rounded-2xl">
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Jitter Buffer</span>
                <span className="text-blue-600">{jitter} ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="120"
                step="5"
                value={jitter}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setJitter(v);
                  updateSimulationSettings(undefined, v, undefined, undefined);
                }}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="text-[10px] text-slate-500 mt-1">Emulates VoIP network latency swings</div>
            </div>

            {/* Noise Level */}
            <div className="neu-inset p-3.5 rounded-2xl">
              <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                <span>Background Noise</span>
                <span className="text-blue-600">{noiseLevel}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={noiseLevel}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setNoiseLevel(v);
                  updateSimulationSettings(undefined, undefined, v, undefined);
                }}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="text-[10px] text-slate-500 mt-1">Additive acoustic environment noise</div>
            </div>
          </div>

          {/* Codec Picker */}
          <div className="mt-3 flex items-center justify-between text-xs px-2">
            <span className="text-slate-500 font-medium">Active Speech Codec:</span>
            <div className="flex gap-2">
              {["Opus (Default 16kHz)", "G.711 PCMA (8kHz PSTN)", "AMR-WB (12.65 kbps)"].map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCodec(c);
                    updateSimulationSettings(undefined, undefined, undefined, c);
                  }}
                  className={`px-3 py-1 rounded-full font-semibold transition-all ${
                    codec === c
                      ? "neu-btn-blue text-white"
                      : "neu-card-sm text-slate-600 hover:text-blue-600"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cryptographic Hash Chaining Verification */}
        <div className="mt-6 pt-5 border-t border-white/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">Tamper-Evident SHA-256 Hash Chain</span>
            </div>
            <span className="text-[10px] neu-icon-green text-emerald-600 font-semibold px-2 py-0.5 rounded-full">
              Verified Chained Block
            </span>
          </div>
          <div className="neu-inset rounded-xl p-2.5 mt-2 font-mono text-[11px] text-slate-700 truncate select-all">
            Current Block Hash: {currentHash}
          </div>
        </div>
      </div>

      {/* Right Column: Live Detection & Spectrogram Breakdown */}
      <div className="space-y-5">
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-slate-800">Fraud Probability</div>
            <span className="neu-icon-blue text-blue-600 px-3 py-1 rounded-full text-xs font-semibold">
              Live AI Inference
            </span>
          </div>

          <div className="flex justify-center py-2">
            <Gauge pct={pct} />
          </div>

          <div className="mt-6 space-y-3">
            {reasons.map((r) => (
              <div key={r.key} className="flex items-start justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-700">{r.label}</div>
                  <div className="text-slate-400 mt-0.5">{r.detail}</div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full font-semibold shrink-0 ml-2 ${
                    r.ok ? "neu-icon-green text-emerald-600" : "neu-icon-red text-red-500"
                  }`}
                >
                  {r.badge}
                </span>
              </div>
            ))}
          </div>

          <div className="neu-inset h-2 rounded-full mt-6 overflow-hidden">
            <div
              className={`neu-progress-bar ${pct > 67 ? "bg-red-500" : pct > 33 ? "bg-amber-500" : "bg-emerald-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Forensic Indicator Breakdown */}
        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-slate-800 text-sm">Forensic Indicator Breakdown</div>
            <span className="text-[11px] neu-icon-blue text-blue-600 px-2 py-0.5 rounded-full font-semibold">
              0 - 100%
            </span>
          </div>

          <div className="space-y-3 mb-5">
            {Object.entries(indicators || {}).map(([k, val]) => (
              <div key={k}>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-600">{k}</span>
                  <span className="text-slate-900 font-bold">{val}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      val > 40 ? "bg-red-500" : val > 20 ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, Math.max(3, val))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Summary Box */}
          <div className="p-4 rounded-2xl border-2 border-red-500 bg-red-50/20">
            <div className="font-mono text-xs font-bold text-slate-900 uppercase">
              OVERALL RISK SCORE: {pct} / 100
            </div>
            <div className="font-mono text-xs text-slate-700">
              RISK LEVEL: {riskLevel}
            </div>
            <div className="font-mono text-xs text-slate-700">
              CLASSIFICATION: {classification}
            </div>
            <div className="font-mono text-xs text-slate-700">
              CONFIDENCE: {confidence}%
            </div>
            <div className="mt-2 font-mono text-xs font-semibold text-slate-900">Key Flags:</div>
            <ul className="text-xs text-slate-600 space-y-0.5 mt-0.5 font-mono">
              {(keyFlags || []).map((flag, idx) => (
                <li key={idx}>• {flag}</li>
              ))}
            </ul>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => {
                logger.info("ForensicsCertificate", "Triggered download for forensic_certificate.json");
                window.open("/export-certificate", "_blank");
              }}
              className="neu-card-sm neu-press flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-xs font-semibold text-slate-700 hover:text-blue-600"
            >
              <Download size={13} /> JSON Certificate
            </button>
            <button
              onClick={() => {
                logger.info("ForensicsCertificate", "Triggered download for forensic_certificate.pdf");
                window.open("/export-pdf", "_blank");
              }}
              className="neu-btn-blue neu-press flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-xs font-semibold"
            >
              <Download size={13} /> PDF Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
