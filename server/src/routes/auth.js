import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { JWT_SECRET, requireAuth } from '../middleware/auth.js';

const router = express.Router();

function publicUser(user) {
  return { id: user.id, firstName: user.first_name, lastName: user.last_name, email: user.email, role: user.role_name };
}

function setSession(res, user) {
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role_name }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('eles_token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
}

router.post('/register', async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, role = 'student' } = req.body;
    if (!firstName || !lastName || !email || !password) return res.status(400).json({ success: false, message: 'All required fields must be provided' });
    if (password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    if (!['student', 'instructor'].includes(role)) return res.status(403).json({ success: false, message: 'Invalid account type' });

    const normalizedEmail = email.trim().toLowerCase();
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
    if (existing.length) return res.status(409).json({ success: false, message: 'An account with that email already exists' });

    const passwordHash = await bcrypt.hash(password, 12);
    const [roleRows] = await pool.query('SELECT id FROM roles WHERE name = ?', [role]);
    if (!roleRows[0]) return res.status(500).json({ success: false, message: 'Account role is not configured' });

    const first = firstName.trim();
    const last = lastName.trim();
    const [result] = await pool.query(
      'INSERT INTO users (role_id, first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?, ?)',
      [roleRows[0].id, first, last, normalizedEmail, passwordHash]
    );

    const user = { id: result.insertId, first_name: first, last_name: last, email: normalizedEmail, role_name: role };
    setSession(res, user);
    res.status(201).json({ success: true, user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });
    const [rows] = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.password_hash, u.is_active, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );
    const user = rows[0];
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ success: false, message: 'Invalid email or password' });
    setSession(res, user);
    res.json({ success: true, user: publicUser(user) });
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const [rows] = await pool.query(`SELECT u.id, u.first_name, u.last_name, u.email, u.is_active, r.name AS role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ? LIMIT 1`, [req.user.id]);
    if (!rows[0] || !rows[0].is_active) { res.clearCookie('eles_token'); return res.status(401).json({ success: false, message: 'Account is unavailable' }); }
    res.json({ success: true, user: publicUser(rows[0]) });
  } catch (error) { next(error); }
});

router.post('/logout', (_req, res) => { res.clearCookie('eles_token'); res.json({ success: true, message: 'Logged out successfully' }); });

export default router;
