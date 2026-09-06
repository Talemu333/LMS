import express from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('instructor', 'admin'));

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

router.get('/courses', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.title, c.slug, c.description, c.level_name, c.is_published,
              COUNT(u.id) AS unit_count
       FROM courses c
       LEFT JOIN course_units u ON u.course_id = c.id
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
    const levelName = String(req.body.levelName || '').trim();
    const description = String(req.body.description || '').trim();
    if (!title || !levelName) return res.status(400).json({ success: false, message: 'Course title and level are required' });

    const baseSlug = slugify(title) || `course-${Date.now()}`;
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const [existing] = await pool.query('SELECT id FROM courses WHERE slug = ? LIMIT 1', [slug]);
      if (!existing.length) break;
      slug = `${baseSlug}-${suffix++}`;
    }

    const [result] = await pool.query(
      'INSERT INTO courses (title, slug, description, level_name, instructor_id) VALUES (?, ?, ?, ?, ?)',
      [title, slug, description || null, levelName, req.user.id]
    );
    const [rows] = await pool.query('SELECT id, title, slug, description, level_name, is_published FROM courses WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, course: rows[0] });
  } catch (error) { next(error); }
});

router.get('/courses/:courseId/units', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.course_id, u.title, u.description, u.unit_order, u.content
       FROM course_units u JOIN courses c ON c.id = u.course_id
       WHERE u.course_id = ? AND c.instructor_id = ?
       ORDER BY u.unit_order ASC`,
      [req.params.courseId, req.user.id]
    );
    res.json({ success: true, units: rows });
  } catch (error) { next(error); }
});

router.post('/courses/:courseId/units', async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    const description = String(req.body.description || '').trim();
    const content = String(req.body.content || '').trim();
    const unitOrder = Number(req.body.unitOrder);
    const [courses] = await pool.query('SELECT id FROM courses WHERE id = ? AND instructor_id = ?', [req.params.courseId, req.user.id]);
    if (!courses.length) return res.status(404).json({ success: false, message: 'Course not found' });
    if (!title || !Number.isInteger(unitOrder) || unitOrder < 1) return res.status(400).json({ success: false, message: 'Unit title and a valid unit number are required' });

    const [result] = await pool.query(
      'INSERT INTO course_units (course_id, title, description, unit_order, content) VALUES (?, ?, ?, ?, ?)',
      [req.params.courseId, title, description || null, unitOrder, content || null]
    );
    const [rows] = await pool.query('SELECT id, course_id, title, description, unit_order, content FROM course_units WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, unit: rows[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'That unit number already exists for this course' });
    next(error);
  }
});

export default router;
