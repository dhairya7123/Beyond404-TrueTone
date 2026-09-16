import React, { useEffect, useRef, useState } from "react";
import {
  Home, Users, UploadCloud, BarChart3, Search, ChevronDown, LogOut, X, AlertCircle
} from "lucide-react";

import AuthScreen, { AuthLogo } from "./components/AuthScreen";
import ContactsView from "./components/ContactsView";
import CallProgress from "./components/CallProgress";
import DashboardView from "./components/DashboardView";
import OutgoingCall from "./components/OutgoingCall";
import { UploadAudio, ResultView, Reports, IncomingCall } from "./components/MediaViews";

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

function Sidebar({ page, go }) {
  const active = ["dashboard", "outgoingCall", "incomingCall", "callProgress"].includes(page)
    ? "dashboard"
    : ["upload", "uploadResult"].includes(page)
    ? "upload"
    : ["reports", "reportDetail"].includes(page)
    ? "reports"
    : page;

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
      <div className="mt-auto pt-6 border-t border-white/60">
        <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold px-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Gateway Active :8080
        </div>
      </div>
    </aside>
  );
}

function Topbar({ search, setSearch, placeholder, user, onLogout }) {
  const [profOpen, setProfOpen] = useState(false);
  const name = user?.name || "Analyst";
  const role = user?.role || "Platform Member";
  const initial = (name[0] || "U").toUpperCase();

  return (
    <div className="flex items-center gap-4 mb-8">
      <div className="flex-1 relative max-w-xl">
        <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={placeholder}
          className="neu-inset w-full pl-[52px] pr-5 py-3.5 rounded-full text-sm text-slate-700 placeholder:text-slate-400 outline-none border-none"
        />
      </div>
      <div className="relative">
        <button
          onClick={() => setProfOpen((v) => !v)}
          className="flex items-center gap-3 pl-1 pr-3 py-1 cursor-pointer"
        >
          <div className="neu-icon-blue w-11 h-11 rounded-full flex items-center justify-center font-bold text-blue-600">
            {initial}
          </div>
          <div className="text-left leading-tight hidden sm:block">
            <div className="text-[15px] font-bold text-slate-900">{name}</div>
            <div className="text-xs text-slate-400">{role}</div>
          </div>
          <ChevronDown size={16} className="text-slate-400" />
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

  const wsRef = useRef(null);

  // Fetch platform users
  async function fetchPlatformUsers() {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoadingUsers(false);
    }
  }

  // Fetch activities for current user from Supabase
  async function fetchActivities() {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/activity?userId=${user.id}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.activities)) {
        setActivities(data.activities);
      }
    } catch (err) {
      console.error("Failed to fetch activities:", err);
    }
  }

  useEffect(() => {
    if (user) {
      fetchPlatformUsers();
      fetchActivities();
    }
  }, [user]);

  // WebSocket for real-time peer-to-peer call signaling & live forensics telemetry
  useEffect(() => {
    if (!user?.id) return;

    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = window.location.port ? `${window.location.hostname}:8080` : window.location.host;
    const wsUrl = `${wsProto}//${wsHost}/ws?userId=${user.id}`;

    let ws = null;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(`[WS] Connected as ${user.name} (ID #${user.id})`);
        ws.send(JSON.stringify({ type: "register", userId: user.id, userName: user.name }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // 1. Incoming Call Event (Other user is calling this user)
          if (data.type === "incoming_call") {
            console.log("[CALL] Incoming call from:", data.caller);
            setActiveCall({
              id: data.call_id,
              role: "callee",
              otherParty: data.caller,
              status: "ringing",
            });
            setPage("incomingCall");
          }

          // 2. Callee is offline
          else if (data.type === "callee_offline") {
            setIsCalleeOffline(true);
          }

          // 3. Callee accepted
          else if (data.type === "call_accepted") {
            console.log("[CALL] Callee accepted call!");
            setPage("callProgress");
          }

          // 4. Callee declined
          else if (data.type === "call_declined") {
            setCallToast("The call was declined.");
            setActiveCall(null);
            setPage("dashboard");
            fetchActivities();
          }

          // 5. Call timeout (unanswered after 25s) -> auto cut
          else if (data.type === "call_timeout") {
            setCallToast("Call timed out. No answer.");
            setActiveCall(null);
            setPage("dashboard");
            fetchActivities();
          }

          // 6. Call ended by other party
          else if (data.type === "call_ended") {
            setCallToast("Call ended.");
            setActiveCall(null);
            setPage("dashboard");
            fetchActivities();
          }

          // 7. Real-time telemetry
          else if (data.type === "telemetry" || data.score !== undefined) {
            setLiveTelemetry(data);
          }
        } catch (e) {
          console.error("WS message error", e);
        }
      };
    } catch (err) {
      console.warn("WebSocket init error", err);
    }

    return () => {
      if (ws) {
        try {
          ws.close();
        } catch (_) {}
      }
    };
  }, [user]);

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
  function startCall(name, phone, initials, role) {
    const target = users.find((u) => u.phone === phone || u.name === name) || {
      name,
      phone,
      initials,
      role,
    };
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

  // Caller chooses to simulate forensics directly with microphone
  function simulateCallDirectly() {
    setPage("callProgress");
  }

  // Callee accepts incoming call
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

  // Callee declines incoming call
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

  // Either party ends active call
  function handleEndCall(duration, score, riskTier) {
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
      <Sidebar page={page} go={go} />
      <main className="flex-1 min-w-0 px-5 sm:px-8 py-7 lg:pl-[calc(290px+2rem)] max-w-[1740px] mx-auto w-full">
        <div className="lg:hidden mb-6">
          <AuthLogo />
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
          />
        ) : (
          <div className="flex justify-end mb-8">
            <Topbar
              search=""
              setSearch={() => {}}
              placeholder=""
              user={user}
              onLogout={handleLogout}
            />
          </div>
        )}

        {body}

        <div className="neu-card lg:hidden mt-8 flex justify-around p-3 sticky bottom-4">
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
    </div>
  );
}
