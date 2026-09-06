import express from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('instructor', 'admin'));

router.patch('/courses/:courseId/publish', async (req, res, next) => {
  try {
    const published = req.body.published === true;
    const [result] = await pool.query(
      'UPDATE courses SET is_published = ? WHERE id = ? AND instructor_id = ?',
      [published, req.params.courseId, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Course not found' });
    res.json({ success: true, published });
  } catch (error) { next(error); }
});

export default router;
