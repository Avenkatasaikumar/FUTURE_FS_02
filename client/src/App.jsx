import { useEffect, useState, useCallback } from "react";
import { api } from "./api.js";

const STATUSES = ["new", "contacted", "converted"];
const fmt = (d) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/* ---------- Public contact form (what a website visitor sees) ---------- */
function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", phone: "", message: "" });
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api("/leads", { method: "POST", body: f });
      setMsg("Thanks! We'll get back to you soon.");
      setF({ name: "", email: "", phone: "", message: "" });
    } catch (err) { setMsg(err.message); }
  };
  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>Contact us</h1>
      <input placeholder="Your name" value={f.name} onChange={set("name")} required />
      <input type="email" placeholder="Email" value={f.email} onChange={set("email")} required />
      <input placeholder="Phone (optional)" value={f.phone} onChange={set("phone")} />
      <textarea placeholder="How can we help?" rows="4" value={f.message} onChange={set("message")} />
      <button className="primary">Send message</button>
      {msg && <p className="hint">{msg}</p>}
    </form>
  );
}

/* ---------- Admin login ---------- */
function Login({ onToken }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { token } = await api("/auth/login", { method: "POST", body: { email, password } });
      localStorage.setItem("token", token);
      onToken(token);
    } catch (e2) { setErr(e2.message); }
  };
  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>Admin sign in</h1>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button className="primary">Sign in</button>
      {err && <p className="error">{err}</p>}
    </form>
  );
}

/* ---------- Lead detail: status + notes ---------- */
function LeadPanel({ lead, token, onChange, onClose, onDelete }) {
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const setStatus = async (status) => onChange(await api(`/leads/${lead._id}`, { method: "PATCH", body: { status }, token }));
  const addNote = async (e) => {
    e.preventDefault();
    onChange(await api(`/leads/${lead._id}/notes`, { method: "POST", body: { text, followUpDate: date }, token }));
    setText(""); setDate("");
  };
  return (
    <aside className="panel">
      <button className="link" onClick={onClose}>Close</button>
      <h2>{lead.name}</h2>
      <p>{lead.email}{lead.phone && ` · ${lead.phone}`}</p>
      <p className="hint">From {lead.source} on {fmt(lead.createdAt)}</p>
      {lead.message && <blockquote>{lead.message}</blockquote>}
      <div className="seg">
        {STATUSES.map((s) => (
          <button key={s} className={lead.status === s ? `on ${s}` : ""} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>
      <h3>Notes and follow-ups</h3>
      <form onSubmit={addNote}>
        <textarea rows="3" placeholder="What happened? What's next?" value={text} onChange={(e) => setText(e.target.value)} required />
        <label className="hint">Follow up on <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <button className="primary">Add note</button>
      </form>
      {lead.notes.length === 0 && <p className="hint">No notes yet. Add the first one above.</p>}
      {[...lead.notes].reverse().map((n) => (
        <div className="note" key={n._id}>
          <p>{n.text}</p>
          <span className="hint">
            {fmt(n.createdAt)}{n.followUpDate && ` · follow up ${new Date(n.followUpDate).toLocaleDateString()}`}
          </span>
        </div>
      ))}
      <button className="danger" onClick={() => onDelete(lead._id)}>Delete lead</button>
    </aside>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard({ token, onLogout }) {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ ...(status && { status }), ...(q && { q }) });
      const [l, s] = await Promise.all([api(`/leads?${params}`, { token }), api("/stats", { token })]);
      setLeads(l); setStats(s);
    } catch (e) { if (e.status === 401) onLogout(); }
  }, [token, status, q, onLogout]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const replace = (updated) => { setLeads((ls) => ls.map((x) => (x._id === updated._id ? updated : x))); api("/stats", { token }).then(setStats); };
  const remove = async (id) => {
    if (!confirm("Delete this lead permanently?")) return;
    await api(`/leads/${id}`, { method: "DELETE", token });
    setOpenId(null); load();
  };
  const open = leads.find((l) => l._id === openId);

  return (
    <div className="shell">
      <header>
        <h1>Leads</h1>
        <button className="link" onClick={onLogout}>Sign out</button>
      </header>
      {stats && (
        <div className="stats">
          <div><b>{stats.total}</b> total</div>
          <div><b>{stats.new}</b> new</div>
          <div><b>{stats.contacted}</b> contacted</div>
          <div><b>{stats.converted}</b> converted</div>
          <div><b>{stats.conversionRate}%</b> conversion</div>
        </div>
      )}
      <div className="tools">
        <input placeholder="Search name, email or source" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="split">
        <div className="tablewrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Source</th><th>Status</th><th>Received</th></tr></thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l._id} onClick={() => setOpenId(l._id)} className={l._id === openId ? "sel" : ""}>
                  <td>{l.name}</td><td>{l.email}</td><td>{l.source}</td>
                  <td><span className={`pill ${l.status}`}>{l.status}</span></td>
                  <td>{fmt(l.createdAt)}</td>
                </tr>
              ))}
              {leads.length === 0 && <tr><td colSpan="5" className="hint">No leads match. Submit one from the contact form to see it here.</td></tr>}
            </tbody>
          </table>
        </div>
        {open && <LeadPanel lead={open} token={token} onChange={replace} onClose={() => setOpenId(null)} onDelete={remove} />}
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const logout = useCallback(() => { localStorage.removeItem("token"); setToken(null); }, []);
  if (location.pathname === "/contact") return <ContactForm />;
  return token ? <Dashboard token={token} onLogout={logout} /> : <Login onToken={setToken} />;
}
