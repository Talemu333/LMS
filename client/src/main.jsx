import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bell, BookOpen, ChevronRight, CirclePlus, ClipboardCheck, GraduationCap, House, LogOut, Menu, MessageCircle, X, Layers, UserRound, Trash2 } from 'lucide-react';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: House },
  { id: 'teachingManual', label: 'Teaching Manual', icon: BookOpen },
  { id: 'announcements', label: 'Announcements', icon: Bell },
  { id: 'forum', label: 'Forum', icon: MessageCircle }
];
const instructorItems = [
  { id: 'level', label: 'Level', icon: Layers },
  { id: 'units', label: 'Add Units', icon: CirclePlus },
  { id: 'assessments', label: 'Assessment Methods', icon: ClipboardCheck }
];

function AuthPage({ onLogin }) {
  const [role, setRole] = useState('student'), [mode, setMode] = useState('login');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  async function submit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (mode === 'register') onLogin((await api('/auth/register', { method: 'POST', body: JSON.stringify({ ...form, role }) })).user);
      else { const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: form.email, password: form.password }) }); if (data.user.role !== role) throw new Error('Invalid email, password or account type.'); onLogin(data.user); }
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  function resetForm() { setError(''); setForm({ firstName: '', lastName: '', email: '', password: '' }); }
  const registering = mode === 'register', roleName = role === 'instructor' ? 'instructor' : 'student';
  return <div className="auth"><div className="auth-box">
    <div className="auth-brand"><GraduationCap size={30} /><div><h1>Early Learning Services</h1><p><UserRound size={14} /> Early Childhood Learning Management System</p></div></div>
    <div className="role-switch"><button className={role === 'student' ? 'active' : ''} onClick={() => { setRole('student'); resetForm(); }}>Student</button><button className={role === 'instructor' ? 'active' : ''} onClick={() => { setRole('instructor'); resetForm(); }}>Instructor</button></div>
    <form onSubmit={submit}>
      <h2>{registering ? `Create ${roleName} account` : 'Welcome back'}</h2><p className="muted">{registering ? `Create your ELES ${roleName} account.` : 'Sign in to continue to your learning space.'}</p>
      {registering && <div className="two-col"><Field label="First Name" value={form.firstName} onChange={v => update('firstName', v)} placeholder="First name" /><Field label="Last Name" value={form.lastName} onChange={v => update('lastName', v)} placeholder="Last name" /></div>}
      <Field label="Email" type="email" value={form.email} onChange={v => update('email', v)} placeholder="Enter email" /><Field label="Password" type="password" value={form.password} onChange={v => update('password', v)} placeholder={registering ? 'At least 8 characters' : 'Enter password'} />
      {error && <div className="error-box">{error}</div>}
      <button className="btn btn-primary full" disabled={loading}>{loading ? (registering ? 'Creating account...' : 'Signing in...') : (registering ? 'Create Account' : 'Login')}</button>
      <button type="button" className="btn btn-light full" onClick={() => { resetForm(); setMode(registering ? 'login' : 'register'); }}>{registering ? 'Back to Login' : `Create ${roleName} Account`}</button>
      {!registering && <button type="button" className="link-button" onClick={() => setError('Password reset will be connected to email delivery in the next authentication step.')}>Forgot Password?</button>}
    </form>
  </div></div>;
}
function Field({ label, type = 'text', value, onChange, placeholder }) { return <div className="form-group"><label>{label}</label><input required type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} /></div>; }

function App() {
  const [user, setUser] = useState(null), [page, setPage] = useState('dashboard'), [loading, setLoading] = useState(true), [mobileNav, setMobileNav] = useState(false);
  useEffect(() => { api('/auth/me').then(data => setUser(data.user)).catch(() => {}).finally(() => setLoading(false)); }, []);
  async function logout() { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); setPage('dashboard'); }
  if (loading) return <div className="loading-screen">Loading ELES LMS...</div>;
  if (!user) return <AuthPage onLogin={setUser} />;
  const items = user.role === 'instructor' ? [...navItems, ...instructorItems] : navItems;
  return <div className="app"><header className="topbar"><div className="brand"><GraduationCap size={24} /> Early Learning Services</div><div className="user-area"><span className="user-name">{user.firstName} {user.lastName}</span><div className="avatar">{user.firstName?.[0]?.toUpperCase()}</div><button className="btn btn-light logout-btn" onClick={logout}><LogOut size={16} /> Logout</button><button className="menu-btn" onClick={() => setMobileNav(v => !v)}>{mobileNav ? <X /> : <Menu />}</button></div></header><div className="layout"><aside className={`sidebar ${mobileNav ? 'open' : ''}`}><div className="nav-title">Main Menu</div><nav className="nav">{items.map(item => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => { setPage(item.id); setMobileNav(false); }}><Icon size={18} />{item.label}<ChevronRight size={14} className="nav-arrow" /></button>; })}</nav></aside><main className="main"><Page page={page} user={user} /></main></div></div>;
}
function Page({ page, user }) {
  const roleLabel = user.role === 'instructor' ? 'Instructor' : 'Student';
  const pages = { dashboard: <Dashboard user={user} />, teachingManual: <SimplePage title="Teaching Manual" text="Manage the course outline and teaching manual for your students." />, announcements: <SimplePage title="Announcements" text="Create and publish announcements for your students." />, forum: <SimplePage title="Forum" text="Create discussion topics and respond to students." />, level: <LevelPage />, units: <UnitsPage />, assessments: <AssessmentsPage /> };
  return <>{pages[page] || <Dashboard user={user} />}<div className="page-role">Signed in as {roleLabel}</div></>;
}
function Dashboard({ user }) { return <><h1 className="page-title">{user.role === 'instructor' ? 'Instructor' : 'Student'} Dashboard</h1><p className="muted">Your course overview.</p><div className="cards"><StatCard icon={<Layers />} title="Level Courses" value="—" text="Connected to your MySQL course data." /><StatCard icon={<BookOpen />} title="Units" value="—" text="Connected to your course units." /><StatCard icon={<ClipboardCheck />} title="Assessment Methods" value="—" text="Assessment module is next." /></div><section className="section"><div className="card info-box"><strong>Early Childhood Learning Management System</strong><p>Courses, units, teaching manuals, assessments, announcements and forum activity are being connected to MySQL.</p></div></section></>; }
function StatCard({ icon, title, value, text }) { return <div className="card stat-card"><div className="muted stat-label">{icon}{title}</div><div className="stat">{value}</div><p className="muted">{text}</p></div>; }
function SimplePage({ title, text }) { return <><h1 className="page-title">{title}</h1><p className="muted">{text}</p><section className="section"><div className="card empty">This module is queued for the next LMS build step.</div></section></>; }

function LevelPage() {
  const [courses, setCourses] = useState([]), [form, setForm] = useState({ title: '', levelName: '', description: '' });
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function load() { setLoading(true); try { setCourses((await api('/instructor/courses')).courses); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  async function save(e) { e.preventDefault(); setError(''); setMessage(''); setSaving(true); try { await api('/instructor/courses', { method: 'POST', body: JSON.stringify(form) }); setForm({ title: '', levelName: '', description: '' }); setMessage('Level course saved successfully.'); await load(); } catch (e) { setError(e.message); } finally { setSaving(false); } }
  return <><h1 className="page-title">Level</h1><p className="muted">Create the level/course students will see in the LMS.</p><div className="card"><form onSubmit={save}><Field label="Course title" value={form.title} onChange={v => setForm({ ...form, title: v })} placeholder="e.g. Early Childhood Development" /><Field label="Level" value={form.levelName} onChange={v => setForm({ ...form, levelName: v })} placeholder="e.g. Level 2" /><div className="form-group"><label>Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe this level/course..." /></div>{error && <div className="error-box">{error}</div>}{message && <div className="success-box">{message}</div>}<button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Level'}</button></form></div><section className="section"><h2>Your Level Courses</h2>{loading ? <div className="card empty">Loading...</div> : courses.length === 0 ? <div className="card empty">No level courses have been created.</div> : <div className="cards">{courses.map(c => <div className="card" key={c.id}><h3>{c.title}</h3><p className="muted">{c.level_name}</p><p>{c.description || 'No description provided.'}</p><strong>{c.unit_count} unit{Number(c.unit_count) === 1 ? '' : 's'}</strong></div>)}</div>}</section></>;
}

function UnitsPage() {
  const [courses, setCourses] = useState([]), [selected, setSelected] = useState(''), [units, setUnits] = useState([]);
  const [form, setForm] = useState({ title: '', unitOrder: '1', description: '', content: '' });
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function loadCourses() { try { const data = await api('/instructor/courses'); setCourses(data.courses); if (!selected && data.courses[0]) setSelected(String(data.courses[0].id)); } catch (e) { setError(e.message); } finally { setLoading(false); } }
  async function loadUnits(id = selected) { if (!id) { setUnits([]); return; } try { setUnits((await api(`/instructor/courses/${id}/units`)).units); } catch (e) { setError(e.message); } }
  useEffect(() => { loadCourses(); }, []);
  useEffect(() => { if (selected) loadUnits(selected); }, [selected]);
  async function save(e) { e.preventDefault(); setError(''); setMessage(''); if (!selected) return setError('Create a level/course first.'); setSaving(true); try { await api(`/instructor/courses/${selected}/units`, { method: 'POST', body: JSON.stringify(form) }); setForm({ title: '', unitOrder: String(units.length + 2), description: '', content: '' }); setMessage('Unit saved successfully.'); await loadUnits(selected); } catch (e) { setError(e.message); } finally { setSaving(false); } }
  return <><h1 className="page-title">Select Your Units</h1><p className="muted">Add units to one of your level courses and save their description and learning content.</p>{loading ? <div className="card empty">Loading courses...</div> : courses.length === 0 ? <div className="card empty">No level course exists yet. Go to <strong>Level</strong> and create one first.</div> : <><div className="card"><div className="form-group"><label>Level / Course</label><select value={selected} onChange={e => setSelected(e.target.value)}>{courses.map(c => <option key={c.id} value={c.id}>{c.level_name} — {c.title}</option>)}</select></div><form onSubmit={save}><Field label="Unit title" placeholder="Enter the unit title" value={form.title} onChange={v => setForm({ ...form, title: v })} /><div className="form-group"><label>Unit number</label><select value={form.unitOrder} onChange={e => setForm({ ...form, unitOrder: e.target.value })}>{Array.from({ length: 20 }, (_, i) => <option key={i + 1} value={i + 1}>Unit {String(i + 1).padStart(2, '0')}</option>)}</select></div><div className="form-group"><label>Unit description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe what students will learn in this unit..." /></div><div className="form-group"><label>Learning content</label><textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Add the main learning content for this unit..." /></div>{error && <div className="error-box">{error}</div>}{message && <div className="success-box">{message}</div>}<button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Unit'}</button></form></div><section className="section"><h2>Saved Units</h2>{units.length === 0 ? <div className="card empty">No units have been added to this course.</div> : <div className="cards">{units.map(unit => <div className="card" key={unit.id}><div className="muted">Unit {String(unit.unit_order).padStart(2, '0')}</div><h3>{unit.title}</h3><p>{unit.description || 'No description provided.'}</p>{unit.content && <p className="muted">{unit.content}</p>}</div>)}</div>}</section></>}</>;
}
function AssessmentsPage() { return <><h1 className="page-title">Assessment Methods</h1><p className="muted">Choose an assessment method to make it available to students.</p><div className="card"><div className="form-group"><label>Assessment type</label><select defaultValue="Direct Observation"><option>Direct Observation</option><option>Question and Answer</option><option>Personal Statement</option><option>Work Practice</option></select></div><button className="btn btn-primary">Save Assessment Method</button></div><section className="section"><div className="card empty">Assessment methods will be connected to the database next.</div></section></>; }
createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
