import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BookOpen, CheckCircle2, ArrowRight } from 'lucide-react';

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

function StudentOverview() {
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/student/courses')
      .then(data => setCourses(data.courses || []))
      .catch(err => setError(err.message));
  }, []);

  const enrolled = courses.filter(course => Boolean(course.enrolled));
  const completed = enrolled.filter(course => Number(course.progress_percent) >= 100).length;
  const averageProgress = enrolled.length
    ? Math.round(enrolled.reduce((sum, course) => sum + Number(course.progress_percent || 0), 0) / enrolled.length)
    : 0;

  return (
    <div className="student-overview">
      {error && <div className="error-box">{error}</div>}
      <div className="student-learning-summary">
        <div className="student-summary-card">
          <div className="student-summary-icon"><BookOpen size={19} /></div>
          <div><span>Enrolled courses</span><strong>{enrolled.length}</strong></div>
        </div>
        <div className="student-summary-card">
          <div className="student-summary-icon"><CheckCircle2 size={19} /></div>
          <div><span>Completed courses</span><strong>{completed}</strong></div>
        </div>
        <div className="student-summary-card">
          <div className="student-summary-icon"><ArrowRight size={19} /></div>
          <div><span>Average progress</span><strong>{averageProgress}%</strong></div>
        </div>
      </div>
    </div>
  );
}

function enhance() {
  const main = document.querySelector('main.main');
  if (!main) return;
  const title = main.querySelector('.page-title')?.textContent?.trim();
  if (title !== 'My Courses') return;
  if (main.querySelector('.student-overview-root')) return;

  const rootEl = document.createElement('div');
  rootEl.className = 'student-overview-root';
  const target = main.querySelector('.page-role');
  main.insertBefore(rootEl, target || null);
  createRoot(rootEl).render(<StudentOverview />);
}

new MutationObserver(enhance).observe(document.body, { childList: true, subtree: true });
enhance();
