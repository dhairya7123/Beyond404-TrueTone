import React, { useEffect, useRef, useState } from "react";
import {
  Home, Users, UploadCloud, BarChart3, Search, ChevronDown, LogOut, X, AlertCircle,
  Settings, Terminal, Globe, Server, Activity
} from "lucide-react";

import AuthScreen, { AuthLogo } from "./components/AuthScreen";
import ContactsView from "./components/ContactsView";
import CallProgress from "./components/CallProgress";
import DashboardView from "./components/DashboardView";
import OutgoingCall from "./components/OutgoingCall";
import { UploadAudio, ResultView, Reports, IncomingCall } from "./components/MediaViews";
import BackendSettingsModal from "./components/BackendSettingsModal";
import LogsModal from "./components/LogsModal";
import { getBackendUri, setBackendUri, apiUrl, getWsUrl } from "./utils/api";
import logger from "./utils/logger";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "upload", label: "Upload Audio", icon: UploadCloud },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

function getInitials(name) {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Sidebar({ page, go, backendUri, onOpenSettings, onOpenLogs }) {
  const active = ["dashboard", "outgoingCall", "incomingCall", "callProgress"].includes(page)
    ? "dashboard"
    : ["upload", "uploadResult"].includes(page)
    ? "upload"
    : ["reports", "reportDetail"].includes(page)
    ? "reports"
    : page;

  const displayUri = backendUri ? backendUri.replace(/^https?:\/\//i, "") : "localhost:8080";

  return (
    <aside
      className="w-[290px] hidden lg:flex flex-col fixed left-0 top-0 h-screen z-30 px-7 pt-8 pb-6"
      style={{ background: "var(--sidebar-bg)" }}
    >
      <AuthLogo />
      <nav className="mt-10 flex flex-col gap-3 relative z-10">
        {NAV.map((n) => {
          const Icon = n.icon;
          const isActive = active === n.id;
          return (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              className={`flex items-center gap-4 pl-3 pr-5 py-2.5 rounded-full text-[15px] transition-all text-left ${
                isActive
                  ? "neu-nav-active font-semibold text-blue-600"
                  : "font-medium text-slate-500 hover:text-slate-700"
              }`}
            >
              <span
                className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                  isActive ? "neu-icon-blue" : "neu-circle"
                }`}
              >
                <Icon size={19} strokeWidth={2} className={isActive ? "text-blue-600" : "text-slate-600"} />
              </span>
              {n.label}
            </button>
          );
        })}
      </nav>

      {/* Quick Utilities */}
      <div className="mt-6 flex flex-col gap-2">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
        >
          <Server size={16} className="text-blue-500" />
          <span>Backend Settings</span>
        </button>
        <button
          onClick={onOpenLogs}
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
        >
          <Terminal size={16} className="text-slate-500" />
          <span>Telemetry &amp; Audits</span>
        </button>
      </div>

      {/* Gateway Status Badge */}
      <div className="mt-auto pt-6 border-t border-white/60">
        <button
          onClick={onOpenSettings}
          title="Click to configure backend URL"
          className="neu-card-sm neu-press w-full flex items-center justify-between p-2.5 rounded-xl text-left"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="truncate">{displayUri}</span>
          </div>
          <Settings size={13} className="text-slate-400 shrink-0 ml-1" />
        </button>
      </div>
    </aside>
  );
}

function Topbar({ search, setSearch, placeholder, user, onLogout, backendUri, onOpenSettings, onOpenLogs, signalingStatus }) {
  const [profOpen, setProfOpen] = useState(false);
  const name = user?.name || "Analyst";
  const role = user?.role || "Platform Member";
  const initial = (name[0] || "U").toUpperCase();

  const displayUri = backendUri ? backendUri.replace(/^https?:\/\//i, "") : "localhost:8080";

  return (
    <div className="flex items-center gap-3 sm:gap-4 mb-8">
      <div className="flex-1 relative max-w-xl">
        <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="neu-inset w-full pl-[52px] pr-5 py-3.5 rounded-full text-sm text-slate-700 placeholder:text-slate-400 outline-none border-none"
        />
      </div>

      {/* Backend Tunnel Pill */}
      <button
        onClick={onOpenSettings}
        className="neu-card-sm neu-press hidden sm:flex items-center gap-1.5 px-3.5 py-2.5 rounded-full text-xs font-semibold text-slate-700 hover:text-blue-600 shrink-0"
        title="Change Backend Gateway / Tunnel URI"
      >
        <Server size={14} className="text-blue-600 shrink-0" />
        <span className="max-w-[140px] truncate">{displayUri}</span>
      </button>

      {/* Logs Shortcut */}
      <button
        onClick={onOpenLogs}
        className="neu-card-sm neu-press p-2.5 rounded-full text-slate-600 hover:text-blue-600 shrink-0"
        title="View Forensic Telemetry & Logs"
      >
        <Terminal size={16} />
      </button>

      {/* Signaling Status Indicator */}
      <div
        className={`neu-card-sm px-3 py-2 rounded-full hidden sm:flex items-center gap-1.5 text-xs font-semibold ${
          signalingStatus === "connected"
            ? "text-emerald-700 bg-emerald-50/40"
            : "text-amber-600 bg-amber-50/40 animate-pulse"
        }`}
        title={
          signalingStatus === "connected"
            ? `Real-time AI signaling active as ${user?.name || "user"}`
            : "Connecting to real-time AI signaling..."
        }
      >
        <span
          className={`w-2 h-2 rounded-full ${
            signalingStatus === "connected" ? "bg-emerald-500" : "bg-amber-500 animate-ping"
          }`}
        />
        <span className="hidden md:inline">
          {signalingStatus === "connected" ? "Signaling Live" : "Reconnecting..."}
        </span>
      </div>

      {/* User Profile */}
      <div className="relative shrink-0">
        <button
          onClick={() => setProfOpen((v) => !v)}
          className="flex items-center gap-2 sm:gap-3 pl-1 pr-2 sm:pr-3 py-1 cursor-pointer"
        >
          <div className="neu-icon-blue w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-bold text-blue-600">
            {initial}
          </div>
          <div className="text-left leading-tight hidden md:block">
            <div className="text-[14px] font-bold text-slate-900">{name}</div>
            <div className="text-[11px] text-slate-400">{role}</div>
          </div>
          <ChevronDown size={15} className="text-slate-400 hidden sm:block" />
        </button>
        {profOpen && (
          <div className="neu-card absolute right-0 mt-3 w-56 p-2 z-20 text-sm shadow-xl">
            <div className="px-3 py-2 border-b border-white/70 mb-1">
              <div className="font-semibold text-slate-800 text-xs">{name}</div>
              <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
              <div className="text-[11px] text-blue-500 mt-0.5">{user?.phone}</div>
            </div>
            <div className="px-3 py-2 rounded-xl text-slate-600 text-xs">
              Role: <span className="font-semibold text-slate-800">{role}</span>
            </div>
            <div
              onClick={() => {
                setProfOpen(false);
                onOpenSettings();
              }}
              className="px-3 py-2 rounded-xl hover:bg-white/50 text-slate-700 cursor-pointer flex items-center gap-2 text-xs font-semibold"
            >
              <Settings size={14} /> Backend Gateway
            </div>
            <div
              onClick={() => {
                setProfOpen(false);
                onLogout();
              }}
              className="px-3 py-2 rounded-xl hover:bg-white/50 text-red-500 cursor-pointer flex items-center gap-2 text-xs font-semibold"
            >
              <LogOut size={14} /> Log out
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("beyond404_user");
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  const [backendUri, setBackendUriState] = useState(() => getBackendUri());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);

  const [page, setPage] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [uploadResult, setUploadResult] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [activities, setActivities] = useState([]);

  // Active call state
  const [activeCall, setActiveCall] = useState(null);
  const [isCalleeOffline, setIsCalleeOffline] = useState(false);
  const [liveTelemetry, setLiveTelemetry] = useState(null);
  const [callToast, setCallToast] = useState("");
  const [signalingStatus, setSignalingStatus] = useState("connecting"); // "connected" | "connecting" | "disconnected"
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  const wsRef = useRef(null);
  const onWebRtcSignalRef = useRef(null);
  const signalBufferRef = useRef([]);

  // Sync backend URI from custom events
  useEffect(() => {
    const handler = (e) => {
      setBackendUriState(e.detail || "");
    };
    window.addEventListener("backend-uri-changed", handler);
    return () => window.removeEventListener("backend-uri-changed", handler);
  }, []);

  // Fetch platform users using dynamic backend URI
  async function fetchPlatformUsers() {
    setLoadingUsers(true);
    try {
      const res = await fetch(apiUrl("/api/users", backendUri));
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to fetch users from backend:", err);
      logger.error("API", "Failed to fetch platform users: " + err.message);
    } finally {
      setLoadingUsers(false);
    }
  }

  // Periodically fetch online user IDs from backend
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    async function checkOnlineUsers() {
      try {
        const res = await fetch(apiUrl("/api/online-users", backendUri));
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.online_user_ids) && isMounted) {
            setOnlineUserIds(data.online_user_ids);
          }
        }
      } catch (_) {}
    }

    checkOnlineUsers();
    const interval = setInterval(checkOnlineUsers, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [user, backendUri]);

  // Fetch activities for current user from Supabase via dynamic backend URI
  async function fetchActivities() {
    if (!user?.id) return;
    try {
      const res = await fetch(apiUrl(`/api/activity?userId=${user.id}`, backendUri));
      const data = await res.json();
      if (data.success && Array.isArray(data.activities)) {
        setActivities(data.activities);
      }
    } catch (err) {
      console.error("Failed to fetch activities from backend:", err);
      logger.error("API", "Failed to fetch activities: " + err.message);
    }
  }

  useEffect(() => {
    if (user) {
      fetchPlatformUsers();
      fetchActivities();
    }
  }, [user, backendUri]);

  // Resilient WebSocket for real-time peer-to-peer call signaling & live forensics
  useEffect(() => {
    if (!user?.id) {
      setSignalingStatus("disconnected");
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (_) {}
        wsRef.current = null;
      }
      return;
    }

    let isUnmounted = false;
    let reconnectTimer = null;
    let pingTimer = null;

    function connect() {
      if (isUnmounted) return;
      if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
      }

      setSignalingStatus("connecting");
      const wsUrl = getWsUrl(user.id, backendUri);
      logger.info("WS", `Connecting WebSocket signaling to ${wsUrl}`);

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) {
            try { ws.close(); } catch (_) {}
            return;
          }
          logger.info("WS", `Connected signaling as ${user.name} (ID #${user.id})`);
          setSignalingStatus("connected");
          ws.send(JSON.stringify({ type: "register", userId: user.id, userName: user.name }));

          // Keep-alive heartbeat ping every 5 seconds (keeps Cloudflare tunnel and mobile NAT open)
          clearInterval(pingTimer);
          pingTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 5000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === "pong") {
              return; // Keepalive ack
            }

            // 1. Incoming Call Event
            if (data.type === "incoming_call") {
              logger.info("CALL", "Incoming call received from", data.caller);
              setActiveCall({
                id: data.call_id,
                role: "callee",
                otherParty: data.caller,
                status: "ringing",
              });
              setIsCalleeOffline(false);
              setPage("incomingCall");
            }

            // 2. Callee is offline
            else if (data.type === "callee_offline") {
              logger.warn("CALL", "Callee is offline");
              setIsCalleeOffline(true);
            }

            // 3. Callee accepted
            else if (data.type === "call_accepted") {
              logger.info("CALL", "Call accepted by remote party");
              setPage("callProgress");
            }

            // 4. Callee declined
            else if (data.type === "call_declined") {
              logger.warn("CALL", "Call was declined");
              setCallToast("The call was declined.");
              setActiveCall(null);
              setPage("dashboard");
              fetchActivities();
            }

            // 5. Call timeout
            else if (data.type === "call_timeout") {
              logger.warn("CALL", "Call timed out with no answer");
              setCallToast("Call timed out. No answer.");
              setActiveCall(null);
              setPage("dashboard");
              fetchActivities();
            }

            // 6. Call ended by other party
            else if (data.type === "call_ended") {
              logger.info("CALL", "Call ended by remote party");
              setCallToast("Call ended.");
              setActiveCall(null);
              setPage("dashboard");
              fetchActivities();
            }

            // 7. Real-time telemetry
            else if (data.type === "telemetry" || data.score !== undefined) {
              setLiveTelemetry(data);
            }

            // 8. P2P WebRTC audio signaling (offer / answer / candidate)
            else if (data.type === "webrtc_signal") {
              logger.info("WEBRTC", "Received P2P audio signal:", data.signal?.type || "candidate");
              if (onWebRtcSignalRef.current) {
                onWebRtcSignalRef.current(data);
              } else {
                signalBufferRef.current.push(data);
              }
            }
          } catch (e) {
            logger.error("WS", "WS message parsing error: " + e.message);
          }
        };

        ws.onerror = (err) => {
          logger.warn("WS", "WebSocket signaling error observed", err);
        };

        ws.onclose = () => {
          clearInterval(pingTimer);
          if (isUnmounted) return;
          logger.info("WS", "Signaling connection dropped. Reconnecting in 2s...");
          setSignalingStatus("connecting");
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, 2000);
        };
      } catch (err) {
        logger.error("WS", "Signaling init error: " + err.message);
        if (!isUnmounted) {
          clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(connect, 2500);
        }
      }
    }

    connect();

    // Reconnect instantly when phone screen unlocks or user returns to tab
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          logger.info("WS", "App became visible; restoring signaling WebSocket...");
          connect();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      isUnmounted = true;
      clearInterval(pingTimer);
      clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (_) {}
        wsRef.current = null;
      }
    };
  }, [user, backendUri]);

  function handleLogin(loggedInUser) {
    setUser(loggedInUser);
    localStorage.setItem("beyond404_user", JSON.stringify(loggedInUser));
    setPage("dashboard");
  }

  function handleLogout() {
    setUser(null);
    localStorage.removeItem("beyond404_user");
  }

  function go(p) {
    setSearch("");
    setPage(p);
  }

  // Caller initiates call to Callee
  function startCall(targetUserOrName, phone, initials, role) {
    let target = null;
    if (typeof targetUserOrName === "object" && targetUserOrName !== null) {
      target = targetUserOrName;
    } else {
      target = users.find(
        (u) =>
          u.id === targetUserOrName ||
          u.phone === phone ||
          u.name?.toLowerCase() === String(targetUserOrName).toLowerCase()
      ) || {
        id: typeof targetUserOrName === "number" ? targetUserOrName : undefined,
        name: targetUserOrName,
        phone,
        initials,
        role,
      };
    }

    if (!target.id && target.name) {
      const match = users.find((u) => u.name?.trim().toLowerCase() === target.name?.trim().toLowerCase());
      if (match) target.id = match.id;
    }

    const callId = `call_${Date.now()}`;
    const callerData = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      initials: getInitials(user.name),
    };
    const calleeData = {
      id: target.id,
      name: target.name,
      phone: target.phone,
      role: target.role,
      initials: target.initials || getInitials(target.name),
    };

    logger.info("CALL", "Initiating call to callee:", calleeData);
    setActiveCall({
      id: callId,
      role: "caller",
      otherParty: calleeData,
      status: "ringing",
    });
    setIsCalleeOffline(false);
    setPage("outgoingCall");

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "call_request",
          call_id: callId,
          caller: callerData,
          callee: calleeData,
        })
      );
    } else {
      logger.warn("CALL", "Signaling socket not open when starting call. Reconnecting...");
      setCallToast("Signaling is reconnecting... retrying in 2 seconds.");
    }
  }

  // Caller cancels outgoing call
  function cancelOutgoingCall() {
    if (activeCall?.id && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "call_end",
          call_id: activeCall.id,
          duration: 0,
          score: 0,
          risk_tier: "Low Risk",
        })
      );
    }
    setActiveCall(null);
    setPage("dashboard");
    fetchActivities();
  }

  function simulateCallDirectly() {
    setPage("callProgress");
  }

  function acceptIncomingCall() {
    if (activeCall?.id && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "call_accept",
          call_id: activeCall.id,
        })
      );
    }
    setPage("callProgress");
  }

  function declineIncomingCall() {
    if (activeCall?.id && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "call_decline",
          call_id: activeCall.id,
        })
      );
    }
    setActiveCall(null);
    setPage("dashboard");
    fetchActivities();
  }

  function handleEndCall(duration, score, riskTier) {
    onWebRtcSignalRef.current = null;
    signalBufferRef.current = [];
    if (activeCall?.id && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "call_end",
          call_id: activeCall.id,
          duration: duration || 0,
          score: score || 20,
          risk_tier: riskTier || "Low Risk",
        })
      );
    }
    setActiveCall(null);
    setPage("dashboard");
    fetchActivities();
  }

  if (!user) {
    return <AuthScreen onLoginSuccess={handleLogin} />;
  }

  const placeholders = {
    dashboard: "Search your calls, activities, or contacts...",
    contacts: "Search platform users by name, phone, or role...",
    reports: "Search forensic activity reports...",
    upload: "Search contacts, cases, or audio files...",
  };

  let body;
  if (page === "dashboard") {
    body = (
      <DashboardView
        go={go}
        startCall={startCall}
        user={user}
        contactsCount={users.length}
        activities={activities}
      />
    );
  } else if (page === "contacts") {
    body = (
      <ContactsView
        search={search}
        setSearch={setSearch}
        startCall={startCall}
        currentUser={user}
        users={users}
        loading={loadingUsers}
        onRefresh={fetchPlatformUsers}
        onlineUserIds={onlineUserIds}
      />
    );
  } else if (page === "upload") {
    body = (
      <UploadAudio
        currentUser={user}
        onAnalyzed={(d) => {
          setUploadResult(d);
          go("uploadResult");
          fetchActivities();
        }}
      />
    );
  } else if (page === "uploadResult" && uploadResult) {
    body = (
      <ResultView
        data={uploadResult}
        onBack={() => go("upload")}
        onDelete={() => {
          setUploadResult(null);
          go("upload");
        }}
      />
    );
  } else if (page === "reports") {
    body = (
      <Reports
        search={search}
        setSearch={setSearch}
        activities={activities}
        currentUser={user}
        onOpen={(r) => {
          setReportDetail(r);
          go("reportDetail");
        }}
      />
    );
  } else if (page === "reportDetail" && reportDetail) {
    body = <ResultView data={reportDetail} onBack={() => go("reports")} />;
  } else if (page === "outgoingCall" && activeCall) {
    body = (
      <OutgoingCall
        callee={activeCall.otherParty}
        onCancel={cancelOutgoingCall}
        onSimulate={simulateCallDirectly}
        isOffline={isCalleeOffline}
      />
    );
  } else if (page === "incomingCall" && activeCall) {
    body = (
      <IncomingCall
        caller={activeCall.otherParty}
        onAccept={acceptIncomingCall}
        onDecline={declineIncomingCall}
      />
    );
  } else if (page === "callProgress" && activeCall) {
    body = (
      <CallProgress
        caller={activeCall.otherParty}
        onEnd={handleEndCall}
        liveTelemetry={liveTelemetry}
        callId={activeCall.id}
        role={activeCall.role}
        targetUserId={activeCall.otherParty?.id}
        onSignalRegister={(callback) => {
          onWebRtcSignalRef.current = callback;
          if (callback && signalBufferRef.current.length > 0) {
            const buffered = [...signalBufferRef.current];
            signalBufferRef.current = [];
            buffered.forEach((sig) => callback(sig));
          }
        }}
        sendWsSignal={(signal) => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(
              JSON.stringify({
                type: "webrtc_signal",
                call_id: activeCall.id,
                target_user_id: activeCall.otherParty?.id,
                signal,
              })
            );
          }
        }}
      />
    );
  } else {
    body = (
      <DashboardView
        go={go}
        startCall={startCall}
        user={user}
        contactsCount={users.length}
        activities={activities}
      />
    );
  }

  const showTopbarSearch = ["dashboard", "contacts", "reports", "upload"].includes(page);

  return (
    <div className="min-h-screen flex text-slate-900" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <Sidebar
        page={page}
        go={go}
        backendUri={backendUri}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenLogs={() => setIsLogsOpen(true)}
      />

      <main className="flex-1 min-w-0 px-5 sm:px-8 py-7 lg:pl-[calc(290px+2rem)] max-w-[1740px] mx-auto w-full">
        {/* Mobile Header */}
        <div className="lg:hidden mb-6 flex items-center justify-between">
          <AuthLogo />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="neu-card-sm neu-press p-2 rounded-xl text-slate-600 hover:text-blue-600"
              title="Backend Gateway Settings"
            >
              <Server size={18} />
            </button>
            <button
              onClick={() => setIsLogsOpen(true)}
              className="neu-card-sm neu-press p-2 rounded-xl text-slate-600 hover:text-blue-600"
              title="Telemetry Logs"
            >
              <Terminal size={18} />
            </button>
          </div>
        </div>

        {callToast && (
          <div className="neu-card mb-6 p-4 flex items-center justify-between gap-3 text-sm text-slate-700 border-l-4 border-blue-500">
            <div className="flex items-center gap-2">
              <AlertCircle size={17} className="text-blue-600" />
              <span>{callToast}</span>
            </div>
            <button onClick={() => setCallToast("")} className="text-slate-400 hover:text-slate-600">
              <X size={15} />
            </button>
          </div>
        )}

        {showTopbarSearch ? (
          <Topbar
            search={search}
            setSearch={setSearch}
            placeholder={placeholders[page]}
            user={user}
            onLogout={handleLogout}
            backendUri={backendUri}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenLogs={() => setIsLogsOpen(true)}
          />
        ) : (
          <div className="flex justify-end mb-8">
            <Topbar
              search=""
              setSearch={() => {}}
              placeholder=""
              user={user}
              onLogout={handleLogout}
              backendUri={backendUri}
              onOpenSettings={() => setIsSettingsOpen(true)}
              onOpenLogs={() => setIsLogsOpen(true)}
            />
          </div>
        )}

        {body}

        {/* Mobile bottom nav */}
        <div className="neu-card lg:hidden mt-8 flex justify-around p-3 sticky bottom-4 z-20">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                className={`p-3 rounded-full ${
                  page === n.id ? "neu-icon-blue text-blue-600" : "text-slate-400"
                }`}
              >
                <Icon size={19} />
              </button>
            );
          })}
        </div>
      </main>

      {/* Backend Gateway Settings Modal */}
      <BackendSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={(newUri) => {
          setBackendUriState(newUri);
          fetchPlatformUsers();
          fetchActivities();
        }}
      />

      {/* Forensic Telemetry Logs Modal */}
      <LogsModal
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
      />
    </div>
  );
}
