import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import 'dotenv/config';
import { pool } from './db.js';
import authRoutes from './routes/auth.js';
import instructorRoutes from './routes/instructor.js';
import assessmentRoutes from './routes/assessments.js';

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'ELES LMS API is running', database: 'connected' });
  } catch (error) {
    console.error('DATABASE ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'API is running but database connection failed',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/instructor', instructorRoutes);
app.use('/api/instructor/assessments', assessmentRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`ELES LMS API running on http://localhost:${port}`);
});
