import React, { useState, useEffect, useRef } from "react";
import { Terminal, Download, Trash2, RefreshCw, X, Search, CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";
import logger from "../utils/logger";

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
      const res = await fetch(`/api/logs?type=${type}&lines=250`);
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
              <h2 className="text-lg font-bold text-slate-900 leading-tight">System Application Logs</h2>
              <p className="text-xs text-slate-500">Live operational &amp; forensic event stream from start to finish</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="neu-card-sm neu-press px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700 flex items-center gap-1.5 hover:text-blue-600"
              title="Download Log File"
            >
              <Download size={13} /> Export Logs
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs & Controls */}
        <div className="px-6 py-3 border-b border-white/60 flex flex-wrap items-center justify-between gap-3 bg-white/40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("frontend")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                tab === "frontend" ? "neu-btn-blue text-white shadow-sm" : "text-slate-600 hover:bg-slate-200/40"
              }`}
            >
              Frontend Client Logs ({frontendLogs.length})
            </button>
            <button
              onClick={() => setTab("backend")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                tab === "backend" ? "neu-btn-blue text-white shadow-sm" : "text-slate-600 hover:bg-slate-200/40"
              }`}
            >
              Backend Gateway Logs ({backendLogs.length})
            </button>
            <button
              onClick={() => setTab("audit")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                tab === "audit" ? "neu-btn-blue text-white shadow-sm" : "text-slate-600 hover:bg-slate-200/40"
              }`}
            >
              Compliance Audit Trail ({auditLogs.length})
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {tab === "frontend" && (
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="neu-inset px-3 py-1 rounded-full text-xs text-slate-700 font-medium outline-none"
              >
                <option value="ALL">All Levels</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="DEBUG">DEBUG</option>
              </select>
            )}

            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter logs..."
                className="neu-inset pl-8 pr-3 py-1 rounded-full text-xs text-slate-700 w-36 sm:w-48 outline-none"
              />
            </div>

            {tab !== "frontend" && (
              <button
                onClick={() => fetchBackendLogs(tab === "audit" ? "audit" : "app")}
                disabled={loadingBackend}
                className="p-1.5 text-slate-500 hover:text-slate-800 rounded-full"
                title="Refresh Backend Logs"
              >
                <RefreshCw size={14} className={loadingBackend ? "animate-spin" : ""} />
              </button>
            )}

            {tab === "frontend" && (
              <button
                onClick={() => logger.clearLogs()}
                className="p-1.5 text-slate-400 hover:text-red-500 rounded-full"
                title="Clear Frontend Logs"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Log Viewer Terminal Body */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs bg-slate-950 text-slate-200 leading-relaxed select-text"
        >
          {displayedLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              No logs match the current criteria.
            </div>
          ) : (
            displayedLogs.map((log, idx) => {
              if (tab === "frontend") {
                const colorClass =
                  log.level === "ERROR"
                    ? "text-red-400"
                    : log.level === "WARN"
                    ? "text-amber-400"
                    : log.level === "DEBUG"
                    ? "text-cyan-400"
                    : "text-emerald-400";

                return (
                  <div key={log.id || idx} className="py-0.5 hover:bg-slate-900/60 px-1 rounded flex items-start gap-2">
                    <span className="text-slate-500 shrink-0">[{log.time}]</span>
                    <span className={`font-semibold shrink-0 ${colorClass}`}>[{log.level.padEnd(5)}]</span>
                    <span className="text-purple-300 shrink-0">[{log.scope}]</span>
                    <span className="text-slate-300 break-all">{log.message}</span>
                  </div>
                );
              } else {
                // Backend or Audit line
                const isError = log.includes("[ERROR") || log.includes("AUTH_FAILED");
                const isWarn = log.includes("[WARN") || log.includes("callee_offline");
                const isBlock = log.includes("Block #") || log.includes("CALL_ACTIVITY_SAVED");
                const color = isError
                  ? "text-red-400"
                  : isWarn
                  ? "text-amber-400"
                  : isBlock
                  ? "text-emerald-400"
                  : "text-slate-300";

                return (
                  <div key={idx} className="py-0.5 hover:bg-slate-900/60 px-1 rounded flex items-start gap-2">
                    <span className="text-slate-600 select-none text-[11px] shrink-0 w-8 text-right">{idx + 1}</span>
                    <span className={`break-all ${color}`}>{log}</span>
                  </div>
                );
              }
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 border-t border-white/60 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Logging Session</span>
            <span className="text-slate-300">|</span>
            <span>Displaying {displayedLogs.length} entries</span>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            <span>Auto-scroll</span>
          </label>
        </div>
      </div>
    </div>
  );
}
