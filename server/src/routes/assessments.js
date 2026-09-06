import express from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('instructor', 'admin'));

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.course_id, a.unit_id, a.title, a.description, a.assessment_type,
              a.max_score, a.due_at, c.title AS course_title, u.title AS unit_title
       FROM assessments a
       JOIN courses c ON c.id = a.course_id
       LEFT JOIN course_units u ON u.id = a.unit_id
       WHERE c.instructor_id = ?
       ORDER BY a.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, assessments: rows });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    const courseId = Number(req.body.courseId);
    const unitId = req.body.unitId ? Number(req.body.unitId) : null;
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const assessmentType = String(req.body.assessmentType || '').trim();
    const maxScore = Number(req.body.maxScore ?? 100);
    const dueAt = req.body.dueAt || null;

    if (!Number.isInteger(courseId) || !title || !assessmentType || !Number.isFinite(maxScore) || maxScore <= 0) {
      return res.status(400).json({ success: false, message: 'Course, title, assessment type and a valid maximum score are required' });
    }

    const [courses] = await pool.query('SELECT id FROM courses WHERE id = ? AND instructor_id = ?', [courseId, req.user.id]);
    if (!courses.length) return res.status(404).json({ success: false, message: 'Course not found' });

    if (unitId) {
      const [units] = await pool.query('SELECT id FROM course_units WHERE id = ? AND course_id = ?', [unitId, courseId]);
      if (!units.length) return res.status(400).json({ success: false, message: 'Selected unit does not belong to this course' });
    }

    const [result] = await pool.query(
      `INSERT INTO assessments (course_id, unit_id, title, description, assessment_type, max_score, due_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [courseId, unitId, title, description || null, assessmentType, maxScore, dueAt]
    );

    const [rows] = await pool.query(
      `SELECT a.id, a.course_id, a.unit_id, a.title, a.description, a.assessment_type,
              a.max_score, a.due_at, c.title AS course_title, u.title AS unit_title
       FROM assessments a
       JOIN courses c ON c.id = a.course_id
       LEFT JOIN course_units u ON u.id = a.unit_id
       WHERE a.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ success: true, assessment: rows[0] });
  } catch (error) { next(error); }
});

router.delete('/:assessmentId', async (req, res, next) => {
  try {
    const [result] = await pool.query(
      `DELETE a FROM assessments a
       JOIN courses c ON c.id = a.course_id
       WHERE a.id = ? AND c.instructor_id = ?`,
      [req.params.assessmentId, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Assessment not found' });
    res.json({ success: true, message: 'Assessment deleted' });
  } catch (error) { next(error); }
});

export default router;
