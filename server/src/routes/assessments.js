import express from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('instructor'));

const ASSESSMENT_TYPES = ['Direct observation', 'Question and answer', 'Personal statement', 'Work practice'];
const NORMALIZE = {
  'Direct Observation': 'Direct observation',
  'Question and Answer': 'Question and answer',
  'Personal Statement': 'Personal statement',
  'Work Practice': 'Work practice'
};

function databaseError(res, error, fallback = 'Unable to complete the assessment method request.') {
  console.error('ASSESSMENT API ERROR:', {
    code: error?.code,
    errno: error?.errno,
    sqlState: error?.sqlState,
    message: error?.message
  });
  if (error?.code === 'ER_NO_SUCH_TABLE') return res.status(503).json({ success: false, message: 'The assessments table is missing from the connected database. Run the current LMS schema against the database.' });
  if (error?.code === 'ER_BAD_FIELD_ERROR') return res.status(503).json({ success: false, message: 'The assessments table does not match the current LMS schema. Re-run the current schema against the database.' });
  if (error?.code === 'ER_NO_REFERENCED_ROW_2') return res.status(409).json({ success: false, message: 'The selected level/course is no longer available. Refresh the page and try again.' });
  return res.status(500).json({ success: false, message: fallback });
}

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.course_id, a.unit_id, a.title, a.description,
              a.assessment_type, a.max_score, a.due_at,
              c.title AS course_title, u.title AS unit_title
       FROM assessments a
       INNER JOIN courses c ON c.id = a.course_id AND c.instructor_id = ?
       LEFT JOIN course_units u ON u.id = a.unit_id
       ORDER BY a.created_at DESC`, [req.user.id]
    );
    res.json({ success: true, assessments: rows });
  } catch (error) {
    databaseError(res, error, 'Unable to load assessment methods.');
  }
});

router.post('/', async (req, res) => {
  try {
    const rawType = String(req.body.assessmentType || '').trim();
    const assessmentType = NORMALIZE[rawType] || rawType;
    if (!ASSESSMENT_TYPES.includes(assessmentType)) return res.status(400).json({ success: false, message: 'Select a valid assessment type.' });

    const [courses] = await pool.query(
      `SELECT id FROM courses WHERE instructor_id = ? ORDER BY created_at ASC LIMIT 1`,
      [req.user.id]
    );
    if (!courses.length) return res.status(400).json({ success: false, message: 'Create a level before adding an assessment method.' });

    const courseId = courses[0].id;
    const [existing] = await pool.query(
      `SELECT a.id, a.course_id, a.unit_id, a.title, a.description,
              a.assessment_type, a.max_score, a.due_at,
              c.title AS course_title, u.title AS unit_title
       FROM assessments a
       JOIN courses c ON c.id = a.course_id
       LEFT JOIN course_units u ON u.id = a.unit_id
       WHERE a.course_id = ? AND a.unit_id IS NULL AND a.assessment_type = ? AND c.instructor_id = ?
       LIMIT 1`,
      [courseId, assessmentType, req.user.id]
    );
    if (existing.length) return res.json({ success: true, assessment: existing[0], alreadyExists: true });

    const [result] = await pool.query(
      `INSERT INTO assessments (course_id, unit_id, title, description, assessment_type, max_score)
       VALUES (?, NULL, ?, NULL, ?, 100)`,
      [courseId, assessmentType, assessmentType]
    );

    const [rows] = await pool.query(
      `SELECT a.id, a.course_id, a.unit_id, a.title, a.description,
              a.assessment_type, a.max_score, a.due_at,
              c.title AS course_title, u.title AS unit_title
       FROM assessments a
       JOIN courses c ON c.id = a.course_id
       LEFT JOIN course_units u ON u.id = a.unit_id
       WHERE a.id = ? AND c.instructor_id = ?`,
      [result.insertId, req.user.id]
    );
    res.status(201).json({ success: true, assessment: rows[0] });
  } catch (error) {
    databaseError(res, error, 'Unable to save the assessment method.');
  }
});

router.get('/:assessmentId/submissions', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.assessment_id, s.student_id, s.answer_text, s.score, s.feedback,
              s.submitted_at, s.graded_at, u.first_name, u.last_name, u.email,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS student_name,
              a.title AS assessment_title, a.max_score
       FROM assessment_submissions s JOIN assessments a ON a.id = s.assessment_id
       JOIN courses c ON c.id = a.course_id JOIN users u ON u.id = s.student_id
       WHERE s.assessment_id = ? AND c.instructor_id = ? ORDER BY s.submitted_at DESC`, [req.params.assessmentId, req.user.id]
    );
    res.json({ success: true, submissions: rows });
  } catch (error) { next(error); }
});

router.patch('/submissions/:submissionId/grade', async (req, res, next) => {
  try {
    const score = Number(req.body.score);
    const feedback = String(req.body.feedback || '').trim();
    if (!Number.isFinite(score) || score < 0) return res.status(400).json({ success: false, message: 'Enter a valid score' });
    const [rows] = await pool.query(`SELECT s.id, a.max_score FROM assessment_submissions s JOIN assessments a ON a.id = s.assessment_id JOIN courses c ON c.id = a.course_id WHERE s.id = ? AND c.instructor_id = ? LIMIT 1`, [req.params.submissionId, req.user.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Submission not found' });
    if (score > Number(rows[0].max_score)) return res.status(400).json({ success: false, message: `Score cannot exceed ${rows[0].max_score}` });
    await pool.query(`UPDATE assessment_submissions SET score = ?, feedback = ?, graded_at = CURRENT_TIMESTAMP WHERE id = ?`, [score, feedback || null, req.params.submissionId]);
    const [updated] = await pool.query(`SELECT s.id, s.assessment_id, s.student_id, s.answer_text, s.score, s.feedback, s.submitted_at, s.graded_at, a.max_score FROM assessment_submissions s JOIN assessments a ON a.id = s.assessment_id WHERE s.id = ?`, [req.params.submissionId]);
    res.json({ success: true, submission: updated[0] });
  } catch (error) { next(error); }
});

router.delete('/:assessmentId', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(`SELECT a.id FROM assessments a JOIN courses c ON c.id = a.course_id WHERE a.id = ? AND c.instructor_id = ? FOR UPDATE`, [req.params.assessmentId, req.user.id]);
    if (!rows.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Assessment not found' }); }
    await connection.query('DELETE FROM assessment_submissions WHERE assessment_id = ?', [req.params.assessmentId]);
    await connection.query('DELETE FROM assessments WHERE id = ?', [req.params.assessmentId]);
    await connection.commit();
    res.json({ success: true, message: 'Assessment deleted' });
  } catch (error) { await connection.rollback().catch(() => {}); next(error); }
  finally { connection.release(); }
});

export default router;
