import express from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('instructor', 'admin'));

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

router.get('/dashboard', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         COUNT(DISTINCT c.id) AS course_count,
         COUNT(DISTINCT u.id) AS unit_count,
         COUNT(DISTINCT e.student_id) AS student_count,
         COUNT(DISTINCT a.id) AS assessment_count,
         COUNT(DISTINCT s.id) AS submission_count
       FROM courses c
       LEFT JOIN course_units u ON u.course_id = c.id
       LEFT JOIN enrollments e ON e.course_id = c.id
       LEFT JOIN assessments a ON a.course_id = c.id
       LEFT JOIN assessment_submissions s ON s.assessment_id = a.id
       WHERE c.instructor_id = ?`,
      [req.user.id]
    );
    res.json({ success: true, stats: rows[0] });
  } catch (error) { next(error); }
});

router.get('/courses', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.title, c.slug, c.description, c.level_name, c.is_published,
              COUNT(DISTINCT u.id) AS unit_count,
              COUNT(DISTINCT e.student_id) AS enrolled_count
       FROM courses c
       LEFT JOIN course_units u ON u.course_id = c.id
       LEFT JOIN enrollments e ON e.course_id = c.id
       WHERE c.instructor_id = ?
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, courses: rows });
  } catch (error) { next(error); }
});

router.post('/courses', async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    if (!title) return res.status(400).json({ success: false, message: 'Level title is required' });

    const baseSlug = slugify(title) || `course-${Date.now()}`;
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const [existing] = await pool.query('SELECT id FROM courses WHERE slug = ? LIMIT 1', [slug]);
      if (!existing.length) break;
      slug = `${baseSlug}-${suffix++}`;
    }

    const [result] = await pool.query(
      `INSERT INTO courses (title, slug, description, level_name, instructor_id, is_published)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [title, slug, description || null, title, req.user.id]
    );
    const [rows] = await pool.query('SELECT id, title, slug, description, level_name, is_published FROM courses WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, course: rows[0] });
  } catch (error) { next(error); }
});

router.patch('/courses/:courseId', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId < 1) return res.status(400).json({ success: false, message: 'Invalid course ID' });
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    if (!title) return res.status(400).json({ success: false, message: 'Level title is required' });
    const [result] = await pool.query(
      `UPDATE courses
       SET title = ?, description = ?, level_name = ?, is_published = TRUE
       WHERE id = ? AND instructor_id = ?`,
      [title, description || null, title, courseId, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Level not found' });
    const [rows] = await pool.query('SELECT id, title, slug, description, level_name, is_published FROM courses WHERE id = ?', [courseId]);
    res.json({ success: true, course: rows[0] });
  } catch (error) { next(error); }
});

router.delete('/courses/:courseId', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId < 1) return res.status(400).json({ success: false, message: 'Invalid course ID' });
    const [courses] = await pool.query(
      `SELECT c.id, COUNT(DISTINCT e.student_id) AS enrolled_count
       FROM courses c
       LEFT JOIN enrollments e ON e.course_id = c.id
       WHERE c.id = ? AND c.instructor_id = ?
       GROUP BY c.id`,
      [courseId, req.user.id]
    );
    if (!courses.length) return res.status(404).json({ success: false, message: 'Course not found' });
    if (Number(courses[0].enrolled_count) > 0) return res.status(409).json({ success: false, message: 'This course has enrolled students. Unpublish it instead of deleting it.' });
    const [result] = await pool.query('DELETE FROM courses WHERE id = ? AND instructor_id = ?', [courseId, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Course not found' });
    res.json({ success: true, message: 'Course deleted successfully' });
  } catch (error) { next(error); }
});

router.get('/courses/:courseId/units', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId < 1) return res.status(400).json({ success: false, message: 'Invalid course ID' });
    const [rows] = await pool.query(
      `SELECT u.id, u.course_id, u.title, u.description, u.unit_order, u.status, u.content
       FROM course_units u JOIN courses c ON c.id = u.course_id
       WHERE u.course_id = ? AND c.instructor_id = ?
       ORDER BY u.unit_order ASC`,
      [courseId, req.user.id]
    );
    res.json({ success: true, units: rows });
  } catch (error) { next(error); }
});

router.post('/courses/:courseId/units', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const status = String(req.body.status || 'Mandatory').trim();
    const unitOrder = Number(req.body.unitOrder);
    if (!Number.isInteger(courseId) || courseId < 1) return res.status(400).json({ success: false, message: 'Invalid course ID' });
    const [courses] = await pool.query('SELECT id FROM courses WHERE id = ? AND instructor_id = ?', [courseId, req.user.id]);
    if (!courses.length) return res.status(404).json({ success: false, message: 'Course not found' });
    if (!title || !Number.isInteger(unitOrder) || unitOrder < 1 || unitOrder > 20) return res.status(400).json({ success: false, message: 'Unit title and a valid unit number from 1 to 20 are required' });
    if (!['Mandatory', 'Optional'].includes(status)) return res.status(400).json({ success: false, message: 'Unit status must be Mandatory or Optional' });

    const [result] = await pool.query(
      'INSERT INTO course_units (course_id, title, description, unit_order, status) VALUES (?, ?, ?, ?, ?)',
      [courseId, title, description || null, unitOrder, status]
    );
    const [rows] = await pool.query('SELECT id, course_id, title, description, unit_order, status, content FROM course_units WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, unit: rows[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'That unit number already exists for this level' });
    next(error);
  }
});

router.patch('/units/:unitId', async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const unitId = Number(req.params.unitId);
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const status = String(req.body.status || 'Mandatory').trim();
    const unitOrder = Number(req.body.unitOrder);
    if (!Number.isInteger(unitId) || unitId < 1) return res.status(400).json({ success: false, message: 'Invalid unit ID' });
    if (!title || !Number.isInteger(unitOrder) || unitOrder < 1 || unitOrder > 20) return res.status(400).json({ success: false, message: 'Unit title and a valid unit number from 1 to 20 are required' });
    if (!['Mandatory', 'Optional'].includes(status)) return res.status(400).json({ success: false, message: 'Unit status must be Mandatory or Optional' });

    await connection.beginTransaction();
    const [units] = await connection.query(
      `SELECT u.id, u.course_id, u.unit_order FROM course_units u
       JOIN courses c ON c.id = u.course_id
       WHERE u.id = ? AND c.instructor_id = ? FOR UPDATE`,
      [unitId, req.user.id]
    );
    if (!units.length) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Unit not found' }); }
    const unit = units[0];

    if (unit.unit_order !== unitOrder) {
      const [conflict] = await connection.query(
        'SELECT id, unit_order FROM course_units WHERE course_id = ? AND unit_order = ? AND id <> ? FOR UPDATE',
        [unit.course_id, unitOrder, unit.id]
      );
      const [maxRows] = await connection.query('SELECT COALESCE(MAX(unit_order), 0) AS max_order FROM course_units WHERE course_id = ?', [unit.course_id]);
      const maxOrder = Number(maxRows[0].max_order);
      const tempUnitOrder = maxOrder + 2;
      const tempConflictOrder = maxOrder + 1;

      await connection.query('UPDATE course_units SET unit_order = ? WHERE id = ?', [tempUnitOrder, unit.id]);
      if (conflict.length) await connection.query('UPDATE course_units SET unit_order = ? WHERE id = ?', [tempConflictOrder, conflict[0].id]);
      await connection.query(
        'UPDATE course_units SET title = ?, description = ?, status = ?, unit_order = ? WHERE id = ?',
        [title, description || null, status, unitOrder, unit.id]
      );
      if (conflict.length) await connection.query('UPDATE course_units SET unit_order = ? WHERE id = ?', [unit.unit_order, conflict[0].id]);
    } else {
      await connection.query(
        'UPDATE course_units SET title = ?, description = ?, status = ? WHERE id = ?',
        [title, description || null, status, unit.id]
      );
    }

    await connection.commit();
    const [rows] = await pool.query('SELECT id, course_id, title, description, unit_order, status, content FROM course_units WHERE id = ?', [unit.id]);
    res.json({ success: true, unit: rows[0] });
  } catch (error) {
    await connection.rollback().catch(() => {});
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'That unit number already exists for this level' });
    next(error);
  } finally { connection.release(); }
});

router.delete('/units/:unitId', async (req, res, next) => {
  try {
    const unitId = Number(req.params.unitId);
    if (!Number.isInteger(unitId) || unitId < 1) return res.status(400).json({ success: false, message: 'Invalid unit ID' });
    const [result] = await pool.query(
      `DELETE u FROM course_units u JOIN courses c ON c.id = u.course_id
       WHERE u.id = ? AND c.instructor_id = ?`,
      [unitId, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Unit not found' });
    res.json({ success: true, message: 'Unit deleted successfully' });
  } catch (error) { next(error); }
});

router.get('/courses/:courseId/students', async (req, res, next) => {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isInteger(courseId) || courseId < 1) return res.status(400).json({ success: false, message: 'Invalid course ID' });
    const [course] = await pool.query(
      'SELECT id, title, level_name, is_published FROM courses WHERE id = ? AND instructor_id = ? LIMIT 1',
      [courseId, req.user.id]
    );
    if (!course.length) return res.status(404).json({ success: false, message: 'Course not found' });

    const [students] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, e.enrolled_at,
              COUNT(DISTINCT up.id) AS completed_units
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       LEFT JOIN course_units cu ON cu.course_id = e.course_id
       LEFT JOIN unit_progress up ON up.unit_id = cu.id AND up.student_id = u.id AND up.completed = TRUE
       WHERE e.course_id = ?
       GROUP BY u.id, e.enrolled_at
       ORDER BY e.enrolled_at DESC`,
      [courseId]
    );

    res.json({ success: true, course: course[0], students });
  } catch (error) { next(error); }
});

export default router;
