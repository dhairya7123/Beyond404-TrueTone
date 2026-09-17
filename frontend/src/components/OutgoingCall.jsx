import React, { useEffect, useState } from "react";
import { PhoneOff, Phone, Radio, AlertTriangle } from "lucide-react";

export default function OutgoingCall({ callee = {}, onCancel, onSimulate, isOffline }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="neu-card p-10 flex flex-col items-center text-center relative overflow-hidden">
        <div className="w-full flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 text-blue-600 font-medium text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-ping" />
            <span>Calling... ({25 - seconds > 0 ? `${25 - seconds}s timeout` : "cutting call"})</span>
          </div>
          <div className="neu-icon-blue px-3 py-1 rounded-full text-xs font-semibold text-blue-600 flex items-center gap-1.5">
            <Radio size={12} className="animate-pulse" />
            AI Signaling Active
          </div>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 rounded-full bg-blue-400/20 animate-ping scale-125" />
          <div className="neu-icon-blue w-36 h-36 rounded-full flex items-center justify-center text-5xl font-bold text-blue-600 relative z-10">
            {callee?.initials || "U"}
          </div>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mt-2">{callee?.name || "Platform Contact"}</h2>
        <div className="text-slate-500 text-sm mt-1">{callee?.phone || ""}</div>
        <div className="neu-inset px-4 py-1.5 rounded-full text-xs font-medium text-slate-600 mt-3">
          {callee?.role || "Platform Member"}
        </div>

        {isOffline ? (
          <div className="neu-icon-amber rounded-2xl p-4 my-6 max-w-md text-left flex items-start gap-3 text-xs text-amber-700">
            <AlertTriangle size={18} className="shrink-0 text-amber-600 mt-0.5" />
            <div>
              <div className="font-semibold text-amber-800">User not currently online on another device</div>
              <p className="mt-0.5 text-amber-700/90">
                To test live multi-device calls, log in as <b>{callee?.name || "this user"}</b> in another browser window. Or click below to test the AI voice forensics with your microphone right now.
              </p>
              <button
                onClick={onSimulate}
                className="neu-btn-blue neu-press mt-3 px-4 py-1.5 rounded-full text-xs font-semibold text-white inline-flex items-center gap-1.5"
              >
                <Phone size={13} /> Test Forensics With Microphone
              </button>
            </div>
          </div>
        ) : (
          <div className="my-6 flex flex-col items-center gap-3">
            <p className="text-xs text-slate-400">
              Ringing user's browser. If not answered within 25 seconds, the call will automatically cut off and be recorded as missed.
            </p>
            <button
              onClick={onSimulate}
              className="neu-card-sm neu-press px-4 py-1.5 rounded-full text-xs font-semibold text-blue-600 inline-flex items-center gap-1.5 hover:text-blue-700"
            >
              <Phone size={13} /> Connect Call Directly (Test Mode)
            </button>
          </div>
        )}

        <div className="flex flex-col items-center gap-2 mt-2">
          <button
            onClick={onCancel}
            className="neu-btn-red neu-press w-[68px] h-[68px] rounded-full flex items-center justify-center shadow-lg"
          >
            <PhoneOff size={24} />
          </button>
          <span className="text-sm font-medium text-slate-700">Cancel Call</span>
        </div>
      </div>
    </div>
  );
}
