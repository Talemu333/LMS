import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
async function adminApi(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setError('');
    try {
      const [dashboard, userData, courseData] = await Promise.all([
        adminApi('/admin/dashboard'),
        adminApi('/admin/users'),
        adminApi('/admin/courses')
      ]);
      setStats(dashboard.stats);
      setUsers(userData.users);
      setCourses(courseData.courses);
    } catch (e) { setError(e.message); }
  }

  useEffect(() => { load(); }, []);

  async function setUserStatus(id, isActive) {
    setBusy(true); setError('');
    try {
      await adminApi(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
      setUsers(prev => prev.map(u => u.id === id ? { ...u, is_active: isActive } : u));
      if (stats) setStats({ ...stats });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function publish(id, published) {
    setBusy(true); setError('');
    try {
      await adminApi(`/admin/courses/${id}/publish`, { method: 'PATCH', body: JSON.stringify({ published }) });
      setCourses(prev => prev.map(c => c.id === id ? { ...c, is_published: published } : c));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (!stats) return <><h1 className="page-title">Admin Dashboard</h1><div className="card empty">Loading administration data...</div>{error && <div className="error-box">{error}</div>}</>;

  return <>
    <h1 className="page-title">Admin Dashboard</h1>
    <p className="muted">Manage users, courses and platform activity.</p>
    {error && <div className="error-box">{error}</div>}
    <div className="cards">
      <Stat title="Total Users" value={stats.total_users} />
      <Stat title="Students" value={stats.students} />
      <Stat title="Instructors" value={stats.instructors} />
      <Stat title="Courses" value={stats.total_courses} />
      <Stat title="Published Courses" value={stats.published_courses} />
      <Stat title="Enrollments" value={stats.enrollments} />
    </div>
    <section className="section">
      <div className="card">
        <div className="admin-tabs">
          <button className={`btn ${tab === 'overview' ? 'btn-primary' : 'btn-light'}`} onClick={() => setTab('overview')}>Overview</button>
          <button className={`btn ${tab === 'users' ? 'btn-primary' : 'btn-light'}`} onClick={() => setTab('users')}>Users</button>
          <button className={`btn ${tab === 'courses' ? 'btn-primary' : 'btn-light'}`} onClick={() => setTab('courses')}>Courses</button>
        </div>
      </div>
      {tab === 'overview' && <div className="cards"><div className="card info-box"><strong>Platform status</strong><p>Authentication, courses, enrollments and administration are connected to MySQL.</p></div><div className="card info-box"><strong>Published courses</strong><p>{stats.published_courses} of {stats.total_courses} courses are currently visible to students.</p></div></div>}
      {tab === 'users' && <div className="card table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td>{u.first_name} {u.last_name}</td><td>{u.email}</td><td>{u.role_name}</td><td>{u.is_active ? 'Active' : 'Inactive'}</td><td><button className="btn btn-light" disabled={busy} onClick={() => setUserStatus(u.id, !u.is_active)}>{u.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div>}
      {tab === 'courses' && <div className="card table-wrap"><table><thead><tr><th>Course</th><th>Level</th><th>Instructor</th><th>Units</th><th>Students</th><th>Status</th><th>Action</th></tr></thead><tbody>{courses.map(c => <tr key={c.id}><td>{c.title}</td><td>{c.level_name}</td><td>{c.instructor_name?.trim() || '—'}</td><td>{c.unit_count}</td><td>{c.enrolled_count}</td><td>{c.is_published ? 'Published' : 'Draft'}</td><td><button className="btn btn-light" disabled={busy} onClick={() => publish(c.id, !c.is_published)}>{c.is_published ? 'Unpublish' : 'Publish'}</button></td></tr>)}</tbody></table></div>}
    </section>
  </>;
}

function Stat({ title, value }) { return <div className="card stat-card"><div className="muted stat-label">{title}</div><div className="stat">{value ?? 0}</div></div>; }

function mount() {
  const root = document.getElementById('admin-root');
  if (root && !root.dataset.mounted) { root.dataset.mounted = 'true'; createRoot(root).render(<AdminDashboard />); }
}

window.addEventListener('eles-admin-ready', mount);
setTimeout(mount, 0);
