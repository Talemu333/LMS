import express from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('instructor'));

function dbFailure(res, error, fallback) {
  console.error('INSTRUCTOR COURSE/UNIT API ERROR:', {
    code: error?.code,
    errno: error?.errno,
    sqlState: error?.sqlState,
    message: error?.message
  });
  if (error?.code === 'ER_NO_SUCH_TABLE') {
    return res.status(503).json({ success: false, message: 'The LMS database is missing a required table. Run the current LMS schema against the connected database.' });
  }
  if (error?.code === 'ER_BAD_FIELD_ERROR') {
    return res.status(503).json({ success: false, message: 'The LMS database structure is older than the current application. Run the current LMS schema against the connected database.' });
  }
  return res.status(500).json({ success: false, message: fallback });
}

router.get('/dashboard', async (req, res) => {
  try {
    const [[courseCount]] = await pool.query('SELECT COUNT(*) AS course_count FROM courses WHERE instructor_id = ?', [req.user.id]);
    const [[unitCount]] = await pool.query('SELECT COUNT(*) AS unit_count FROM course_units u JOIN courses c ON c.id = u.course_id WHERE c.instructor_id = ?', [req.user.id]);
    const [[studentCount]] = await pool.query('SELECT COUNT(DISTINCT e.student_id) AS student_count FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE c.instructor_id = ?', [req.user.id]);
    const [[assessmentCount]] = await pool.query('SELECT COUNT(*) AS assessment_count FROM assessments a JOIN courses c ON c.id = a.course_id WHERE c.instructor_id = ?', [req.user.id]);
    const [[submissionCount]] = await pool.query('SELECT COUNT(*) AS submission_count FROM assessment_submissions s JOIN assessments a ON a.id = s.assessment_id JOIN courses c ON c.id = a.course_id WHERE c.instructor_id = ?', [req.user.id]);
    res.json({ success: true, stats: { ...courseCount, ...unitCount, ...studentCount, ...assessmentCount, ...submissionCount } });
  } catch (error) {
    dbFailure(res, error, 'Unable to load the instructor dashboard.');
  }
});

router.get('/courses', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.title, c.slug, c.description, c.level_name, c.is_published,
              c.created_at,
              (SELECT COUNT(*) FROM course_units u WHERE u.course_id = c.id) AS unit_count,
              (SELECT COUNT(DISTINCT e.student_id) FROM enrollments e WHERE e.course_id = c.id) AS enrolled_count
       FROM courses c
       WHERE c.instructor_id = ?
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, courses: rows });
  } catch (error) {
    dbFailure(res, error, 'Unable to load your levels.');
  }
});

router.get('/courses/:courseId/units', async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId < 1) return res.status(400).json({ success: false, message: 'Invalid course ID' });
    const [rows] = await pool.query(
      `SELECT u.id, u.course_id, u.title, u.description, u.unit_order, u.status
       FROM course_units u
       JOIN courses c ON c.id = u.course_id
       WHERE u.course_id = ? AND c.instructor_id = ?
       ORDER BY u.unit_order ASC`,
      [courseId, req.user.id]
    );
    res.json({ success: true, units: rows });
  } catch (error) {
    dbFailure(res, error, 'Unable to load your units.');
  }
});

router.post('/courses/:courseId/units', async (req, res) => {
  try {
    const courseId = Number(req.params.courseId);
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const status = String(req.body.status || 'Mandatory').trim();
    const unitOrder = Number(req.body.unitOrder);

    if (!Number.isInteger(courseId) || courseId < 1) return res.status(400).json({ success: false, message: 'Invalid course ID' });
    if (!title || !Number.isInteger(unitOrder) || unitOrder < 1 || unitOrder > 20) return res.status(400).json({ success: false, message: 'Unit title and a valid unit number from 1 to 20 are required' });
    if (!['Mandatory', 'Optional'].includes(status)) return res.status(400).json({ success: false, message: 'Unit status must be Mandatory or Optional' });

    const [courses] = await pool.query('SELECT id FROM courses WHERE id = ? AND instructor_id = ? LIMIT 1', [courseId, req.user.id]);
    if (!courses.length) return res.status(404).json({ success: false, message: 'Course not found' });

    const [assigned] = await pool.query(
      `SELECT u.id, c.instructor_id
       FROM course_units u
       JOIN courses c ON c.id = u.course_id
       WHERE u.unit_order = ?
       LIMIT 1`,
      [unitOrder]
    );
    if (assigned.length && Number(assigned[0].instructor_id) !== Number(req.user.id)) {
      return res.status(409).json({ success: false, message: `Unit ${unitOrder} is already assigned to another instructor` });
    }

    const [result] = await pool.query(
      'INSERT INTO course_units (course_id, title, description, unit_order, status) VALUES (?, ?, ?, ?, ?)',
      [courseId, title, description || null, unitOrder, status]
    );
    const [[unit]] = await pool.query(
      'SELECT id, course_id, title, description, unit_order, status FROM course_units WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json({ success: true, unit });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'That unit number already exists for this level' });
    dbFailure(res, error, 'Unable to save the unit.');
  }
});

router.patch('/units/:unitId', async (req, res) => {
  try {
    const unitId = Number(req.params.unitId);
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const status = String(req.body.status || 'Mandatory').trim();
    const unitOrder = Number(req.body.unitOrder);
    if (!Number.isInteger(unitId) || unitId < 1) return res.status(400).json({ success: false, message: 'Invalid unit ID' });
    if (!title || !Number.isInteger(unitOrder) || unitOrder < 1 || unitOrder > 20) return res.status(400).json({ success: false, message: 'Unit title and a valid unit number from 1 to 20 are required' });
    if (!['Mandatory', 'Optional'].includes(status)) return res.status(400).json({ success: false, message: 'Unit status must be Mandatory or Optional' });

    const [[unit]] = await pool.query(
      `SELECT u.id, u.course_id, u.unit_order
       FROM course_units u JOIN courses c ON c.id = u.course_id
       WHERE u.id = ? AND c.instructor_id = ? LIMIT 1`,
      [unitId, req.user.id]
    );
    if (!unit) return res.status(404).json({ success: false, message: 'Unit not found' });

    const [conflict] = await pool.query(
      `SELECT u.id, c.instructor_id
       FROM course_units u JOIN courses c ON c.id = u.course_id
       WHERE u.unit_order = ? AND u.id <> ?
       LIMIT 1`,
      [unitOrder, unitId]
    );
    if (conflict.length && Number(conflict[0].instructor_id) !== Number(req.user.id)) {
      return res.status(409).json({ success: false, message: `Unit ${unitOrder} is already assigned to another instructor` });
    }

    await pool.query(
      'UPDATE course_units SET title = ?, description = ?, unit_order = ?, status = ? WHERE id = ?',
      [title, description || null, unitOrder, status, unitId]
    );
    const [[updated]] = await pool.query(
      'SELECT id, course_id, title, description, unit_order, status FROM course_units WHERE id = ?',
      [unitId]
    );
    res.json({ success: true, unit: updated });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'That unit number already exists for this level' });
    dbFailure(res, error, 'Unable to update the unit.');
  }
});

router.delete('/units/:unitId', async (req, res) => {
  try {
    const unitId = Number(req.params.unitId);
    const [result] = await pool.query(
      `DELETE u FROM course_units u
       JOIN courses c ON c.id = u.course_id
       WHERE u.id = ? AND c.instructor_id = ?`,
      [unitId, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Unit not found' });
    res.json({ success: true, message: 'Unit deleted successfully' });
  } catch (error) {
    dbFailure(res, error, 'Unable to delete the unit.');
  }
});

export default router;
