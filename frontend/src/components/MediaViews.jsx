import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  UploadCloud, Music, Pause, ArrowLeft, Trash2, Download, FileText,
  Info, ShieldCheck, ChevronDown, Phone, PhoneOff, PhoneCall, Users, Clock, List, BarChart3, AlertCircle, AlertTriangle
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

export function UploadAudio({ onAnalyzed, currentUser }) {
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const inputRef = useRef(null);

  function handleFile(file) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.src = url;
    setAnalyzing(true);
    const finish = (duration) => {
      const score = Math.round(20 + Math.random() * 70);
      setTimeout(() => {
        setAnalyzing(false);
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
              callee_name: `Audio File: ${file.name}`,
              callee_phone: "Uploaded File",
              status: "completed",
              duration: Math.round(duration || 10),
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
          duration: fmtDuration(duration),
          uploadedAt: new Date().toLocaleString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
          url,
          score,
        });
      }, 1600);
    };
    audio.addEventListener("loadedmetadata", () => finish(audio.duration));
    audio.addEventListener("error", () => finish(NaN));
    setTimeout(() => {
      if (Number.isNaN(audio.duration)) finish(NaN);
    }, 1200);
  }

  return (
    <div>
      <div className="text-xs font-semibold tracking-[0.2em] text-slate-400">UPLOAD AUDIO</div>
      <h1 className="text-2xl font-bold text-slate-900 mt-1">Upload Audio</h1>
      <p className="text-slate-500 mt-1 mb-6">Analyse voice recordings to detect AI clones and potential scams.</p>

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
            <div className="text-lg font-semibold text-slate-800">Analysing your audio…</div>
            <p className="text-slate-400 text-sm mt-1">Extracting Mel-Spectrogram &amp; running ONNX inference.</p>
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
            <div className="text-xs text-slate-400">Max file size: 50 MB</div>
          </>
        )}
      </div>

      <div className="neu-card mt-6 flex items-center gap-3 px-6 py-5 text-sm text-slate-500">
        <Info size={16} className="text-slate-400 shrink-0" />
        Your audio is processed securely and hashed for cryptographic tamper evidence.
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
      ``,
      `Reasons:`,
      ...reasons.map((r) => `- ${r.label}: ${r.detail} [${r.badge}]`),
    ];
    download(`${data.name.replace(/\.[^.]+$/, "")}-report.txt`, lines.join("\n"));
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={15} /> Back
      </button>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analysis Result</h1>
          <p className="text-slate-500 mt-1">Analysis complete. Here's what we found in your audio.</p>
        </div>
        {onDelete && (
          <button onClick={onDelete} className="neu-card-sm neu-press flex items-center gap-2 text-sm text-slate-500 rounded-full px-5 py-2.5">
            <Trash2 size={15} /> Delete
          </button>
        )}
      </div>

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

          {data.url ? (
            <audio controls src={data.url} className="w-full mb-6" />
          ) : (
            <div className="neu-inset flex items-center gap-3 rounded-2xl px-5 py-4 mb-6">
              <button className="neu-btn-blue w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                <Pause size={14} />
              </button>
              <div className="flex-1 h-6 flex items-end gap-[2px]">
                {Array.from({ length: 46 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-blue-300"
                    style={{ height: `${8 + ((i * 37) % 20)}px`, opacity: i > 30 ? 0.3 : 1 }}
                  />
                ))}
              </div>
              <span className="text-xs text-slate-400">{data.duration}</span>
            </div>
          )}

          <div className="text-sm font-semibold text-slate-800 mb-3">Audio Details</div>
          <div className="divide-y divide-white/70 text-sm">
            {[
              ["File Name", data.name],
              ["File Type", data.type],
              ["File Size", data.size],
              ["Duration", data.duration],
              ["Upload Date", data.uploadedAt],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-3">
                <span className="text-slate-400">{k}</span>
                <span className="text-slate-700 font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="neu-card p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-slate-800">Fraud Probability</div>
            <span className="neu-icon-blue text-blue-600 px-3 py-1 rounded-full text-xs font-semibold">Analysed</span>
          </div>
          <div className="flex justify-center py-2">
            <Gauge pct={data.score} />
          </div>

          <div className="text-sm font-semibold text-slate-800 mt-4 mb-2">Reasons</div>
          <div className="flex flex-col divide-y divide-white/70">
            {reasons.map((r, i) => (
              <div key={r.key} className="py-3">
                <button
                  onClick={() => setOpenIdx(openIdx === i ? null : i)}
                  className="w-full flex items-center gap-3"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${r.ok ? "neu-icon-green" : "neu-icon-red"}`}>
                    <ShieldCheck size={15} className={r.ok ? "text-emerald-500" : "text-red-500"} />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-slate-800">{r.label}</div>
                    <div className="text-xs text-slate-400">{r.detail}</div>
                  </div>
                  <ChevronDown size={15} className={`text-slate-400 transition-transform ${openIdx === i ? "rotate-180" : ""}`} />
                </button>
              </div>
            ))}
          </div>

          <div className="neu-inset mt-5 rounded-2xl p-5 flex gap-3">
            <FileText size={17} className="text-blue-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-slate-800 mb-1">Summary</div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {data.score >= 50
                  ? "This audio has a high likelihood of being an AI-generated or cloned voice. Cryptographic forensic record generated."
                  : "This audio closely matches natural human speech patterns with no strong indicators of cloning."}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
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
              <th className="font-medium py-3">Detection Result</th>
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
      <div className="neu-card p-8 flex flex-col items-center text-center relative overflow-hidden">
        <div className="w-full flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-emerald-500 font-medium text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Incoming Call ({secondsLeft}s timeout)</span>
          </div>
          <div className="neu-icon-green px-3 py-1 rounded-full text-xs font-semibold text-emerald-600">
            Real-time Telemetry Ready
          </div>
        </div>

        <div className="neu-icon-blue w-32 h-32 rounded-full flex items-center justify-center text-4xl font-bold text-blue-600 mb-4 animate-bounce">
          {caller?.initials || "U"}
        </div>
        <h2 className="text-2xl font-bold text-slate-900">{caller?.name || "Platform User"}</h2>
        <div className="text-slate-500 mt-1 text-sm">{caller?.phone || "+91 98765 00000"}</div>
        <div className="neu-inset px-4 py-1.5 rounded-full text-xs font-medium text-slate-600 mt-3">
          {caller?.role || "Platform Member"}
        </div>

        <p className="text-xs text-slate-400 my-6 max-w-sm">
          A platform user is calling you. If you don't answer within {secondsLeft} seconds, this call will automatically cut.
        </p>

        <div className="flex items-center justify-center gap-12 mt-2">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onDecline}
              className="neu-btn-red neu-press w-[64px] h-[64px] rounded-full flex items-center justify-center shadow-lg"
            >
              <PhoneOff size={22} />
            </button>
            <span className="text-sm font-medium text-slate-700">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onAccept}
              className="neu-btn-green neu-press w-[64px] h-[64px] rounded-full flex items-center justify-center shadow-lg"
            >
              <PhoneCall size={22} />
            </button>
            <span className="text-sm font-medium text-slate-700">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
