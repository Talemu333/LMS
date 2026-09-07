import mysql from 'mysql2/promise';
import 'dotenv/config';

const required = ['DB_HOST', 'DB_NAME', 'DB_USER'];
if (process.env.NODE_ENV === 'production') {
  const missing = required.filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Missing required database environment variables: ${missing.join(', ')}`);
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'eles_lms',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  enableKeepAlive: true
});
