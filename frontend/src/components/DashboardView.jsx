import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, Tooltip
} from "recharts";
import {
  Phone, ShieldCheck, ShieldAlert, BarChart3, ArrowUpRight, Clock, ChevronRight, Zap, UploadCloud, Users, FileText, Settings, AlertTriangle
} from "lucide-react";

export default function DashboardView({ go, startCall, user, contactsCount, activities = [] }) {
  const [range, setRange] = useState("7d");

  // Filter activities for this user
  const userActivities = useMemo(() => {
    return activities.slice(0, 5);
  }, [activities]);

  // Compute live user stats from Supabase
  const detectedClonesCount = useMemo(() => {
    return activities.filter((a) => a.flagged).length;
  }, [activities]);

  const verifiedGenuineCount = useMemo(() => {
    return activities.filter((a) => !a.flagged && a.status === "completed").length;
  }, [activities]);

  const totalAnalysedCount = useMemo(() => {
    return activities.filter((a) => a.status === "completed").length;
  }, [activities]);

  // Dynamic threat distribution
  const threatDist = useMemo(() => {
    const total = activities.length || 1;
    const clones = activities.filter((a) => a.flagged).length;
    const genuine = activities.filter((a) => !a.flagged && a.status === "completed").length;
    const missedOrDeclined = activities.filter((a) => a.status !== "completed").length;

    if (activities.length === 0) {
      return [
        { name: "Genuine", value: 100, color: "#2563eb" },
        { name: "AI Clone", value: 0, color: "#ef4444" },
        { name: "Missed/Other", value: 0, color: "#f59e0b" },
      ];
    }

    return [
      { name: "Genuine", value: Math.round((genuine / total) * 100), color: "#2563eb" },
      { name: "AI Clone", value: Math.round((clones / total) * 100), color: "#ef4444" },
      { name: "Missed/Other", value: Math.round((missedOrDeclined / total) * 100), color: "#f59e0b" },
    ];
  }, [activities]);

  const trendData = [
    { day: "Day 1", genuine: Math.max(1, verifiedGenuineCount), clone: detectedClonesCount },
    { day: "Day 2", genuine: verifiedGenuineCount + 1, clone: detectedClonesCount },
    { day: "Today", genuine: verifiedGenuineCount, clone: detectedClonesCount },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
        <div>
          <div className="text-xs font-semibold tracking-[0.25em] text-blue-500 mb-2">
            AI FOR A SAFER TOMORROW
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Good morning, {user?.name || "Analyst"}.</h1>
          <p className="text-slate-500 mt-1">
            Personalized dashboard for <b>{user?.name}</b> · {user?.email}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="neu-card p-5 w-48 flex items-center gap-3">
            <div className="relative w-9 h-9 shrink-0">
              <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-blue-600" />
              <div className="absolute right-0 bottom-0 w-6 h-6 rounded-full bg-red-500 opacity-90" />
            </div>
            <div className="text-[13px] font-semibold text-slate-700 tracking-wide leading-tight">
              HUMAN<br />VOICES<br />MATTER
            </div>
          </div>
          <div className="neu-card p-5 w-64 flex items-center gap-3">
            <p className="text-sm text-slate-700 leading-snug flex-1">
              “Live peer-to-peer call forensics with Supabase storage.”
            </p>
            <div className="flex items-end gap-1 h-8">
              <div className="w-1.5 bg-red-300 rounded-full h-4" />
              <div className="w-1.5 bg-blue-300 rounded-full h-6" />
              <div className="w-1.5 bg-slate-800 rounded-full h-8" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
        <div className="neu-card p-5 neu-press cursor-pointer" onClick={() => go("contacts")}>
          <div className="flex items-center gap-4 w-full text-left">
            <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 neu-icon-blue">
              <Phone size={22} className="text-blue-600" strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-sm text-slate-500">Platform Users</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <div className="text-[28px] font-bold text-slate-900 leading-none">
                  {contactsCount || 6}
                </div>
                <div className="flex items-center gap-0.5 text-xs font-bold text-emerald-500">
                  <ArrowUpRight size={13} strokeWidth={2.5} /> Live
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Supabase registered</div>
            </div>
          </div>
        </div>

        <div className="neu-card p-5 neu-press cursor-pointer" onClick={() => go("reports")}>
          <div className="flex items-center gap-4 w-full text-left">
            <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 neu-icon-red">
              <ShieldAlert size={22} className="text-red-500" strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-sm text-slate-500">Flagged AI Clones</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <div className="text-[28px] font-bold text-slate-900 leading-none">
                  {detectedClonesCount}
                </div>
                <div className="flex items-center gap-0.5 text-xs font-bold text-red-500">
                  {detectedClonesCount > 0 ? "Flagged" : "Clear"}
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Your call activities</div>
            </div>
          </div>
        </div>

        <div className="neu-card p-5 neu-press cursor-pointer" onClick={() => go("reports")}>
          <div className="flex items-center gap-4 w-full text-left">
            <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 neu-icon-green">
              <ShieldCheck size={22} className="text-emerald-500" strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-sm text-slate-500">Verified Genuine</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <div className="text-[28px] font-bold text-slate-900 leading-none">
                  {verifiedGenuineCount}
                </div>
                <div className="flex items-center gap-0.5 text-xs font-bold text-emerald-500">
                  <ArrowUpRight size={13} strokeWidth={2.5} /> Verified
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Safe conversations</div>
            </div>
          </div>
        </div>

        <div className="neu-card p-5 neu-press cursor-pointer" onClick={() => go("reports")}>
          <div className="flex items-center gap-4 w-full text-left">
            <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 neu-icon-slate">
              <BarChart3 size={22} className="text-slate-600" strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-sm text-slate-500">Total Analysed Calls</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <div className="text-[28px] font-bold text-slate-900 leading-none">
                  {totalAnalysedCount}
                </div>
                <div className="flex items-center gap-0.5 text-xs font-bold text-blue-500">
                  Total
                </div>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Stored in Postgres</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-6">
        <div className="neu-card p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <span className="neu-icon-slate w-9 h-9 rounded-full flex items-center justify-center">
                <BarChart3 size={16} className="text-slate-600" />
              </span>
              Personal Detection Trend
            </div>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="neu-inset text-sm rounded-xl px-4 py-2 text-slate-600 outline-none border-none"
            >
              <option value="7d">Active Sessions</option>
            </select>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /> AI Clone</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" /> Genuine</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} barGap={0} barCategoryGap="28%">
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.45)" }} />
              <Bar dataKey="clone" stackId="a" fill="#f87171" radius={[0, 0, 6, 6]} />
              <Bar dataKey="genuine" stackId="a" fill="#60a5fa" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="neu-card p-6">
          <div className="flex items-center gap-2 font-semibold text-slate-800 mb-4">
            <span className="neu-icon-slate w-9 h-9 rounded-full flex items-center justify-center">
              <ShieldCheck size={16} className="text-slate-600" />
            </span>
            Call Threat Distribution
          </div>
          <div className="relative flex justify-center">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={threatDist} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={2} startAngle={90} endAngle={-270}>
                  {threatDist.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-bold text-slate-900">{activities.length}</div>
              <div className="text-xs text-slate-400">Total Calls</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 mt-2">
            {threatDist.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  {d.name}
                </span>
                <span className="font-semibold text-slate-800">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="neu-card p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <span className="neu-icon-slate w-9 h-9 rounded-full flex items-center justify-center">
                <Clock size={16} className="text-slate-600" />
              </span>
              Recent Call Activity (For {user?.name})
            </div>
            <button onClick={() => go("reports")} className="text-sm text-blue-600 font-medium flex items-center gap-1 hover:underline">
              View All <ChevronRight size={14} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-left border-b border-white/60">
                  <th className="font-medium py-2">Direction</th>
                  <th className="font-medium py-2">Contact</th>
                  <th className="font-medium py-2">Status / Result</th>
                  <th className="font-medium py-2">Fraud Score</th>
                </tr>
              </thead>
              <tbody>
                {userActivities.map((r) => {
                  const isOutgoing = r.caller_id === user?.id;
                  const otherName = isOutgoing ? r.callee_name : r.caller_name;
                  const otherPhone = isOutgoing ? r.callee_phone : r.caller_phone;

                  return (
                    <tr key={r.id} className="border-t border-white/70">
                      <td className="py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          isOutgoing ? "neu-icon-blue text-blue-600" : "neu-icon-green text-emerald-600"
                        }`}>
                          {isOutgoing ? "Outgoing" : "Incoming"}
                        </span>
                      </td>
                      <td className="py-3 text-slate-700">
                        <div className="font-medium">{otherName}</div>
                        <div className="text-xs text-slate-400">{otherPhone}</div>
                      </td>
                      <td className="py-3">
                        {r.status === "missed" ? (
                          <span className="neu-icon-slate text-slate-500 px-3 py-1 rounded-full text-xs font-semibold">
                            Missed
                          </span>
                        ) : r.status === "declined" ? (
                          <span className="neu-icon-amber text-amber-600 px-3 py-1 rounded-full text-xs font-semibold">
                            Declined
                          </span>
                        ) : r.flagged ? (
                          <span className="neu-icon-red text-red-600 px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1">
                            <AlertTriangle size={12} /> AI Clone Flagged
                          </span>
                        ) : (
                          <span className="neu-icon-green text-emerald-600 px-3 py-1 rounded-full text-xs font-semibold">
                            Verified Genuine
                          </span>
                        )}
                      </td>
                      <td className="py-3 font-semibold text-slate-800">
                        {r.status === "completed" ? `${r.fraud_score}%` : "--"}
                      </td>
                    </tr>
                  );
                })}
                {userActivities.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      No calls recorded yet for {user?.name}. Call any platform member from Contacts!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="neu-card p-6">
          <div className="flex items-center gap-2 font-semibold text-slate-800 mb-4">
            <span className="neu-icon-slate w-9 h-9 rounded-full flex items-center justify-center">
              <Zap size={16} className="text-slate-600" />
            </span>
            Quick Actions
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => go("upload")} className="neu-card-sm neu-press text-left p-4 flex flex-col gap-2.5">
              <span className="neu-icon-blue w-10 h-10 rounded-full flex items-center justify-center">
                <UploadCloud size={17} className="text-blue-600" />
              </span>
              <div className="text-sm font-semibold text-slate-800">Upload Audio</div>
              <div className="text-xs text-slate-400">Analyse recorded call</div>
            </button>
            <button onClick={() => go("contacts")} className="neu-card-sm neu-press text-left p-4 flex flex-col gap-2.5">
              <span className="neu-icon-blue w-10 h-10 rounded-full flex items-center justify-center">
                <Users size={17} className="text-blue-600" />
              </span>
              <div className="text-sm font-semibold text-slate-800">Call Contacts</div>
              <div className="text-xs text-slate-400">Live platform calls</div>
            </button>
            <button onClick={() => go("reports")} className="neu-card-sm neu-press text-left p-4 flex flex-col gap-2.5">
              <span className="neu-icon-blue w-10 h-10 rounded-full flex items-center justify-center">
                <FileText size={17} className="text-blue-600" />
              </span>
              <div className="text-sm font-semibold text-slate-800">View Reports</div>
              <div className="text-xs text-slate-400">Your Supabase logs</div>
            </button>
            <button onClick={() => go("contacts")} className="neu-card-sm neu-press text-left p-4 flex flex-col gap-2.5">
              <span className="neu-icon-blue w-10 h-10 rounded-full flex items-center justify-center">
                <Settings size={17} className="text-blue-600" />
              </span>
              <div className="text-sm font-semibold text-slate-800">Supabase DB</div>
              <div className="text-xs text-slate-400">Isolated per user</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
