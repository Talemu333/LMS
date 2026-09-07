import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ShieldCheck } from 'lucide-react';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'https://eles-lms-api.onrender.com/api';

async function api(options) {
  const response = await fetch(`${API_URL}/auth/bootstrap-admin`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-admin-setup-key': options.setupKey },
    body: JSON.stringify({ firstName: options.firstName, lastName: options.lastName, email: options.email, password: options.password })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Administrator setup failed');
  return data;
}

function AdminSetup() {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', setupKey: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function change(e) { setForm(current => ({ ...current, [e.target.name]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.');
    if (form.setupKey.length < 16) return setError('Enter the administrator setup key configured on the server.');
    setLoading(true);
    try {
      const data = await api(form);
      window.location.href = '/admin';
      return data;
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  return <div className="auth"><div className="auth-box">
    <div className="auth-brand"><ShieldCheck size={30} /><div><h1>Initial Administrator Setup</h1><p>Create the first ELES administrator account.</p></div></div>
    <form onSubmit={submit}>
      <div className="form-row"><div className="form-group"><label>First name</label><input required name="firstName" value={form.firstName} onChange={change} /></div><div className="form-group"><label>Last name</label><input required name="lastName" value={form.lastName} onChange={change} /></div></div>
      <div className="form-group"><label>Email</label><input required type="email" name="email" value={form.email} onChange={change} placeholder="Admin email" /></div>
      <div className="form-group"><label>Password</label><input required type="password" name="password" value={form.password} onChange={change} /></div>
      <div className="form-group"><label>Confirm password</label><input required type="password" name="confirmPassword" value={form.confirmPassword} onChange={change} /></div>
      <div className="form-group"><label>Setup key</label><input required type="password" name="setupKey" value={form.setupKey} onChange={change} placeholder="Server administrator setup key" /></div>
      {error && <div className="error-box">{error}</div>}
      <button className="btn btn-primary full" disabled={loading}>{loading ? 'Creating administrator...' : 'Create Administrator'}</button>
      <a className="btn btn-light full" href="/admin">Back to Admin Login</a>
    </form>
  </div></div>;
}

createRoot(document.getElementById('root')).render(<AdminSetup />);
