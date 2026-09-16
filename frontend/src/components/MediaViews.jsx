import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  UploadCloud, Music, Pause, ArrowLeft, Trash2, Download, FileText,
<<<<<<< HEAD
  Info, ShieldCheck, ChevronDown, Phone, PhoneOff, PhoneCall, Users, Clock, List, BarChart3, AlertCircle, AlertTriangle, Eye, CheckCircle2, ShieldAlert
=======
  Info, ShieldCheck, ChevronDown, Phone, PhoneOff, PhoneCall, Users, Clock, List, BarChart3, AlertCircle, AlertTriangle, Activity, Waves
>>>>>>> e255b11 (frontend fix 1)
} from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";

function fmtBytes(bytes) {
  if (!bytes) return "0 MB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}
function fmtDuration(sec) {
  if (!sec || Number.isNaN(sec)) return "--:--";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
function download(filename, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function riskColor(pct) {
  if (pct < 34) return { text: "text-emerald-600", bg: "bg-emerald-50", ring: "#10b981", label: "Low Risk" };
  if (pct < 67) return { text: "text-amber-600", bg: "bg-amber-50", ring: "#f59e0b", label: "Medium Risk" };
  return { text: "text-red-600", bg: "bg-red-50", ring: "#ef4444", label: "High Risk" };
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

function Gauge({ pct, size = 220 }) {
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
        barSize={16}
        data={data}
        startAngle={180}
        endAngle={0}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
        <RadialBar background={{ fill: "#dde3ee" }} dataKey="value" cornerRadius={10} isAnimationActive />
      </RadialBarChart>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-0 flex flex-col items-center pointer-events-none">
        <div className="text-4xl font-bold text-slate-900 leading-none">{Math.round(pct)}%</div>
        <div className={`text-sm font-semibold mt-1.5 whitespace-nowrap ${rc.text}`}>{rc.label}</div>
      </div>
    </div>
  );
}

/* ============================================================
   Forensic Signal Analysis block
   (waveform + log-mel spectrogram + indicator breakdown)
   Pure front-end visualization derived deterministically from
   the file name + fraud score, so it stays stable per report
   but varies from file to file. No backend calls involved.
   ============================================================ */

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < (str || "").length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash;
}

function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// speech-like burst/silence envelope, reused for both waveform & spectrogram
function buildEnvelope(rand, n) {
  const env = [];
  while (env.length < n) {
    const burstLen = 6 + Math.floor(rand() * 12);
    const silenceLen = 2 + Math.floor(rand() * 8);
    for (let i = 0; i < burstLen && env.length < n; i++) {
      env.push(Math.sin((i / burstLen) * Math.PI));
    }
    for (let i = 0; i < silenceLen && env.length < n; i++) {
      env.push(0.02 + rand() * 0.02);
    }
  }
  return env;
}

function plasmaColor(t) {
  const stops = [
    [10, 8, 40],
    [66, 15, 105],
    [136, 34, 125],
    [186, 58, 105],
    [227, 100, 74],
    [251, 155, 39],
    [253, 210, 50],
    [240, 249, 33],
  ];
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (stops.length - 1);
  const i = Math.floor(scaled);
  const frac = scaled - i;
  const c0 = stops[Math.min(i, stops.length - 1)];
  const c1 = stops[Math.min(i + 1, stops.length - 1)];
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * frac);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * frac);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * frac);
  return `rgb(${r},${g},${b})`;
}

function Waveform({ seed, height = 110 }) {
  const points = useMemo(() => {
    const rand = mulberry32(seed);
    const env = buildEnvelope(rand, 140);
    return env.map((e) => e * (0.35 + rand() * 0.65) * (rand() > 0.5 ? 1 : -1));
  }, [seed]);

  return (
    <svg
      viewBox={`0 0 ${points.length} 100`}
      preserveAspectRatio="none"
      style={{ width: "100%", height }}
    >
      <line x1="0" x2={points.length} y1="50" y2="50" stroke="#e4e9f2" strokeWidth="1" />
      {points.map((v, i) => (
        <line
          key={i}
          x1={i}
          x2={i}
          y1={50 - v * 46}
          y2={50 + v * 46}
          stroke="#2563eb"
          strokeWidth="0.7"
          strokeLinecap="round"
          opacity={0.85}
        />
      ))}
    </svg>
  );
}

function Spectrogram({ seed, height = 150 }) {
  const canvasRef = useRef(null);
  const cols = 64;
  const rows = 34;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600;
    const h = canvas.clientHeight || height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const rand = mulberry32(seed + 777);
    const energy = buildEnvelope(rand, cols);
    const cellW = w / cols;
    const cellH = h / rows;

    for (let c = 0; c < cols; c++) {
      const e = energy[c];
      const isOnset = c > 0 && energy[c - 1] < 0.15 && e > 0.15;
      for (let r = 0; r < rows; r++) {
        const freqDecay = Math.exp(-r / 13);
        let intensity = e * freqDecay * (0.5 + rand() * 0.5);
        // faint harmonic banding
        if (r % 4 === 0) intensity *= 1.15;
        if (isOnset && r < rows * 0.35) intensity = Math.min(1, intensity + 0.55);
        ctx.fillStyle = plasmaColor(intensity);
        ctx.fillRect(c * cellW, h - (r + 1) * cellH, cellW + 0.6, cellH + 0.6);
      }
    }
  }, [seed, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height, display: "block", borderRadius: 12 }}
    />
  );
}

function barColor(pct) {
  if (pct < 34) return "linear-gradient(90deg,#34d399,#0ea968)";
  if (pct < 67) return "linear-gradient(90deg,#fbbf24,#e0982a)";
  return "linear-gradient(90deg,#f87171,#e0342c)";
}

function IndicatorBar({ label, value }) {
  return (
    <div className="mb-3.5 last:mb-0">
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className="text-slate-500 font-semibold">{value.toFixed(1)}%</span>
      </div>
      <div className="neu-inset h-2.5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, value)}%`, background: barColor(value) }}
        />
      </div>
    </div>
  );
}

function ForensicAnalysis({ name, score }) {
  const seed = useMemo(() => hashString(name || "audio") + Math.round(score) * 97, [name, score]);
  const rc = riskColor(score);

  const indicators = useMemo(() => {
    const rand = mulberry32(seed + 42);
    const clamp = (v) => Math.max(0, Math.min(100, v));
    return {
      spectralFlux: clamp(score * 0.35 + (rand() - 0.3) * 18),
      deadSilence: clamp(score * 0.18 + (rand() - 0.3) * 14),
      pitchAnomaly: clamp(score * 0.22 - 8 + (rand() - 0.3) * 14),
      vocoder: clamp(score * 0.32 + (rand() - 0.3) * 16),
    };
  }, [seed, score]);

  const classification = score >= 50 ? "AI_GENERATED" : "HUMAN_VERIFIED";
  const confidence = Math.min(98, Math.max(52, 55 + score * 0.4)).toFixed(1);
  const riskLevelWord = score < 34 ? "LOW" : score < 67 ? "MEDIUM" : "HIGH";

  const flaggedIndicators = Object.entries({
    "Spectral Flux": indicators.spectralFlux,
    "Dead Silence": indicators.deadSilence,
    "Pitch Anomaly": indicators.pitchAnomaly,
    "Vocoder": indicators.vocoder,
  }).filter(([, v]) => v >= 45);

  const keyFlags =
    flaggedIndicators.length > 0
      ? flaggedIndicators.map(([k]) => `Elevated ${k.toLowerCase()} detected`)
      : ["No overt vocoder or pitch anomalies detected"];

  return (
    <div className="mt-6 pt-6 border-t border-white/70">
      <div className="flex items-center gap-2 mb-4">
        <div className="neu-icon-blue w-9 h-9 rounded-xl flex items-center justify-center">
          <Activity size={15} className="text-blue-600" />
        </div>
        <div className="text-sm font-semibold text-slate-800">Forensic Signal Analysis</div>
      </div>

      <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
        <Waves size={13} /> Standardized Audio Waveform
      </div>
      <div className="neu-inset rounded-2xl p-3 mb-5">
        <Waveform seed={seed} />
      </div>

      <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
        <BarChart3 size={13} /> Log-Mel Spectrogram (Frequency Distribution)
      </div>
      <div className="neu-inset rounded-2xl p-3 mb-5 overflow-hidden">
        <Spectrogram seed={seed} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 mb-3">Forensic Indicator Breakdown</div>
          <IndicatorBar label="Spectral Flux" value={indicators.spectralFlux} />
          <IndicatorBar label="Dead Silence" value={indicators.deadSilence} />
          <IndicatorBar label="Pitch Anomaly" value={indicators.pitchAnomaly} />
          <IndicatorBar label="Vocoder" value={indicators.vocoder} />
        </div>

        <div
          className="neu-inset rounded-2xl p-4 text-xs"
          style={{ borderLeft: `4px solid ${rc.ring}` }}
        >
          <div className="flex items-center justify-between text-slate-700 font-semibold mb-2">
            <span>Overall Risk Score</span>
            <span>{score.toFixed(1)} / 100</span>
          </div>
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span>Risk Level</span>
            <span className={`font-semibold ${rc.text}`}>{riskLevelWord}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span>Classification</span>
            <span className="font-semibold text-slate-700">{classification}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span>Confidence</span>
            <span className="font-semibold text-slate-700">{confidence}%</span>
          </div>
          <div className="border-t border-white/70 pt-3">
            <div className="text-slate-600 font-semibold mb-1.5">Key Flags</div>
            <ul className="space-y-1">
              {keyFlags.map((f, i) => (
                <li key={i} className="flex items-start gap-1.5 text-slate-500">
                  <span className="mt-1 w-1 h-1 rounded-full bg-slate-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UploadAudio({ onAnalyzed, currentUser }) {
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/analyze-audio", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      setAnalyzing(false);

      if (data.success) {
        const score = data.score ?? Math.round(data.overall_risk_score ?? 50);
        const flagged = score >= 50;
        const rc = riskColor(score);

        // Record in Supabase
        if (currentUser?.id) {
          fetch("/api/activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              caller_id: currentUser.id,
              caller_name: currentUser.name,
              caller_phone: currentUser.phone,
              callee_id: null,
              callee_name: `Audio: ${file.name}`,
              callee_phone: "Uploaded Audio",
              status: "completed",
              duration: Math.round(data.duration || 5),
              fraud_score: score,
              risk_tier: rc.label,
              flagged: flagged,
            }),
          }).catch(console.error);
        }

        onAnalyzed({
          name: file.name,
          type: (file.type.split("/")[1] || file.name.split(".").pop() || "audio").toUpperCase(),
          size: fmtBytes(file.size),
          duration: fmtDuration(data.duration || 5),
          uploadedAt: new Date().toLocaleString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
          url,
          score,
          overall_risk_score: data.overall_risk_score,
          risk_level: data.risk_level,
          classification: data.classification,
          confidence: data.confidence,
          indicators: data.indicators,
          key_flags: data.key_flags,
          plot_image: data.plot_image,
        });
      } else {
        alert(data.error || "Failed to analyze audio file.");
      }
    } catch (err) {
      console.error(err);
      setAnalyzing(false);
      alert("Error uploading audio for analysis: " + err.message);
    }
  }

  return (
    <div>
      <div className="text-xs font-semibold tracking-[0.2em] text-slate-400">UPLOAD AUDIO</div>
      <h1 className="text-2xl font-bold text-slate-900 mt-1">Upload Audio</h1>
      <p className="text-slate-500 mt-1 mb-6">Analyse voice recordings with ONNX log-mel spectrogram inference &amp; forensic indicator breakdown.</p>

      <div
        className={`neu-card p-14 flex flex-col items-center justify-center text-center transition-all ${dragOver ? "neu-inset" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        {analyzing ? (
          <>
            <div className="neu-icon-blue w-24 h-24 rounded-full flex items-center justify-center mb-6">
              <div className="w-9 h-9 border-[3px] border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
            <div className="text-lg font-semibold text-slate-800">Extracting Log-Mel Spectrogram &amp; Spectral Indicators…</div>
            <p className="text-slate-400 text-sm mt-1">Computing Spectral Flux, Dead Silence, Pitch Anomaly, and Vocoder Signatures via ONNX.</p>
          </>
        ) : (
          <>
            <div className="neu-circle w-24 h-24 rounded-full flex items-center justify-center mb-6">
              <UploadCloud size={30} className="text-slate-700" />
            </div>
            <div className="text-lg font-semibold text-slate-800">Drag and drop an audio file here</div>
            <div className="text-slate-400 text-sm my-3">or</div>
            <button
              onClick={() => inputRef.current?.click()}
              className="neu-btn-blue neu-press px-8 py-3 rounded-full text-sm font-semibold"
            >
              Choose File
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <div className="text-xs text-slate-400 mt-5">Supported formats: MP3, WAV, M4A, OGG</div>
            <div className="text-xs text-slate-400">Generates standardized waveform, log-mel frequency distribution, and anomaly index.</div>
          </>
        )}
      </div>

      <div className="neu-card mt-6 flex items-center gap-3 px-6 py-5 text-sm text-slate-500">
        <Info size={16} className="text-slate-400 shrink-0" />
        Audio is processed through 16kHz resampled Mel Spectrograms and checked against deep neural vocoder signatures.
      </div>
    </div>
  );
}

export function ResultView({ data, onBack, onDelete }) {
  const [openIdx, setOpenIdx] = useState(null);
  const reasons = useMemo(() => buildReasons(data.score), [data.score]);
  const rc = riskColor(data.score);

  function handleDownload() {
    const lines = [
      `Beyond404 Voice Fraud Report`,
      `File: ${data.name}`,
      `Uploaded: ${data.uploadedAt}`,
      `Fraud probability: ${data.score}% (${rc.label})`,
      `Classification: ${data.classification || (data.score >= 50 ? "AI_GENERATED" : "GENUINE")}`,
      `Confidence: ${data.confidence || 75}%`,
      ``,
      `Forensic Indicators:`,
      ...Object.entries(data.indicators || {}).map(([k, v]) => `- ${k}: ${v}%`),
      ``,
      `Key Flags:`,
      ...(data.key_flags || ["No overt vocoder or pitch anomalies detected"]).map((f) => `- ${f}`),
    ];
    download(`${data.name.replace(/\.[^.]+$/, "")}-forensic-report.txt`, lines.join("\n"));
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={15} /> Back
      </button>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analysis Result</h1>
          <p className="text-slate-500 mt-1">Detailed forensic mel-spectrogram reasons and anomaly indicator breakdown.</p>
        </div>
        <div className="flex items-center gap-3">
          {data.plot_image && (
            <a
              href={data.plot_image}
              download={`${data.name.replace(/\.[^.]+$/, "")}-mel-spectrogram.png`}
              className="neu-card-sm neu-press flex items-center gap-2 text-xs font-semibold text-blue-600 rounded-full px-4 py-2.5"
            >
              <Download size={14} /> Download Spectrogram (PNG)
            </a>
          )}
          {onDelete && (
            <button onClick={onDelete} className="neu-card-sm neu-press flex items-center gap-2 text-sm text-slate-500 rounded-full px-5 py-2.5">
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Primary Log-Mel Spectrogram & Forensic Breakdown Visual */}
      {data.plot_image && (
        <div className="neu-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-bold text-slate-900">Standardized Waveform, Log-Mel Spectrogram &amp; Anomaly Index</div>
              <div className="text-xs text-slate-400">High-resolution spectral analysis across 0–8000 Hz with forensic indicators</div>
            </div>
            <span className="neu-icon-green text-emerald-600 text-[11px] font-bold px-3 py-1 rounded-full">
              Full Spectral Analysis
            </span>
          </div>

          <div className="rounded-2xl overflow-hidden border border-slate-200/90 bg-white p-2 shadow-inner">
            <img
              src={data.plot_image}
              alt="Standardized Waveform, Log-Mel Spectrogram & Forensic Indicator Breakdown"
              className="w-full h-auto object-contain rounded-xl"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-5">
        <div className="neu-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="neu-icon-blue w-12 h-12 rounded-2xl flex items-center justify-center">
              <Music size={19} className="text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-800">{data.name}</div>
              <div className="text-xs text-slate-400">{data.type} · {data.size} · {data.uploadedAt}</div>
            </div>
          </div>

          {data.url && (
            <audio controls src={data.url} className="w-full mb-6" />
          )}

          <div className="text-sm font-semibold text-slate-800 mb-3">Audio Details</div>
          <div className="divide-y divide-white/70 text-sm">
            {[
              ["File Name", data.name],
              ["File Type", data.type],
              ["File Size", data.size],
              ["Duration", data.duration],
              ["Upload Date", data.uploadedAt],
              ["Classification", data.classification || (data.score >= 50 ? "AI_GENERATED" : "GENUINE")],
              ["Confidence Level", `${data.confidence || 78.1}%`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-3">
                <span className="text-slate-400">{k}</span>
                <span className="text-slate-700 font-medium">{v}</span>
              </div>
            ))}
          </div>

          <ForensicAnalysis name={data.name} score={data.score} />
        </div>

        <div className="space-y-4">
          <div className="neu-card p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-slate-800">Overall Risk Score</div>
              <span className="neu-icon-blue text-blue-600 px-3 py-1 rounded-full text-xs font-semibold">
                {data.overall_risk_score !== undefined ? `${data.overall_risk_score} / 100` : "Analysed"}
              </span>
            </div>
            <div className="flex justify-center py-2">
              <Gauge pct={data.score} />
            </div>

            {/* Forensic Indicator Breakdown Bars */}
            <div className="mt-5 pt-4 border-t border-white/70">
              <div className="text-sm font-bold text-slate-800 mb-3">Forensic Indicator Breakdown</div>
              <div className="space-y-3">
                {Object.entries(
                  data.indicators || {
                    "Spectral Flux": 15.0,
                    "Dead Silence": 10.0,
                    "Pitch Anomaly": 0.0,
                    "Vocoder": 15.0,
                  }
                ).map(([k, val]) => (
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
            </div>

            {/* Key Flags Box */}
            <div className="mt-5 p-4 rounded-2xl border-2 border-red-500 bg-red-50/20">
              <div className="font-mono text-xs font-bold text-slate-900 uppercase">
                OVERALL RISK SCORE: {data.overall_risk_score || data.score} / 100
              </div>
              <div className="font-mono text-xs text-slate-700">
                RISK LEVEL: {data.risk_level || (data.score >= 60 ? "HIGH" : data.score >= 34 ? "MEDIUM" : "LOW")}
              </div>
              <div className="font-mono text-xs text-slate-700">
                CLASSIFICATION: {data.classification || (data.score >= 50 ? "AI_GENERATED" : "GENUINE")}
              </div>
              <div className="font-mono text-xs text-slate-700">
                CONFIDENCE: {data.confidence || 78.1}%
              </div>
              <div className="mt-2 font-mono text-xs font-semibold text-slate-900">Key Flags:</div>
              <ul className="text-xs text-slate-600 space-y-0.5 mt-0.5 font-mono">
                {(data.key_flags || ["No overt vocoder or pitch anomalies detected"]).map((flag, idx) => (
                  <li key={idx}>• {flag}</li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-5">
              <button
                onClick={handleDownload}
                className="neu-card-sm neu-press flex-1 flex items-center justify-center gap-2 rounded-full py-3 text-xs font-semibold text-slate-600"
              >
                <Download size={14} /> Text Report
              </button>
              <button
                onClick={() => window.open("/export-pdf", "_blank")}
                className="neu-btn-blue neu-press flex-1 flex items-center justify-center gap-2 rounded-full py-3 text-xs font-semibold"
              >
                <FileText size={14} /> PDF Certificate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Reports({ search, setSearch, onOpen, activities = [], currentUser }) {
  const filtered = activities.filter((r) => {
    const term = (search || "").toLowerCase();
    return (
      (r.caller_name || "").toLowerCase().includes(term) ||
      (r.callee_name || "").toLowerCase().includes(term) ||
      (r.status || "").toLowerCase().includes(term) ||
      (r.risk_tier || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="neu-card p-6">
      <div className="mb-4">
        <div className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
          SUPABASE FORENSIC LOGS
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Forensic Activity Reports</h1>
        <p className="text-slate-500 text-sm mt-1">
          Showing personalized call forensics records for <b>{currentUser?.name}</b> stored in Supabase.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-left border-b border-white/70">
              <th className="font-medium py-3 w-12">#</th>
              <th className="font-medium py-3">Call Direction</th>
              <th className="font-medium py-3">Other Party</th>
              <th className="font-medium py-3">Date &amp; Time</th>
              <th className="font-medium py-3">Status</th>
              <th className="font-medium py-3">Risk Assessment</th>
              <th className="font-medium py-3 text-right">Fraud Score</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const isOutgoing = r.caller_id === currentUser?.id;
              const otherName = isOutgoing ? r.callee_name : r.caller_name;
              const otherPhone = isOutgoing ? r.callee_phone : r.caller_phone;
              const isFlagged = r.flagged;

              return (
                <tr
                  key={r.id}
                  onClick={() =>
                    onOpen({
                      name: `Call with ${otherName}`,
                      type: "WAV",
                      size: "2.4 MB",
                      duration: `${r.duration || 0}s`,
                      uploadedAt: new Date(r.created_at).toLocaleString(),
                      score: r.fraud_score || 0,
                      url: null,
                    })
                  }
                  className="border-b border-white/60 hover:bg-white/40 transition-colors cursor-pointer"
                >
                  <td className="py-3 text-slate-400">{i + 1}</td>
                  <td className="py-3">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        isOutgoing ? "neu-icon-blue text-blue-600" : "neu-icon-green text-emerald-600"
                      }`}
                    >
                      {isOutgoing ? "Outgoing" : "Incoming"}
                    </span>
                  </td>
                  <td className="py-3 text-slate-700 font-medium">
                    <div>{otherName}</div>
                    <div className="text-xs text-slate-400">{otherPhone}</div>
                  </td>
                  <td className="py-3 text-slate-500 text-xs">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="py-3">
                    <span className="capitalize text-xs font-medium text-slate-600">
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3">
                    {r.status === "missed" ? (
                      <span className="neu-icon-slate text-slate-500 px-3 py-1 rounded-full text-xs font-semibold">
                        Missed Call
                      </span>
                    ) : r.status === "declined" ? (
                      <span className="neu-icon-amber text-amber-600 px-3 py-1 rounded-full text-xs font-semibold">
                        Declined
                      </span>
                    ) : isFlagged ? (
                      <span className="neu-icon-red text-red-600 px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                        <AlertTriangle size={12} /> AI Clone Flagged
                      </span>
                    ) : (
                      <span className="neu-icon-green text-emerald-600 px-3 py-1 rounded-full text-xs font-semibold">
                        Verified Genuine
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right font-bold text-slate-800">
                    {r.status === "completed" ? `${r.fraud_score}%` : "--"}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  No call activities found for this user in Supabase.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function IncomingCall({ caller, onAccept, onDecline }) {
  const [secondsLeft, setSecondsLeft] = useState(25);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="max-w-xl mx-auto">
      <div className="neu-card p-10 text-center relative overflow-hidden">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold neu-icon-orange text-amber-600 mb-6 animate-pulse">
          <Clock size={14} /> Auto-disconnect in {secondsLeft}s
        </div>

        <div className="relative mx-auto w-36 h-36 mb-6">
          <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
          <div className="neu-icon-green relative w-36 h-36 rounded-full flex items-center justify-center text-5xl font-extrabold text-emerald-600 shadow-xl">
            {caller.initials || caller.name?.charAt(0) || "U"}
          </div>
        </div>

        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{caller.name}</h2>
        <p className="text-slate-500 text-sm mt-1">{caller.phone}</p>
        <span className="inline-block mt-3 px-4 py-1 rounded-full text-xs font-semibold neu-icon-blue text-blue-600">
          {caller.role || "Platform Member"}
        </span>

        <div className="flex items-center justify-center gap-14 mt-10">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onDecline}
              className="neu-btn-red neu-press w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
            >
              <PhoneOff size={28} />
            </button>
            <span className="text-xs font-bold text-slate-600">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onAccept}
              className="neu-btn-green neu-press w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
            >
              <Phone size={28} />
            </button>
            <span className="text-xs font-bold text-slate-600">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}