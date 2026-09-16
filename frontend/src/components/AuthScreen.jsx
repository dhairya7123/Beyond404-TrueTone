import React, { useState } from "react";
import { Lock, Mail, KeyRound, UserPlus, AlertCircle, Phone, Shield } from "lucide-react";

export function AuthLogo() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="relative w-8 h-8 shrink-0 mt-1">
        <div className="absolute left-0 top-0.5 w-[18px] h-[18px] rounded-full bg-blue-600" />
        <div className="absolute right-0 top-0 w-[15px] h-[15px] rounded-[3px] bg-red-500" />
        <div className="absolute right-0 bottom-0 w-[15px] h-[15px] rounded-[3px] bg-amber-400" />
      </div>
      <div className="leading-none">
        <div className="text-[26px] font-extrabold tracking-tight text-slate-900">Beyond404</div>
        <div className="text-[10.5px] font-medium text-slate-400 mt-1 whitespace-nowrap">
          AI Voice Fraud Detection
        </div>
      </div>
    </div>
  );
}

export default function AuthScreen({ onLoginSuccess }) {
  const [mode, setMode] = useState("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Analyst");
  const [tag, setTag] = useState("Personal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sampleUsers = [
    { label: "Sanin CP", id: "sanin@beyond404.ai", role: "Senior Analyst" },
    { label: "Alex Thomas", id: "alex@beyond404.ai", role: "Security Officer" },
    { label: "Riya Nair", id: "riya@beyond404.ai", role: "Fraud Analyst" },
    { label: "Bank Support", id: "support@beyondbank.com", role: "Support Lead" },
  ];

  async function handleSignIn(e) {
    if (e) e.preventDefault();
    if (!identifier || !password) {
      setError("Please provide both email/phone and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Invalid login credentials.");
      }
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || "Failed to sign in. Please verify credentials.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e) {
    if (e) e.preventDefault();
    if (!name || !email || !phone || !password) {
      setError("Please fill out all required registration fields.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, password, role, tag }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Registration failed.");
      }
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || "Could not register user in Supabase.");
    } finally {
      setLoading(false);
    }
  }

  function quickLogin(userId) {
    setIdentifier(userId);
    setPassword("password123");
    setError("");
    setLoading(true);
    fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: userId, password: "password123" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.user) {
          onLoginSuccess(data.user);
        } else {
          setError(data.error || "Quick login failed.");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6" style={{ background: "var(--page-bg)" }}>
      <div className="w-full max-w-md">
        <div className="neu-card p-8 sm:p-10">
          <div className="flex justify-center mb-6">
            <AuthLogo />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {mode === "signin" ? "Sign in to Platform" : "Create Platform Account"}
            </h1>
            <p className="text-xs text-slate-500 mt-1.5">
              Powered by Beyond404 AI Voice Forensics &amp; Supabase
            </p>
          </div>

          <div className="neu-inset p-1 rounded-full flex gap-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(""); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all ${
                mode === "signin" ? "neu-btn-blue text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("signup"); setError(""); }}
              className={`flex-1 py-2 text-xs font-semibold rounded-full transition-all ${
                mode === "signup" ? "neu-btn-blue text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="neu-icon-red rounded-2xl p-3.5 mb-5 flex items-center gap-2.5 text-xs text-red-600">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">Email or Phone</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. sanin@beyond404.ai"
                    className="neu-inset w-full pl-11 pr-4 py-3 rounded-2xl text-sm text-slate-800 placeholder:text-slate-400 outline-none border-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">Password</label>
                <div className="relative">
                  <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="neu-inset w-full pl-11 pr-4 py-3 rounded-2xl text-sm text-slate-800 placeholder:text-slate-400 outline-none border-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="neu-btn-blue neu-press w-full py-3.5 rounded-full text-sm font-semibold mt-2 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock size={15} /> Sign In to Platform
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 ml-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dhairya Sharma"
                  className="neu-inset w-full px-4 py-2.5 rounded-2xl text-sm text-slate-800 placeholder:text-slate-400 outline-none border-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 ml-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. dhairya@beyond404.ai"
                  className="neu-inset w-full px-4 py-2.5 rounded-2xl text-sm text-slate-800 placeholder:text-slate-400 outline-none border-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 ml-1">Phone Number</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 12345"
                  className="neu-inset w-full px-4 py-2.5 rounded-2xl text-sm text-slate-800 placeholder:text-slate-400 outline-none border-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 ml-1">Platform Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="neu-inset w-full px-3 py-2.5 rounded-2xl text-xs text-slate-700 outline-none border-none"
                  >
                    <option value="Analyst">Analyst</option>
                    <option value="Senior Analyst">Senior Analyst</option>
                    <option value="Security Officer">Security Officer</option>
                    <option value="Fraud Analyst">Fraud Analyst</option>
                    <option value="Forensic Investigator">Forensic Investigator</option>
                    <option value="Support Lead">Support Lead</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 ml-1">Tag</label>
                  <select
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    className="neu-inset w-full px-3 py-2.5 rounded-2xl text-xs text-slate-700 outline-none border-none"
                  >
                    <option value="Personal">Personal</option>
                    <option value="Business">Business</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 ml-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  className="neu-inset w-full px-4 py-2.5 rounded-2xl text-sm text-slate-800 placeholder:text-slate-400 outline-none border-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="neu-btn-blue neu-press w-full py-3.5 rounded-full text-sm font-semibold mt-3 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus size={15} /> Create Account
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-white/70">
            <div className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase text-center mb-3">
              One-Click Platform Demo Users
            </div>
            <div className="grid grid-cols-2 gap-2">
              {sampleUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => quickLogin(u.id)}
                  className="neu-card-sm neu-press p-2 text-left rounded-xl transition-all"
                >
                  <div className="text-xs font-bold text-slate-800 leading-tight truncate">{u.label}</div>
                  <div className="text-[10.5px] text-slate-400 truncate">{u.role}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
