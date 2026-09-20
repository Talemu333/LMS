import express from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [[stats]] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'student') AS students,
        (SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = 'instructor') AS instructors,
        (SELECT COUNT(*) FROM users WHERE is_active = TRUE) AS active_users,
        (SELECT COUNT(*) FROM courses) AS courses,
        (SELECT COUNT(*) FROM enrollments) AS enrollments`
    );
    res.json({ success: true, stats });
  } catch (error) { next(error); }
});

router.get('/users', async (req, res, next) => {
  try {
    const role = String(req.query.role || 'all');
    const search = String(req.query.search || '').trim();
    const params = [];
    const where = [];
    if (['student', 'instructor', 'admin'].includes(role)) { where.push('r.name = ?'); params.push(role); }
    if (search) {
      where.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)');
      const term = '%' + search + '%';
      params.push(term, term, term);
    }
    const [users] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.is_active, u.created_at, r.name AS role_name
       FROM users u JOIN roles r ON r.id = u.role_id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY u.created_at DESC`,
      params
    );
    res.json({ success: true, users });
  } catch (error) { next(error); }
});

router.post('/users', async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role = 'student' } = req.body;
    if (!['student', 'instructor'].includes(role)) return res.status(400).json({ success: false, message: 'Only student and instructor accounts can be created here' });
    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password) return res.status(400).json({ success: false, message: 'First name, last name, email and password are required' });
    if (password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length) return res.status(409).json({ success: false, message: 'An account with that email already exists' });
    const [roles] = await pool.query('SELECT id FROM roles WHERE name = ?', [role]);
    if (!roles.length) return res.status(500).json({ success: false, message: 'Account role is not configured' });
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (role_id, first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?, ?)',
      [roles[0].id, firstName.trim(), lastName.trim(), normalizedEmail, passwordHash]
    );
    res.status(201).json({ success: true, user: { id: result.insertId, firstName: firstName.trim(), lastName: lastName.trim(), email: normalizedEmail, role } });
  } catch (error) { next(error); }
});

router.patch('/users/:userId/status', async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    const isActive = req.body.isActive;
    if (!Number.isInteger(userId) || userId < 1 || typeof isActive !== 'boolean') return res.status(400).json({ success: false, message: 'Invalid user status request' });
    if (userId === Number(req.user.id)) return res.status(400).json({ success: false, message: 'You cannot deactivate your own administrator account' });
    const [result] = await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [isActive, userId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: isActive ? 'User activated successfully' : 'User deactivated successfully' });
  } catch (error) { next(error); }
});

export default router;
