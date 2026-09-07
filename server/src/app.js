import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import 'dotenv/config';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import instructorRoutes from './routes/instructor.js';
import assessmentRoutes from './routes/assessments.js';
import studentRoutes from './routes/student.js';
import coursePublishingRoutes from './routes/course-publishing.js';
import manualRoutes from './routes/manuals.js';
import announcementRoutes from './routes/announcements.js';
import forumRoutes from './routes/forum.js';

const app = express();
const port = Number(process.env.PORT || 5000);
const defaultOrigins = ['http://localhost:5173', 'http://localhost:5174', 'https://eles-lms.vercel.app'];
const configuredOrigins = (process.env.CLIENT_URL || '').split(',').map(origin => origin.trim()).filter(Boolean);
const allowedOrigins = [...new Set([...defaultOrigins, ...configuredOrigins])];

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication requests. Please try again later.' }
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'ELES LMS API is running', database: 'connected' });
  } catch (error) {
    console.error('DATABASE ERROR:', error);
    res.status(500).json({ success: false, message: 'API is running but database connection failed', error: process.env.NODE_ENV === 'production' ? undefined : error.message });
  }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/instructor/assessments', assessmentRoutes);
app.use('/api/instructor', coursePublishingRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/manuals', manualRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/forum', forumRoutes);

app.use((req, res) => res.status(404).json({ success: false, message: 'API endpoint not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.message === 'Origin not allowed by CORS') return res.status(403).json({ success: false, message: 'Origin not allowed' });
  res.status(500).json({ success: false, message: 'Internal server error' });
});

const server = app.listen(port, () => console.log(`ELES LMS API running on http://localhost:${port}`));
async function shutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully...`);
  server.close(async () => { await pool.end().catch(() => {}); process.exit(0); });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
