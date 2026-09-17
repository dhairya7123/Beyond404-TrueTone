import React, { useState, useEffect } from "react";
import { Globe, Check, AlertCircle, RefreshCw, X, Shield, Server, ExternalLink } from "lucide-react";
import { getBackendUri, setBackendUri, testBackendConnection, normalizeBackendUri } from "../utils/api";

export default function BackendSettingsModal({ isOpen, onClose, onSaved }) {
  const [inputUri, setInputUri] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const active = getBackendUri();
      setInputUri(active);
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleTest(uriToTest) {
    const target = uriToTest || inputUri;
    if (!target.trim()) {
      setTestResult({ ok: false, message: "Please enter a Backend URI to test." });
      return;
    }
    setTesting(true);
    setTestResult(null);
    const result = await testBackendConnection(target);
    setTestResult(result);
    setTesting(false);
  }

  function handleSave(e) {
    if (e) e.preventDefault();
    const normalized = setBackendUri(inputUri);
    setSaveSuccess(true);
    if (onSaved) onSaved(normalized);
    setTimeout(() => {
      onClose();
    }, 600);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="neu-card w-full max-w-lg p-6 sm:p-7 relative shadow-2xl bg-[#ecf0f3]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/80">
          <div className="flex items-center gap-3">
            <div className="neu-icon-blue w-10 h-10 rounded-xl flex items-center justify-center">
              <Server size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">Backend Gateway Settings</h3>
              <p className="text-xs text-slate-500">Configure Cloudflare Tunnel or backend server URL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="neu-circle w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        {/* Description */}
        <div className="mb-5 text-xs text-slate-600 leading-relaxed">
          Enter your active <strong className="text-blue-600">Cloudflare Tunnel URI</strong> (e.g.{" "}
          <span className="font-mono bg-white/70 px-1.5 py-0.5 rounded text-slate-700">
            https://your-subdomain.trycloudflare.com
          </span>
          ) or local backend address. All mobile and web app features (AI inference, WebRTC call forensics, WebSocket signaling, and Supabase auth) will route through this endpoint.
        </div>

        {/* Input */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Backend Server / Tunnel URI
            </label>
            <div className="relative">
              <Globe size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={inputUri}
                onChange={(e) => {
                  setInputUri(e.target.value);
                  setTestResult(null);
                  setSaveSuccess(false);
                }}
                placeholder="https://your-tunnel.trycloudflare.com"
                className="neu-inset w-full pl-11 pr-4 py-3 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 font-mono outline-none"
                autoFocus
              />
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Quick presets:</span>
            <button
              type="button"
              onClick={() => {
                const u = "http://localhost:8080";
                setInputUri(u);
                handleTest(u);
              }}
              className="neu-card-sm px-2.5 py-1 rounded-lg text-slate-600 hover:text-blue-600 font-mono"
            >
              localhost:8080
            </button>
            <button
              type="button"
              onClick={() => {
                const u = "http://10.0.2.2:8080";
                setInputUri(u);
                handleTest(u);
              }}
              className="neu-card-sm px-2.5 py-1 rounded-lg text-slate-600 hover:text-blue-600 font-mono"
              title="Standard Android emulator loopback"
            >
              10.0.2.2:8080 (Android)
            </button>
          </div>

          {/* Test connection status message */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                testResult.ok
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {testResult.ok ? (
                <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">{testResult.message}</div>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 rounded-xl text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-2">
              <Check size={16} className="text-blue-600 shrink-0" />
              Backend URI updated successfully! Reconnecting services...
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-white/80">
            <button
              type="button"
              onClick={() => handleTest()}
              disabled={testing || !inputUri.trim()}
              className="neu-card-sm neu-press px-4 py-2.5 rounded-full text-xs font-bold text-slate-700 hover:text-blue-600 flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw size={13} className={testing ? "animate-spin text-blue-600" : ""} />
              <span>{testing ? "Testing..." : "Test Connection"}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="neu-card-sm neu-press px-4 py-2.5 rounded-full text-xs font-semibold text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="neu-btn-blue neu-press px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                <Check size={14} />
                <span>Save &amp; Apply</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
