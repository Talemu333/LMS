import express from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('student'));

router.get('/dashboard', async (req, res, next) => {
  try {
    const [[stats]] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM enrollments WHERE student_id = ?) AS enrolled_courses,
        (SELECT COUNT(*) FROM unit_progress WHERE student_id = ? AND completed = TRUE) AS completed_units,
        (SELECT COUNT(*) FROM assessment_submissions WHERE student_id = ?) AS submitted_assessments,
        (SELECT COUNT(*) FROM assessments a JOIN enrollments e ON e.course_id = a.course_id WHERE e.student_id = ?) AS available_assessments`,
      [req.user.id, req.user.id, req.user.id, req.user.id]
    );
    res.json({ success: true, stats });
  } catch (error) { next(error); }
});

router.get('/courses', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.title, c.slug, c.description, c.level_name,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS instructor_name,
              EXISTS(SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.student_id = ?) AS enrolled,
              (SELECT COUNT(*) FROM course_units cu WHERE cu.course_id = c.id) AS unit_count,
              (SELECT COUNT(*) FROM course_units cu JOIN unit_progress up ON up.unit_id = cu.id AND up.student_id = ? AND up.completed = TRUE WHERE cu.course_id = c.id) AS completed_units
       FROM courses c
       LEFT JOIN users u ON u.id = c.instructor_id
       WHERE c.is_published = TRUE
       ORDER BY c.created_at DESC`,
      [req.user.id, req.user.id]
    );
    res.json({ success: true, courses: rows });
  } catch (error) { next(error); }
});

router.post('/courses/:courseId/enroll', async (req, res, next) => {
  try {
    const [courses] = await pool.query('SELECT id FROM courses WHERE id = ? AND is_published = TRUE', [req.params.courseId]);
    if (!courses.length) return res.status(404).json({ success: false, message: 'Course not found' });
    try {
      await pool.query('INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)', [req.user.id, req.params.courseId]);
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;
    }
    res.status(201).json({ success: true, message: 'Enrolled successfully' });
  } catch (error) { next(error); }
});

router.get('/courses/:courseId', async (req, res, next) => {
  try {
    const [courses] = await pool.query(
      `SELECT c.id, c.title, c.slug, c.description, c.level_name,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS instructor_name,
              EXISTS(SELECT 1 FROM enrollments e2 WHERE e2.course_id = c.id AND e2.student_id = ?) AS enrolled
       FROM courses c LEFT JOIN users u ON u.id = c.instructor_id
       WHERE c.id = ? AND c.is_published = TRUE`,
      [req.user.id, req.params.courseId]
    );
    if (!courses.length) return res.status(404).json({ success: false, message: 'Course not found' });
    const enrolled = Boolean(courses[0].enrolled);

    if (!enrolled) return res.json({ success: true, course: courses[0], enrolled: false, units: [], assessments: [] });

    const [units] = await pool.query(
      `SELECT cu.id, cu.title, cu.description, cu.unit_order, cu.content,
              COALESCE(up.completed, FALSE) AS completed, up.completed_at
       FROM course_units cu
       LEFT JOIN unit_progress up ON up.unit_id = cu.id AND up.student_id = ?
       WHERE cu.course_id = ? ORDER BY cu.unit_order ASC`,
      [req.user.id, req.params.courseId]
    );
    const [assessments] = await pool.query(
      `SELECT a.id, a.unit_id, a.title, a.description, a.assessment_type, a.max_score, a.due_at,
              s.id AS submission_id, s.answer_text, s.score, s.feedback, s.submitted_at, s.graded_at
       FROM assessments a
       LEFT JOIN assessment_submissions s ON s.assessment_id = a.id AND s.student_id = ?
       WHERE a.course_id = ? ORDER BY a.created_at DESC`,
      [req.user.id, req.params.courseId]
    );
    res.json({ success: true, course: courses[0], enrolled: true, units, assessments });
  } catch (error) { next(error); }
});

router.patch('/units/:unitId/progress', async (req, res, next) => {
  try {
    const completed = req.body.completed === true;
    const [units] = await pool.query(
      `SELECT cu.id FROM course_units cu
       JOIN enrollments e ON e.course_id = cu.course_id AND e.student_id = ?
       WHERE cu.id = ?`,
      [req.user.id, req.params.unitId]
    );
    if (!units.length) return res.status(404).json({ success: false, message: 'Unit not found or you are not enrolled' });
    await pool.query(
      `INSERT INTO unit_progress (student_id, unit_id, completed, completed_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE completed = VALUES(completed), completed_at = VALUES(completed_at)`,
      [req.user.id, req.params.unitId, completed, completed ? new Date() : null]
    );
    res.json({ success: true, completed });
  } catch (error) { next(error); }
});

router.post('/assessments/:assessmentId/submit', async (req, res, next) => {
  try {
    const answerText = String(req.body.answerText || '').trim();
    if (!answerText) return res.status(400).json({ success: false, message: 'Answer is required' });
    const [assessments] = await pool.query(
      `SELECT a.id, a.due_at FROM assessments a
       JOIN enrollments e ON e.course_id = a.course_id AND e.student_id = ?
       WHERE a.id = ?`,
      [req.user.id, req.params.assessmentId]
    );
    if (!assessments.length) return res.status(404).json({ success: false, message: 'Assessment not found or you are not enrolled' });
    const assessment = assessments[0];
    if (assessment.due_at && new Date(assessment.due_at) < new Date()) return res.status(400).json({ success: false, message: 'This assessment is past its due date' });
    await pool.query(
      `INSERT INTO assessment_submissions (assessment_id, student_id, answer_text)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text), submitted_at = CURRENT_TIMESTAMP`,
      [req.params.assessmentId, req.user.id, answerText]
    );
    res.status(201).json({ success: true, message: 'Assessment submitted successfully' });
  } catch (error) { next(error); }
});

export default router;
