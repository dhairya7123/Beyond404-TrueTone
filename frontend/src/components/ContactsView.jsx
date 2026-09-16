import React, { useMemo, useState } from "react";
import { Users, PhoneCall, RefreshCw, UserPlus, X, Phone, Mail } from "lucide-react";

const COLOR_PALETTE = [
  "neu-icon-blue text-blue-600",
  "neu-icon-red text-red-500",
  "neu-icon-slate text-violet-600",
  "neu-icon-green text-emerald-600",
  "neu-icon-amber text-amber-600",
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

export default function ContactsView({
  search,
  setSearch,
  startCall,
  currentUser,
  users,
  loading,
  onRefresh,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("password123");
  const [newRole, setNewRole] = useState("Analyst");
  const [newTag, setNewTag] = useState("Personal");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  const filtered = useMemo(() => {
    return users
      .filter((u) => u.id !== currentUser?.id)
      .filter((c) =>
        (c.name || "").toLowerCase().includes((search || "").toLowerCase()) ||
        (c.phone || "").includes(search || "") ||
        (c.email && c.email.toLowerCase().includes((search || "").toLowerCase())) ||
        (c.role && c.role.toLowerCase().includes((search || "").toLowerCase()))
      )
      .map((c, idx) => ({
        ...c,
        initials: getInitials(c.name),
        color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
      }));
  }, [users, currentUser, search]);

  async function handleAddUser(e) {
    e.preventDefault();
    setCreating(true);
    setCreateErr("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          phone: newPhone,
          password: newPassword,
          role: newRole,
          tag: newTag,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add user.");
      }
      setModalOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      onRefresh();
    } catch (err) {
      setCreateErr(err.message || "Failed to create user.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="neu-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
            SUPABASE PLATFORM USERS
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Platform Contacts</h1>
          <p className="text-slate-500 text-sm mt-1">
            Only verified users of this platform are listed. Call any member to test real-time AI forensics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh from Supabase"
            className="neu-card-sm neu-press flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold text-slate-600"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-blue-600" : ""} />
            Refresh
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="neu-btn-blue neu-press flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold shadow-sm"
          >
            <UserPlus size={14} /> Add Platform User
          </button>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
          <div className="neu-card p-6 max-w-md w-full relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Add Platform User</h2>
            <p className="text-xs text-slate-500 mb-4">Saved directly into Supabase PostgreSQL.</p>
            {createErr && (
              <div className="neu-icon-red rounded-xl p-3 mb-3 text-xs text-red-600">
                {createErr}
              </div>
            )}
            <form onSubmit={handleAddUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Full Name</label>
                <input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Vikramaditya Rao"
                  className="neu-inset w-full px-3 py-2 rounded-xl text-xs text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Email</label>
                <input
                  required
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. vikram@beyond404.ai"
                  className="neu-inset w-full px-3 py-2 rounded-xl text-xs text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-semibold mb-1">Phone Number</label>
                <input
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="e.g. +91 97766 55443"
                  className="neu-inset w-full px-3 py-2 rounded-xl text-xs text-slate-800 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Role</label>
                  <input
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="Analyst"
                    className="neu-inset w-full px-3 py-2 rounded-xl text-xs text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Tag</label>
                  <select
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="neu-inset w-full px-3 py-2 rounded-xl text-xs text-slate-800 outline-none"
                  >
                    <option value="Personal">Personal</option>
                    <option value="Business">Business</option>
                  </select>
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="neu-card-sm neu-press px-4 py-2 rounded-full font-semibold text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="neu-btn-blue neu-press px-5 py-2 rounded-full font-semibold text-white"
                >
                  {creating ? "Adding..." : "Save to Supabase"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading && users.length === 0 ? (
        <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-[3px] border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <span>Fetching platform users from Supabase...</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-left border-b border-white/70">
                <th className="font-medium py-3 w-12">#</th>
                <th className="font-medium py-3">Platform User</th>
                <th className="font-medium py-3">Role / Tag</th>
                <th className="font-medium py-3">Phone &amp; Email</th>
                <th className="font-medium py-3 w-28 text-right">Initiate Call</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={c.id || c.phone} className="border-b border-white/60 hover:bg-white/40 transition-colors group">
                  <td className="py-3 text-slate-400">{i + 1}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${c.color}`}>
                        {c.initials}
                      </div>
                      <div>
                        <div className="text-slate-800 font-semibold">{c.name}</div>
                        <div className="text-[11px] text-slate-400">ID #{c.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-slate-700">{c.role || "Member"}</span>
                      <span className="text-[11px] text-slate-400">{c.tag || "Personal"}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="text-slate-600 font-medium">{c.phone}</div>
                    <div className="text-xs text-slate-400">{c.email}</div>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => startCall(c.name, c.phone, c.initials, c.role)}
                      aria-label={`Call ${c.name}`}
                      className="neu-card-sm neu-press inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-emerald-600 font-semibold"
                    >
                      <PhoneCall size={15} /> Call
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No platform users found matching “{search}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
