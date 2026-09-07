import express from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [[stats]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'student') AS students,
        (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'instructor') AS instructors,
        (SELECT COUNT(*) FROM courses) AS total_courses,
        (SELECT COUNT(*) FROM courses WHERE is_published = TRUE) AS published_courses,
        (SELECT COUNT(*) FROM enrollments) AS enrollments
    `);
    res.json({ success: true, stats });
  } catch (error) { next(error); }
});

router.get('/users', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.is_active, u.created_at,
             r.name AS role_name
      FROM users u JOIN roles r ON r.id = u.role_id
      ORDER BY u.created_at DESC
    `);
    res.json({ success: true, users: rows });
  } catch (error) { next(error); }
});

router.patch('/users/:userId/status', async (req, res, next) => {
  try {
    const isActive = req.body.isActive === true;
    const [result] = await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive, req.params.userId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, isActive });
  } catch (error) { next(error); }
});

router.get('/courses', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.id, c.title, c.slug, c.level_name, c.is_published, c.created_at,
             CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS instructor_name,
             COUNT(DISTINCT e.student_id) AS enrolled_count,
             COUNT(DISTINCT cu.id) AS unit_count
      FROM courses c
      LEFT JOIN users u ON u.id = c.instructor_id
      LEFT JOIN enrollments e ON e.course_id = c.id
      LEFT JOIN course_units cu ON cu.course_id = c.id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json({ success: true, courses: rows });
  } catch (error) { next(error); }
});

router.patch('/courses/:courseId/publish', async (req, res, next) => {
  try {
    const published = req.body.published === true;
    const [result] = await pool.query('UPDATE courses SET is_published = ? WHERE id = ?', [published, req.params.courseId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Course not found' });
    res.json({ success: true, published });
  } catch (error) { next(error); }
});

export default router;
