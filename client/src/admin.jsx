import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  async function submit(e) { e.preventDefault(); setError(''); setLoading(true); try { const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }); if (data.user.role !== 'admin') throw new Error('This account does not have administrator access.'); onLogin(data.user); } catch (err) { setError(err.message); } finally { setLoading(false); } }
  return <div className="auth"><div className="auth-box"><div className="auth-brand"><div><h1>ELES Administration</h1><p>Administrator sign in</p></div></div><form onSubmit={submit}><div className="form-group"><label>Email</label><input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Admin email" /></div><div className="form-group"><label>Password</label><input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" /></div>{error && <div className="error-box">{error}</div>}<button className="btn btn-primary full" disabled={loading}>{loading ? 'Signing in...' : 'Admin Login'}</button><a className="btn btn-light full" href="/">Back to LMS</a></form></div></div>;
}

function AdminDashboard({ user, onLogout }) {
  const [stats, setStats] = useState(null), [users, setUsers] = useState([]), [courses, setCourses] = useState([]), [instructors, setInstructors] = useState([]), [courseReports, setCourseReports] = useState([]), [studentReports, setStudentReports] = useState([]), [selectedCourse, setSelectedCourse] = useState(null), [courseStudents, setCourseStudents] = useState([]), [tab, setTab] = useState('overview'), [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      const [dashboard, userData, courseData, instructorData, courseReportData, studentReportData] = await Promise.all([
        api('/admin/dashboard'), api('/admin/users'), api('/admin/courses'), api('/admin/instructors'), api('/admin/reports/courses'), api('/admin/reports/students')
      ]);
      setStats(dashboard.stats); setUsers(userData.users); setCourses(courseData.courses); setInstructors(instructorData.instructors); setCourseReports(courseReportData.reports); setStudentReports(studentReportData.reports);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function toggleUser(id, isActive) { setBusy(true); try { await api(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive: !isActive }) }); await load(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  async function toggleCourse(id, published) { setBusy(true); try { await api(`/admin/courses/${id}/publish`, { method: 'PATCH', body: JSON.stringify({ published: !published }) }); await load(); } catch (err) { setError(err.message); } finally { setBusy(false); } }
  async function viewStudents(course) { setError(''); setSelectedCourse(course); try { setCourseStudents((await api(`/admin/courses/${course.id}/students`)).students); } catch (err) { setError(err.message); } }

  if (loading) return <div className="loading-screen">Loading administration...</div>;
  const tabs = [['overview','Overview'],['users','Users'],['instructors','Instructors'],['courses','Courses'],['reports','Reports']];
  return <div className="app"><header className="topbar"><div className="brand">ELES Administration</div><div className="user-area"><span className="user-name">{user.firstName} {user.lastName}</span><button className="btn btn-light logout-btn" onClick={onLogout}>Logout</button></div></header><main className="main" style={{maxWidth:1200,margin:'0 auto'}}><h1 className="page-title">Admin Dashboard</h1><p className="muted">Manage users, instructors, courses and platform performance.</p>{error&&<div className="error-box">{error}</div>}<div className="admin-tabs">{tabs.map(([id,label])=><button key={id} className={`btn ${tab===id?'btn-primary':'btn-light'}`} onClick={()=>setTab(id)}>{label}</button>)}</div>

  {tab==='overview'&&<><div className="cards"><Stat title="Total Users" value={stats.total_users}/><Stat title="Students" value={stats.students}/><Stat title="Instructors" value={stats.instructors}/><Stat title="Courses" value={stats.total_courses}/><Stat title="Published" value={stats.published_courses}/><Stat title="Enrollments" value={stats.enrollments}/><Stat title="Submissions" value={stats.submissions}/><Stat title="Graded" value={stats.graded_submissions}/><Stat title="Completed Units" value={stats.completed_units}/></div><section className="section"><div className="card info-box"><strong>Platform performance</strong><p>{stats.graded_submissions} of {stats.submissions} assessment submissions have been graded. Students have recorded {stats.completed_units} completed learning units.</p></div></section></>}

  {tab==='users'&&<section className="section"><h2>Users</h2><div className="card" style={{overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.first_name} {u.last_name}</td><td>{u.email}</td><td>{u.role_name}</td><td>{u.is_active?'Active':'Inactive'}</td><td><button className="btn btn-light" disabled={busy||u.id===user.id} onClick={()=>toggleUser(u.id,u.is_active)}>{u.is_active?'Deactivate':'Activate'}</button></td></tr>)}</tbody></table></div></section>}

  {tab==='instructors'&&<section className="section"><h2>Instructor Performance</h2><div className="card" style={{overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Instructor</th><th>Email</th><th>Courses</th><th>Published</th><th>Students</th><th>Status</th></tr></thead><tbody>{instructors.map(i=><tr key={i.id}><td>{i.first_name} {i.last_name}</td><td>{i.email}</td><td>{i.course_count}</td><td>{i.published_course_count}</td><td>{i.total_students}</td><td>{i.is_active?'Active':'Inactive'}</td></tr>)}</tbody></table></div></section>}

  {tab==='courses'&&<section className="section"><h2>Course Management</h2><div className="card" style={{overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Course</th><th>Level</th><th>Instructor</th><th>Units</th><th>Students</th><th>Status</th><th>Actions</th></tr></thead><tbody>{courses.map(c=><tr key={c.id}><td>{c.title}</td><td>{c.level_name}</td><td>{c.instructor_name?.trim()||'—'}</td><td>{c.unit_count}</td><td>{c.enrolled_count}</td><td>{c.is_published?'Published':'Draft'}</td><td><button className="btn btn-light" disabled={busy} onClick={()=>toggleCourse(c.id,c.is_published)}>{c.is_published?'Unpublish':'Publish'}</button> <button className="btn btn-light" onClick={()=>viewStudents(c)}>Students</button></td></tr>)}</tbody></table></div></section>}

  {tab==='reports'&&<><section className="section"><h2>Course Reports</h2><div className="card" style={{overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Course</th><th>Instructor</th><th>Students</th><th>Units</th><th>Completed</th><th>Assessments</th><th>Submissions</th><th>Graded</th></tr></thead><tbody>{courseReports.map(r=><tr key={r.id}><td>{r.title}</td><td>{r.instructor_name?.trim()||'—'}</td><td>{r.enrolled_count}</td><td>{r.unit_count}</td><td>{r.completed_units}</td><td>{r.assessment_count}</td><td>{r.submission_count}</td><td>{r.graded_submission_count}</td></tr>)}</tbody></table></div></section><section className="section"><h2>Student Reports</h2><div className="card" style={{overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Student</th><th>Email</th><th>Courses</th><th>Completed Units</th><th>Submissions</th><th>Graded</th><th>Average Score</th></tr></thead><tbody>{studentReports.map(r=><tr key={r.id}><td>{r.first_name} {r.last_name}</td><td>{r.email}</td><td>{r.enrolled_courses}</td><td>{r.completed_units}</td><td>{r.submissions}</td><td>{r.graded_submissions}</td><td>{r.average_score??'—'}</td></tr>)}</tbody></table></div></section></>}

  {selectedCourse&&<section className="section"><div className="card"><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}><div><h2>{selectedCourse.title} — Enrolled Students</h2><p className="muted">Student progress and assessment performance.</p></div><button className="btn btn-light" onClick={()=>setSelectedCourse(null)}>Close</button></div>{courseStudents.length===0?<div className="empty">No students are enrolled in this course.</div>:<div style={{overflowX:'auto'}}><table className="admin-table"><thead><tr><th>Student</th><th>Email</th><th>Enrolled</th><th>Progress</th><th>Submissions</th><th>Average Score</th></tr></thead><tbody>{courseStudents.map(s=><tr key={s.id}><td>{s.first_name} {s.last_name}</td><td>{s.email}</td><td>{new Date(s.enrolled_at).toLocaleDateString()}</td><td>{s.completed_units}/{s.total_units}</td><td>{s.submissions}</td><td>{s.average_score??'—'}</td></tr>)}</tbody></table></div>}</div></section>}
  </main></div>;
}
function Stat({title,value}){return <div className="card stat-card"><div className="muted stat-label">{title}</div><div className="stat">{value??'—'}</div></div>}
function AdminApp(){const[user,setUser]=useState(null),[loading,setLoading]=useState(true);useEffect(()=>{api('/auth/me').then(d=>{if(d.user.role==='admin')setUser(d.user)}).catch(()=>{}).finally(()=>setLoading(false))},[]);async function logout(){await api('/auth/logout',{method:'POST'}).catch(()=>{});setUser(null)}if(loading)return <div className="loading-screen">Loading administration...</div>;if(!user)return <AdminLogin onLogin={setUser}/>;return <AdminDashboard user={user} onLogout={logout}/>}

if(window.location.pathname.startsWith('/admin'))createRoot(document.getElementById('root')).render(<AdminApp/>);
