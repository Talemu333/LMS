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

    if (!Number.isInteger(courseId) || courseId < 1 || !title) {
      return res.status(400).json({ success: false, message: 'Course and manual title are required' });
    }

    const [courses] = await pool.query(
      'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
      [courseId, req.user.id]
    );
    if (!courses.length) return res.status(404).json({ success: false, message: 'Course not found' });

    // The instructor UI edits the current course manual. Keep one active manual per course
    // instead of creating duplicate rows every time the instructor clicks Save.
    const [existing] = await pool.query(
      `SELECT id FROM teaching_manuals
       WHERE course_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [courseId]
    );

    let manualId;
    let status = 201;
    if (existing.length) {
      manualId = existing[0].id;
      await pool.query(
        `UPDATE teaching_manuals
         SET title = ?, description = ?, url = ?
         WHERE id = ? AND course_id = ?`,
        [title, description || null, url || null, manualId, courseId]
      );
      status = 200;
    } else {
      const [result] = await pool.query(
        `INSERT INTO teaching_manuals (course_id, title, description, url)
         VALUES (?, ?, ?, ?)`,
        [courseId, title, description || null, url || null]
      );
      manualId = result.insertId;
    }

    const [rows] = await pool.query(
      `SELECT tm.id, tm.course_id, tm.title, tm.description, tm.file_path, tm.url,
              c.title AS course_title, c.level_name
       FROM teaching_manuals tm JOIN courses c ON c.id = tm.course_id
       WHERE tm.id = ? AND c.instructor_id = ?`,
      [manualId, req.user.id]
    );
    res.status(status).json({ success: true, manual: rows[0] });
  } catch (error) { next(error); }
});

router.delete('/instructor/:manualId', requireAuth, requireRole('instructor', 'admin'), async (req, res, next) => {
  try {
    const manualId = Number(req.params.manualId);
    if (!Number.isInteger(manualId) || manualId < 1) return res.status(400).json({ success: false, message: 'Invalid manual ID' });
    const [result] = await pool.query(
      `DELETE tm FROM teaching_manuals tm
       JOIN courses c ON c.id = tm.course_id
       WHERE tm.id = ? AND c.instructor_id = ?`,
      [manualId, req.user.id]
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
