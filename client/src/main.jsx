import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Bell, BookOpen, ChevronRight, CirclePlus, ClipboardCheck, GraduationCap, House, LogOut, Menu, MessageCircle, X, Layers, UserRound } from 'lucide-react';
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
  const [role, setRole] = useState('student');
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  async function submit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      if (mode === 'register') {
        const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ ...form, role }) });
        onLogin(data.user);
      } else {
        const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: form.email, password: form.password }) });
        if (data.user.role !== role) throw new Error('Invalid email, password or account type.');
        onLogin(data.user);
      }
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  function resetForm() { setError(''); setForm({ firstName: '', lastName: '', email: '', password: '' }); }
  const registering = mode === 'register';
  const roleName = role === 'instructor' ? 'instructor' : 'student';

  return (
    <div className="auth"><div className="auth-box">
      <div className="auth-brand"><GraduationCap size={30} /><div><h1>Early Learning Services</h1><p><UserRound size={14} /> Early Childhood Learning Management System</p></div></div>
      <div className="role-switch">
        <button className={role === 'student' ? 'active' : ''} onClick={() => { setRole('student'); resetForm(); }}>Student</button>
        <button className={role === 'instructor' ? 'active' : ''} onClick={() => { setRole('instructor'); resetForm(); }}>Instructor</button>
      </div>

      {registering ? (
        <form onSubmit={submit}>
          <h2>Create {roleName} account</h2>
          <p className="muted">Create your ELES {roleName} account.</p>
          <div className="two-col"><Field label="First Name" value={form.firstName} onChange={v => update('firstName', v)} placeholder="First name" /><Field label="Last Name" value={form.lastName} onChange={v => update('lastName', v)} placeholder="Last name" /></div>
          <Field label="Email" type="email" value={form.email} onChange={v => update('email', v)} placeholder="Enter email" />
          <Field label="Password" type="password" value={form.password} onChange={v => update('password', v)} placeholder="At least 8 characters" />
          {error && <div className="error-box">{error}</div>}
          <button className="btn btn-primary full" disabled={loading}>{loading ? 'Creating account...' : 'Create Account'}</button>
          <button type="button" className="btn btn-light full" onClick={() => { resetForm(); setMode('login'); }}>Back to Login</button>
        </form>
      ) : (
        <form onSubmit={submit}>
          <h2>Welcome back</h2><p className="muted">Sign in to continue to your learning space.</p>
          <Field label="Email" type="email" value={form.email} onChange={v => update('email', v)} placeholder="Enter email" />
          <Field label="Password" type="password" value={form.password} onChange={v => update('password', v)} placeholder="Enter password" />
          {error && <div className="error-box">{error}</div>}
          <button className="btn btn-primary full" disabled={loading}>{loading ? 'Signing in...' : 'Login'}</button>
          <button type="button" className="btn btn-light full" onClick={() => { resetForm(); setMode('register'); }}>Create {roleName} Account</button>
          <button type="button" className="link-button" onClick={() => setError('Password reset will be connected to email delivery in the next authentication step.')}>Forgot Password?</button>
        </form>
      )}
    </div></div>
  );
}

function Field({ label, type = 'text', value, onChange, placeholder }) { return <div className="form-group"><label>{label}</label><input required type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} /></div>; }

function App() {
  const [user, setUser] = useState(null); const [page, setPage] = useState('dashboard'); const [loading, setLoading] = useState(true); const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => { api('/auth/me').then(data => setUser(data.user)).catch(() => {}).finally(() => setLoading(false)); }, []);
  async function logout() { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); setPage('dashboard'); }
  if (loading) return <div className="loading-screen">Loading ELES LMS...</div>;
  if (!user) return <AuthPage onLogin={setUser} />;
  const items = user.role === 'instructor' ? [...navItems, ...instructorItems] : navItems;
  return <div className="app"><header className="topbar"><div className="brand"><GraduationCap size={24} /> Early Learning Services</div><div className="user-area"><span className="user-name">{user.firstName} {user.lastName}</span><div className="avatar">{user.firstName?.[0]?.toUpperCase()}</div><button className="btn btn-light logout-btn" onClick={logout}><LogOut size={16} /> Logout</button><button className="menu-btn" onClick={() => setMobileNav(v => !v)}>{mobileNav ? <X /> : <Menu />}</button></div></header><div className="layout"><aside className={`sidebar ${mobileNav ? 'open' : ''}`}><div className="nav-title">Main Menu</div><nav className="nav">{items.map(item => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => { setPage(item.id); setMobileNav(false); }}><Icon size={18} />{item.label}<ChevronRight size={14} className="nav-arrow" /></button>; })}</nav></aside><main className="main"><Page page={page} user={user} /></main></div></div>;
}

function Page({ page, user }) {
  const roleLabel = user.role === 'instructor' ? 'Instructor' : 'Student';
  const pages = { dashboard: <Dashboard user={user} />, teachingManual: <SimplePage title="Teaching Manual" text={user.role === 'instructor' ? 'Manage the course outline and teaching manual for your students.' : 'Your instructor’s course outline and teaching manual will appear here.'} />, announcements: <SimplePage title="Announcements" text={user.role === 'instructor' ? 'Create and publish announcements for your students.' : 'Announcements from your instructors will appear here.'} />, forum: <SimplePage title="Forum" text={user.role === 'instructor' ? 'Create discussion topics and respond to students.' : 'Join course discussions and respond to your instructor.'} />, level: <SimplePage title="Level" text="Set the title and description students will see for the course level." />, units: <UnitsPage />, assessments: <AssessmentsPage /> };
  return <>{pages[page] || <Dashboard user={user} />}<div className="page-role">Signed in as {roleLabel}</div></>;
}

function Dashboard({ user }) { return <><h1 className="page-title">{user.role === 'instructor' ? 'Instructor' : 'Student'} Dashboard</h1><p className="muted">Your course overview.</p><div className="cards"><StatCard icon={<Layers />} title="Level Courses" value="0" text="No level has been set yet." /><StatCard icon={<BookOpen />} title="Units" value="0" text="No units have been selected." /><StatCard icon={<ClipboardCheck />} title="Assessment Methods" value="0" text="No assessment methods have been selected." /></div><section className="section"><div className="section-head"><div><h2>Welcome to ELES LMS</h2><p className="muted">The dashboard will populate from your MySQL data as the LMS modules are connected.</p></div></div><div className="card info-box"><strong>Early Childhood Learning Management System</strong><p>Courses, units, teaching manuals, assessments, announcements and forum activity will be managed from this interface.</p></div></section></>; }
function StatCard({ icon, title, value, text }) { return <div className="card stat-card"><div className="muted stat-label">{icon}{title}</div><div className="stat">{value}</div><p className="muted">{text}</p></div>; }
function SimplePage({ title, text }) { return <><h1 className="page-title">{title}</h1><p className="muted">{text}</p><section className="section"><div className="card empty">This module is next in the LMS build. The interface is now using the attached frontend structure, ready to be connected to its MySQL API.</div></section></>; }
function UnitsPage() { return <><h1 className="page-title">Select Your Units</h1><p className="muted">Select a unit you will teach, provide its title and status, then add the description students should see.</p><div className="card"><Field label="Unit title" placeholder="Enter the unit title" value="" onChange={() => {}} /><div className="two-col"><div className="form-group"><label>Unit number</label><select defaultValue="01"><option value="01">Unit 01</option><option value="02">Unit 02</option><option value="03">Unit 03</option></select></div><div className="form-group"><label>Unit status</label><select defaultValue="Mandatory"><option>Mandatory</option><option>Optional</option></select></div></div><div className="form-group"><label>Unit description</label><textarea placeholder="Describe what students will learn in this unit..." /></div><button className="btn btn-primary">Save Unit</button></div></>; }
function AssessmentsPage() { return <><h1 className="page-title">Assessment Methods</h1><p className="muted">Choose an assessment method to make it available to students.</p><div className="card"><div className="form-group"><label>Assessment type</label><select defaultValue="Direct Observation"><option>Direct Observation</option><option>Question and Answer</option><option>Personal Statement</option><option>Work Practice</option></select></div><button className="btn btn-primary">Save Assessment Method</button></div><section className="section"><div className="card empty">No assessment methods have been added.</div></section></>; }

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
