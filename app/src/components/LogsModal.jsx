import React, { useState, useEffect, useRef } from "react";
import { Terminal, Download, Trash2, RefreshCw, X, Search, CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";
import logger from "../utils/logger";
import { apiUrl } from "../utils/api";

export default function LogsModal({ isOpen, onClose }) {
  const [tab, setTab] = useState("frontend"); // 'frontend' | 'backend' | 'audit'
  const [frontendLogs, setFrontendLogs] = useState([]);
  const [backendLogs, setBackendLogs] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [loadingBackend, setLoadingBackend] = useState(false);
  const scrollRef = useRef(null);

  // Subscribe to live frontend logs
  useEffect(() => {
    setFrontendLogs(logger.getLogs());
    const unsubscribe = logger.subscribe((_, allLogs) => {
      setFrontendLogs([...allLogs]);
    });
    return unsubscribe;
  }, []);

  // Fetch backend logs
  async function fetchBackendLogs(type = "app") {
    setLoadingBackend(true);
    try {
      const res = await fetch(apiUrl(`/api/logs?type=${type}&lines=250`));
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        if (type === "audit") {
          setAuditLogs(data.logs);
        } else {
          setBackendLogs(data.logs);
        }
      }
    } catch (err) {
      console.error("Failed fetching backend logs:", err);
    } finally {
      setLoadingBackend(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      if (tab === "backend") fetchBackendLogs("app");
      if (tab === "audit") fetchBackendLogs("audit");
    }
  }, [isOpen, tab]);

  // Auto scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [frontendLogs, backendLogs, auditLogs, autoScroll]);

  if (!isOpen) return null;

  function handleDownload() {
    let content = "";
    let filename = "";
    if (tab === "frontend") {
      content = logger.exportLogsText();
      filename = `beyond404-frontend-${Date.now()}.log`;
    } else if (tab === "backend") {
      content = backendLogs.join("\n");
      filename = `beyond404-backend-${Date.now()}.log`;
    } else {
      content = auditLogs.join("\n");
      filename = `beyond404-audit-${Date.now()}.jsonl`;
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Filter logs
  const displayedLogs = (tab === "frontend" ? frontendLogs : tab === "backend" ? backendLogs : auditLogs).filter((log) => {
    const text = typeof log === "string" ? log : `${log.level} ${log.scope} ${log.message}`;
    const matchesSearch = text.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (tab === "frontend" && filterLevel !== "ALL") {
      return log.level === filterLevel;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-fadeIn">
      <div className="neu-card w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-white/80">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/60 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="neu-icon-blue w-9 h-9 rounded-xl flex items-center justify-center">
              <Terminal size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">System &amp; Forensic Telemetry Logs</h2>
              <p className="text-xs text-slate-400">Real-time gateway audits and client telemetry</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="neu-card-sm neu-press px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              title="Download Logs"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Export</span>
            </button>
            {tab === "frontend" && (
              <button
                onClick={() => logger.clearLogs()}
                className="neu-card-sm neu-press px-3 py-1.5 rounded-xl text-xs font-semibold text-red-600 flex items-center gap-1.5"
                title="Clear Client Logs"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="neu-card-sm neu-press p-2 rounded-xl text-slate-400 hover:text-slate-700"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tab Controls & Filters */}
        <div className="px-6 py-3 border-b border-white/60 bg-white/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("frontend")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                tab === "frontend"
                  ? "neu-btn-blue text-white shadow-sm"
                  : "neu-card-sm text-slate-600 hover:text-slate-900"
              }`}
            >
              Client Telemetry ({frontendLogs.length})
            </button>
            <button
              onClick={() => setTab("backend")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                tab === "backend"
                  ? "neu-btn-blue text-white shadow-sm"
                  : "neu-card-sm text-slate-600 hover:text-slate-900"
              }`}
            >
              Gateway Server ({backendLogs.length})
            </button>
            <button
              onClick={() => setTab("audit")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                tab === "audit"
                  ? "neu-btn-blue text-white shadow-sm"
                  : "neu-card-sm text-slate-600 hover:text-slate-900"
              }`}
            >
              Forensic Audit Chain ({auditLogs.length})
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter logs..."
                className="neu-inset pl-8 pr-3 py-1 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 outline-none w-36 sm:w-48"
              />
            </div>

            {tab === "frontend" && (
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="neu-inset px-2.5 py-1 rounded-xl text-xs text-slate-700 outline-none"
              >
                <option value="ALL">ALL LEVELS</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="DEBUG">DEBUG</option>
              </select>
            )}

            {(tab === "backend" || tab === "audit") && (
              <button
                onClick={() => fetchBackendLogs(tab === "audit" ? "audit" : "app")}
                disabled={loadingBackend}
                className="neu-card-sm p-1.5 rounded-xl text-slate-600 hover:text-blue-600 disabled:opacity-50"
                title="Refresh from Gateway"
              >
                <RefreshCw size={13} className={loadingBackend ? "animate-spin text-blue-600" : ""} />
              </button>
            )}
          </div>
        </div>

        {/* Log Viewer Screen */}
        <div
          ref={scrollRef}
          className="flex-1 bg-[#181d28] text-slate-200 p-4 font-mono text-xs overflow-y-auto space-y-1 select-text"
          style={{ scrollBehavior: "smooth" }}
        >
          {displayedLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500 italic">
              {loadingBackend ? "Fetching records from gateway..." : "No matching log entries."}
            </div>
          ) : (
            displayedLogs.map((entry, idx) => {
              if (typeof entry === "string") {
                const isErr = entry.includes("[ERROR]") || entry.includes("ERR");
                const isWarn = entry.includes("[WARNING]") || entry.includes("WARN");
                return (
                  <div
                    key={idx}
                    className={`leading-relaxed whitespace-pre-wrap break-all ${
                      isErr ? "text-red-400 font-semibold" : isWarn ? "text-amber-400" : "text-slate-300"
                    }`}
                  >
                    {entry}
                  </div>
                );
              }

              const levelColors = {
                INFO: "text-emerald-400",
                WARN: "text-amber-400 font-semibold",
                ERROR: "text-red-400 font-bold",
                DEBUG: "text-blue-400",
              };

              return (
                <div key={entry.id || idx} className="flex items-start gap-2 hover:bg-slate-800/40 px-1 py-0.5 rounded">
                  <span className="text-slate-500 shrink-0">{entry.time}</span>
                  <span className={`shrink-0 w-12 ${levelColors[entry.level] || "text-slate-400"}`}>
                    [{entry.level}]
                  </span>
                  <span className="text-purple-400 font-semibold shrink-0">[{entry.scope}]</span>
                  <span className="text-slate-200 break-all">{entry.message}</span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 bg-slate-50/70 border-t border-white/60 flex items-center justify-between text-xs text-slate-500">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-blue-600 rounded"
            />
            <span>Auto-scroll to bottom</span>
          </label>
          <div>
            Showing <strong className="text-slate-700">{displayedLogs.length}</strong> events
          </div>
        </div>
      </div>
    </div>
  );
}
