import React, { useEffect, useState } from 'react';
import { MessageCircle, Send, Trash2, X } from 'lucide-react';

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

export default function ForumPage({ role = 'student', onClose }) {
  const [posts, setPosts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [replies, setReplies] = useState([]);
  const [form, setForm] = useState({ title: '', body: '', courseId: '' });
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadPosts() {
    setLoading(true);
    try { setPosts((await api('/forum/posts')).posts); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadPosts(); }, []);

  async function openPost(id) {
    setError('');
    try {
      const data = await api(`/forum/posts/${id}`);
      setSelected(data.post);
      setReplies(data.replies || []);
    } catch (e) { setError(e.message); }
  }

  async function createPost(e) {
    e.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      await api('/forum/posts', { method: 'POST', body: JSON.stringify({
        title: form.title,
        body: form.body,
        courseId: form.courseId || null
      }) });
      setForm({ title: '', body: '', courseId: '' });
      setMessage('Discussion topic created.');
      await loadPosts();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function createReply(e) {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    setSaving(true); setError('');
    try {
      await api(`/forum/posts/${selected.id}/replies`, { method: 'POST', body: JSON.stringify({ body: reply }) });
      setReply('');
      await openPost(selected.id);
      await loadPosts();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function removePost(id) {
    if (!window.confirm('Delete this discussion?')) return;
    try { await api(`/forum/posts/${id}`, { method: 'DELETE' }); setSelected(null); await loadPosts(); }
    catch (e) { setError(e.message); }
  }

  async function removeReply(id) {
    if (!window.confirm('Delete this reply?')) return;
    try {
      await api(`/forum/replies/${id}`, { method: 'DELETE' });
      if (selected) await openPost(selected.id);
      await loadPosts();
    } catch (e) { setError(e.message); }
  }

  return <>
    <h1 className="page-title">Forum</h1>
    <p className="muted">Discuss course topics with instructors and other students.</p>
    {error && <div className="error-box">{error}</div>}
    {message && <div className="success-box">{message}</div>}

    <div className="card">
      <h2>Start a Discussion</h2>
      <form onSubmit={createPost}>
        <div className="form-group"><label>Topic title</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="What would you like to discuss?" /></div>
        <div className="form-group"><label>Course ID (optional)</label><input value={form.courseId} onChange={e => setForm({ ...form, courseId: e.target.value })} placeholder="Leave blank for general discussion" /></div>
        <div className="form-group"><label>Message</label><textarea required value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Write your message..." /></div>
        <button className="btn btn-primary" disabled={saving}><Send size={16} /> {saving ? 'Posting...' : 'Post Discussion'}</button>
      </form>
    </div>

    <section className="section">
      <h2>Recent Discussions</h2>
      {loading ? <div className="card empty">Loading discussions...</div> : posts.length === 0 ? <div className="card empty">No discussions yet. Start the first one above.</div> : <div className="cards">{posts.map(post => <article className="card" key={post.id}>
        <div className="muted"><MessageCircle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />{post.author_name?.trim() || 'ELES User'} · {new Date(post.created_at).toLocaleString()}</div>
        <h3>{post.title}</h3>
        <p style={{ whiteSpace: 'pre-wrap' }}>{post.body}</p>
        <p className="muted">{post.course_title ? `Course: ${post.course_title} · ` : ''}{post.reply_count || 0} repl{Number(post.reply_count) === 1 ? 'y' : 'ies'}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-light" onClick={() => openPost(post.id)}>View Discussion</button>
          <button className="btn btn-danger" onClick={() => removePost(post.id)}><Trash2 size={16} /> Delete</button>
        </div>
      </article>)}</div>}
    </section>

    {selected && <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}><h2>{selected.title}</h2><button className="btn btn-light" onClick={() => setSelected(null)}><X size={16} /> Close</button></div>
      <p className="muted">{selected.author_name?.trim() || 'ELES User'} · {new Date(selected.created_at).toLocaleString()}</p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{selected.body}</p>
      <h3>Replies</h3>
      {replies.length === 0 ? <p className="muted">No replies yet.</p> : replies.map(item => <div className="card" key={item.id} style={{ marginBottom: 10 }}><div className="muted">{item.author_name?.trim() || 'ELES User'} · {new Date(item.created_at).toLocaleString()}</div><p style={{ whiteSpace: 'pre-wrap' }}>{item.body}</p><button className="btn btn-danger" onClick={() => removeReply(item.id)}><Trash2 size={16} /> Delete</button></div>)}
      <form onSubmit={createReply}><div className="form-group"><label>Your reply</label><textarea required value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply..." /></div><button className="btn btn-primary" disabled={saving}><Send size={16} /> Reply</button></form>
    </div>}
  </>;
}
