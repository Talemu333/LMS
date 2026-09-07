import express from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

async function canAccessCourse(courseId, user) {
  if (!courseId || user.role === 'admin') return true;
  if (user.role === 'instructor') {
    const [rows] = await pool.query('SELECT id FROM courses WHERE id = ? AND instructor_id = ? LIMIT 1', [courseId, user.id]);
    return rows.length > 0;
  }
  const [rows] = await pool.query('SELECT id FROM enrollments WHERE course_id = ? AND student_id = ? LIMIT 1', [courseId, user.id]);
  return rows.length > 0;
}

router.get('/posts', async (req, res, next) => {
  try {
    let where = 'p.course_id IS NULL';
    const params = [];
    if (req.user.role === 'admin') where = '1 = 1';
    else if (req.user.role === 'instructor') {
      where = '(p.course_id IS NULL OR c.instructor_id = ?)';
      params.push(req.user.id);
    } else {
      where = '(p.course_id IS NULL OR EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = p.course_id AND e.student_id = ?))';
      params.push(req.user.id);
    }
    const [rows] = await pool.query(
      `SELECT p.id, p.course_id, p.author_id, p.title, p.body, p.created_at,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS author_name,
              c.title AS course_title, COUNT(r.id) AS reply_count
       FROM forum_posts p
       JOIN users u ON u.id = p.author_id
       LEFT JOIN courses c ON c.id = p.course_id
       LEFT JOIN forum_replies r ON r.post_id = p.id
       WHERE ${where}
       GROUP BY p.id, p.course_id, p.author_id, p.title, p.body, p.created_at, u.first_name, u.last_name, c.title
       ORDER BY p.created_at DESC`,
      params
    );
    res.json({ success: true, posts: rows });
  } catch (error) { next(error); }
});

router.get('/posts/:postId', async (req, res, next) => {
  try {
    const [posts] = await pool.query(
      `SELECT p.id, p.course_id, p.title, p.body, p.created_at, p.author_id,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS author_name,
              c.title AS course_title
       FROM forum_posts p JOIN users u ON u.id = p.author_id
       LEFT JOIN courses c ON c.id = p.course_id
       WHERE p.id = ? LIMIT 1`,
      [req.params.postId]
    );
    if (!posts.length) return res.status(404).json({ success: false, message: 'Forum post not found' });
    if (!(await canAccessCourse(posts[0].course_id, req.user))) return res.status(403).json({ success: false, message: 'You do not have access to this forum topic' });
    const [replies] = await pool.query(
      `SELECT r.id, r.post_id, r.body, r.created_at, r.author_id,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS author_name
       FROM forum_replies r JOIN users u ON u.id = r.author_id
       WHERE r.post_id = ? ORDER BY r.created_at ASC`,
      [req.params.postId]
    );
    res.json({ success: true, post: posts[0], replies });
  } catch (error) { next(error); }
});

router.post('/posts', async (req, res, next) => {
  try {
    const courseId = req.body.courseId ? Number(req.body.courseId) : null;
    const title = String(req.body.title || '').trim();
    const body = String(req.body.body || '').trim();
    if (!title || !body) return res.status(400).json({ success: false, message: 'Title and message are required' });
    if (req.body.courseId && (!Number.isInteger(courseId) || courseId < 1)) return res.status(400).json({ success: false, message: 'Invalid course ID' });
    if (courseId) {
      const [courses] = await pool.query('SELECT id FROM courses WHERE id = ?', [courseId]);
      if (!courses.length) return res.status(404).json({ success: false, message: 'Course not found' });
      if (!(await canAccessCourse(courseId, req.user))) return res.status(403).json({ success: false, message: 'You do not have access to this course forum' });
    }
    const [result] = await pool.query('INSERT INTO forum_posts (author_id, course_id, title, body) VALUES (?, ?, ?, ?)', [req.user.id, courseId, title, body]);
    res.status(201).json({ success: true, postId: result.insertId });
  } catch (error) { next(error); }
});

router.post('/posts/:postId/replies', async (req, res, next) => {
  try {
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ success: false, message: 'Reply message is required' });
    const [posts] = await pool.query('SELECT id, course_id FROM forum_posts WHERE id = ?', [req.params.postId]);
    if (!posts.length) return res.status(404).json({ success: false, message: 'Forum post not found' });
    if (!(await canAccessCourse(posts[0].course_id, req.user))) return res.status(403).json({ success: false, message: 'You do not have access to this forum topic' });
    const [result] = await pool.query('INSERT INTO forum_replies (post_id, author_id, body) VALUES (?, ?, ?)', [req.params.postId, req.user.id, body]);
    res.status(201).json({ success: true, replyId: result.insertId });
  } catch (error) { next(error); }
});

router.delete('/posts/:postId', async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM forum_posts WHERE id = ? AND author_id = ?', [req.params.postId, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Forum post not found' });
    res.json({ success: true, message: 'Forum post deleted' });
  } catch (error) { next(error); }
});

router.delete('/replies/:replyId', async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM forum_replies WHERE id = ? AND author_id = ?', [req.params.replyId, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Reply not found' });
    res.json({ success: true, message: 'Reply deleted' });
  } catch (error) { next(error); }
});

export default router;
