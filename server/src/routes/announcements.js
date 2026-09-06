import express from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.body, a.created_at,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS author_name
       FROM announcements a
       JOIN users u ON u.id = a.author_id
       ORDER BY a.created_at DESC`
    );
    res.json({ success: true, announcements: rows });
  } catch (error) { next(error); }
});

router.post('/', requireAuth, requireRole('instructor', 'admin'), async (req, res, next) => {
  try {
    const title = String(req.body.title || '').trim();
    const body = String(req.body.body || '').trim();
    if (!title || !body) return res.status(400).json({ success: false, message: 'Title and announcement body are required' });

    const [result] = await pool.query(
      'INSERT INTO announcements (author_id, title, body) VALUES (?, ?, ?)',
      [req.user.id, title, body]
    );
    const [rows] = await pool.query(
      `SELECT a.id, a.title, a.body, a.created_at,
              CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS author_name
       FROM announcements a JOIN users u ON u.id = a.author_id WHERE a.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ success: true, announcement: rows[0] });
  } catch (error) { next(error); }
});

router.delete('/:announcementId', requireAuth, requireRole('instructor', 'admin'), async (req, res, next) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM announcements WHERE id = ? AND author_id = ?',
      [req.params.announcementId, req.user.id]
    );
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Announcement not found' });
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error) { next(error); }
});

export default router;
