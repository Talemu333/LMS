import express from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/instructor', requireAuth, requireRole('instructor', 'admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT tm.id, tm.course_id, tm.title, tm.description, tm.file_path, tm.url,
              c.title AS course_title, c.level_name
       FROM teaching_manuals tm
       JOIN courses c ON c.id = tm.course_id
       WHERE c.instructor_id = ?
       ORDER BY tm.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, manuals: rows });
  } catch (error) { next(error); }
});

router.post('/instructor', requireAuth, requireRole('instructor', 'admin'), async (req, res, next) => {
  try {
    const courseId = Number(req.body.courseId);
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const url = String(req.body.url || '').trim();

    if (!Number.isInteger(courseId) || !title) {
      return res.status(400).json({ success: false, message: 'Course and manual title are required' });
    }

    const [courses] = await pool.query(
      'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
      [courseId, req.user.id]
    );
    if (!courses.length) return res.status(404).json({ success: false, message: 'Course not found' });

    const [result] = await pool.query(
      `INSERT INTO teaching_manuals (course_id, title, description, url)
       VALUES (?, ?, ?, ?)`,
      [courseId, title, description || null, url || null]
    );

    const [rows] = await pool.query(
      `SELECT tm.id, tm.course_id, tm.title, tm.description, tm.file_path, tm.url,
              c.title AS course_title, c.level_name
       FROM teaching_manuals tm JOIN courses c ON c.id = tm.course_id
       WHERE tm.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ success: true, manual: rows[0] });
  } catch (error) { next(error); }
});

router.delete('/instructor/:manualId', requireAuth, requireRole('instructor', 'admin'), async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `DELETE tm FROM teaching_manuals tm
       JOIN courses c ON c.id = tm.course_id
       WHERE tm.id = ? AND c.instructor_id = ?`,
      [req.params.manualId, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Teaching manual not found' });
    res.json({ success: true, message: 'Teaching manual deleted' });
  } catch (error) { next(error); }
});

router.get('/student', requireAuth, requireRole('student'), async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT tm.id, tm.course_id, tm.title, tm.description, tm.file_path, tm.url,
              c.title AS course_title, c.level_name
       FROM teaching_manuals tm
       JOIN courses c ON c.id = tm.course_id
       JOIN enrollments e ON e.course_id = c.id AND e.student_id = ?
       WHERE c.is_published = TRUE
       ORDER BY c.title ASC, tm.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, manuals: rows });
  } catch (error) { next(error); }
});

export default router;
