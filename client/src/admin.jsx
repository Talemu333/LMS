import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (data.user.role !== 'admin') throw new Error('This account does not have administrator access.');
      onLogin(data.user);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  return <div className="auth"><div className="auth-box"><div className="auth-brand"><div><h1>ELES Administration</h1><p>Administrator sign in</p></div></div><form onSubmit={submit}><div className="form-group"><label>Email</label><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Admin email" /></div><div className="form-group"><label>Password</label><input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" /></div>{error && <div className="error-box">{error}</div>}<button className="btn btn-primary full" disabled={loading}>{loading ? 'Signing in...' : 'Admin Login'}</button><a className="btn btn-light full" href="/">Back to LMS</a></form></div></div>;
}

function AdminDashboard({ user, onLogout }) {
  const [stats, setStats] = useState(null), [users, setUsers] = useState([]), [courses, setCourses] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError('');
    try {
      const [dashboard, userData, courseData] = await Promise.all([api('/admin/dashboard'), api('/admin/users'), api('/admin/courses')]);
      setStats(dashboard.stats); setUsers(userData.users); setCourses(courseData.courses);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function toggleUser(id, isActive) {
    try { await api(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: !isActive }) }); await load(); }
    catch (err) { setError(err.message); }
  }
  async function toggleCourse(id, published) {
    try { await api(`/admin/courses/${id}/publish`, { method: 'PATCH', body: JSON.stringify({ published: !published }) }); await load(); }
    catch (err) { setError(err.message); }
  }
  return <div className="app"><header className="topbar"><div className="brand">ELES Administration</div><div className="user-area"><span className="user-name">{user.firstName} {user.lastName}</span><button className="btn btn-light logout-btn" onClick={onLogout}>Logout</button></div></header><main className="main" style={{ maxWidth: 1200, margin: '0 auto' }}><h1 className="page-title">Admin Dashboard</h1><p className="muted">Manage users, courses and publishing.</p>{error && <div className="error-box">{error}</div>}{loading ? <div className="card empty">Loading administration data...</div> : <><div className="cards"><Stat title="Total Users" value={stats.total_users}/><Stat title="Students" value={stats.students}/><Stat title="Instructors" value={stats.instructors}/><Stat title="Courses" value={stats.total_courses}/><Stat title="Published" value={stats.published_courses}/><Stat title="Enrollments" value={stats.enrollments}/></div><section className="section"><h2>Users</h2><div className="card" style={{overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.first_name} {u.last_name}</td><td>{u.email}</td><td>{u.role_name}</td><td>{u.is_active ? 'Active' : 'Inactive'}</td><td><button className="btn btn-light" disabled={u.id===user.id} onClick={() => toggleUser(u.id, u.is_active)}>{u.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div></section><section className="section"><h2>Courses</h2><div className="card" style={{overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Course</th><th>Level</th><th>Instructor</th><th>Units</th><th>Students</th><th>Status</th><th>Action</th></tr></thead><tbody>{courses.map(c=><tr key={c.id}><td>{c.title}</td><td>{c.level_name}</td><td>{c.instructor_name?.trim() || '—'}</td><td>{c.unit_count}</td><td>{c.enrolled_count}</td><td>{c.is_published ? 'Published' : 'Draft'}</td><td><button className="btn btn-light" onClick={() => toggleCourse(c.id, c.is_published)}>{c.is_published ? 'Unpublish' : 'Publish'}</button></td></tr>)}</tbody></table></div></section></>}</main></div>;
}
function Stat({ title, value }) { return <div className="card stat-card"><div className="muted stat-label">{title}</div><div className="stat">{value ?? '—'}</div></div>; }
function AdminApp() {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true);
  useEffect(() => { api('/auth/me').then(d => { if (d.user.role === 'admin') setUser(d.user); }).catch(() => {}).finally(() => setLoading(false)); }, []);
  async function logout() { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null); }
  if (loading) return <div className="loading-screen">Loading administration...</div>;
  if (!user) return <AdminLogin onLogin={setUser}/>;
  return <AdminDashboard user={user} onLogout={logout}/>;
}

if (window.location.pathname.startsWith('/admin')) createRoot(document.getElementById('root')).render(<AdminApp />);
