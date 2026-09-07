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
        (SELECT COUNT(*) FROM enrollments) AS enrollments,
        (SELECT COUNT(*) FROM assessment_submissions) AS submissions,
        (SELECT COUNT(*) FROM assessment_submissions WHERE graded_at IS NOT NULL) AS graded_submissions,
        (SELECT COUNT(*) FROM unit_progress WHERE completed = TRUE) AS completed_units
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
    const targetId = Number(req.params.userId);
    if (!Number.isInteger(targetId) || targetId < 1) return res.status(400).json({ success: false, message: 'Invalid user ID' });
    if (targetId === Number(req.user.id)) return res.status(400).json({ success: false, message: 'You cannot deactivate your own admin account' });
    const isActive = req.body.isActive === true;
    const [target] = await pool.query(
      `SELECT u.id, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1`,
      [targetId]
    );
    if (!target.length) return res.status(404).json({ success: false, message: 'User not found' });
    if (target[0].role_name === 'admin') return res.status(403).json({ success: false, message: 'Administrator accounts cannot be changed from this screen' });
    await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive, targetId]);
    res.json({ success: true, isActive });
  } catch (error) { next(error); }
});

router.get('/courses', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.id, c.title, c.slug, c.level_name, c.is_published, c.created_at,
             CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS instructor_name,
             (SELECT COUNT(DISTINCT e.student_id) FROM enrollments e WHERE e.course_id = c.id) AS enrolled_count,
             (SELECT COUNT(*) FROM course_units cu WHERE cu.course_id = c.id) AS unit_count
      FROM courses c
      LEFT JOIN users u ON u.id = c.instructor_id
      ORDER BY c.created_at DESC
    `);
    res.json({ success: true, courses: rows });
  } catch (error) { next(error); }
});

router.patch('/courses/:courseId/publish', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId < 1) return res.status(400).json({ success: false, message: 'Invalid course ID' });
    const published = req.body.published === true;
    const [result] = await pool.query('UPDATE courses SET is_published = ? WHERE id = ?', [published, courseId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Course not found' });
    res.json({ success: true, published });
  } catch (error) { next(error); }
});

router.get('/instructors', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.is_active, u.created_at,
             COUNT(DISTINCT c.id) AS course_count,
             COUNT(DISTINCT CASE WHEN c.is_published = TRUE THEN c.id END) AS published_course_count,
             COUNT(DISTINCT e.student_id) AS total_students
      FROM users u
      JOIN roles r ON r.id = u.role_id AND r.name = 'instructor'
      LEFT JOIN courses c ON c.instructor_id = u.id
      LEFT JOIN enrollments e ON e.course_id = c.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json({ success: true, instructors: rows });
  } catch (error) { next(error); }
});

router.get('/reports/courses', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.id, c.title, c.level_name,
             CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS instructor_name,
             (SELECT COUNT(DISTINCT e.student_id) FROM enrollments e WHERE e.course_id = c.id) AS enrolled_count,
             (SELECT COUNT(*) FROM course_units cu WHERE cu.course_id = c.id) AS unit_count,
             (SELECT COUNT(*) FROM unit_progress up JOIN course_units cu2 ON cu2.id = up.unit_id WHERE cu2.course_id = c.id AND up.completed = TRUE) AS completed_units,
             (SELECT COUNT(*) FROM assessments a WHERE a.course_id = c.id) AS assessment_count,
             (SELECT COUNT(*) FROM assessment_submissions s JOIN assessments a2 ON a2.id = s.assessment_id WHERE a2.course_id = c.id) AS submission_count,
             (SELECT COUNT(*) FROM assessment_submissions s JOIN assessments a3 ON a3.id = s.assessment_id WHERE a3.course_id = c.id AND s.graded_at IS NOT NULL) AS graded_submission_count
      FROM courses c
      LEFT JOIN users u ON u.id = c.instructor_id
      ORDER BY enrolled_count DESC, c.title ASC
    `);
    res.json({ success: true, reports: rows });
  } catch (error) { next(error); }
});

router.get('/reports/students', async (_req, res, next) => {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.email,
             (SELECT COUNT(*) FROM enrollments e WHERE e.student_id = u.id) AS enrolled_courses,
             (SELECT COUNT(DISTINCT up.unit_id) FROM unit_progress up WHERE up.student_id = u.id AND up.completed = TRUE) AS completed_units,
             (SELECT COUNT(*) FROM assessment_submissions s WHERE s.student_id = u.id) AS submissions,
             (SELECT COUNT(*) FROM assessment_submissions s WHERE s.student_id = u.id AND s.graded_at IS NOT NULL) AS graded_submissions,
             (SELECT ROUND(AVG(s.score), 2) FROM assessment_submissions s WHERE s.student_id = u.id AND s.score IS NOT NULL) AS average_score
      FROM users u
      JOIN roles r ON r.id = u.role_id AND r.name = 'student'
      ORDER BY u.created_at DESC
    `);
    res.json({ success: true, reports: rows });
  } catch (error) { next(error); }
});

router.get('/courses/:courseId/students', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId < 1) return res.status(400).json({ success: false, message: 'Invalid course ID' });
    const [course] = await pool.query('SELECT id FROM courses WHERE id = ? LIMIT 1', [courseId]);
    if (!course.length) return res.status(404).json({ success: false, message: 'Course not found' });
    const [rows] = await pool.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, e.enrolled_at,
             (SELECT COUNT(DISTINCT up.unit_id) FROM unit_progress up JOIN course_units cu2 ON cu2.id = up.unit_id WHERE up.student_id = u.id AND cu2.course_id = ? AND up.completed = TRUE) AS completed_units,
             (SELECT COUNT(*) FROM course_units cu3 WHERE cu3.course_id = ?) AS total_units,
             (SELECT COUNT(*) FROM assessment_submissions s JOIN assessments a2 ON a2.id = s.assessment_id WHERE s.student_id = u.id AND a2.course_id = ?) AS submissions,
             (SELECT ROUND(AVG(s.score), 2) FROM assessment_submissions s JOIN assessments a3 ON a3.id = s.assessment_id WHERE s.student_id = u.id AND a3.course_id = ? AND s.score IS NOT NULL) AS average_score
      FROM enrollments e
      JOIN users u ON u.id = e.student_id
      WHERE e.course_id = ?
      ORDER BY e.enrolled_at DESC
    `, [courseId, courseId, courseId, courseId, courseId]);
    res.json({ success: true, students: rows });
  } catch (error) { next(error); }
});

export default router;
