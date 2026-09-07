import express from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/dashboard', async (_req, res, next) => {
  try {
    const [[stats]] = await pool.query(`SELECT (SELECT COUNT(*) FROM users) AS total_users,(SELECT COUNT(*) FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='student') AS students,(SELECT COUNT(*) FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='instructor') AS instructors,(SELECT COUNT(*) FROM courses) AS total_courses,(SELECT COUNT(*) FROM courses WHERE is_published=TRUE) AS published_courses,(SELECT COUNT(*) FROM enrollments) AS enrollments,(SELECT COUNT(*) FROM assessment_submissions) AS submissions,(SELECT COUNT(*) FROM assessment_submissions WHERE graded_at IS NOT NULL) AS graded_submissions,(SELECT COUNT(*) FROM unit_progress WHERE completed=TRUE) AS completed_units`);
    res.json({ success:true, stats });
  } catch(error){ next(error); }
});

router.get('/users', async (_req,res,next)=>{ try { const [rows]=await pool.query(`SELECT u.id,u.first_name,u.last_name,u.email,u.is_active,u.created_at,r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id ORDER BY u.created_at DESC`); res.json({success:true,users:rows}); } catch(error){next(error);} });

router.patch('/users/:userId/status', async(req,res,next)=>{ try { if(Number(req.params.userId)===Number(req.user.id)) return res.status(400).json({success:false,message:'You cannot deactivate your own admin account'}); const isActive=req.body.isActive===true; const [result]=await pool.query('UPDATE users SET is_active=? WHERE id=?',[isActive,req.params.userId]); if(!result.affectedRows)return res.status(404).json({success:false,message:'User not found'}); res.json({success:true,isActive}); } catch(error){next(error);} });

router.get('/courses', async(_req,res,next)=>{ try { const [rows]=await pool.query(`SELECT c.id,c.title,c.slug,c.level_name,c.is_published,c.created_at,CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,'')) AS instructor_name,COUNT(DISTINCT e.student_id) AS enrolled_count,COUNT(DISTINCT cu.id) AS unit_count FROM courses c LEFT JOIN users u ON u.id=c.instructor_id LEFT JOIN enrollments e ON e.course_id=c.id LEFT JOIN course_units cu ON cu.course_id=c.id GROUP BY c.id ORDER BY c.created_at DESC`); res.json({success:true,courses:rows}); } catch(error){next(error);} });

router.patch('/courses/:courseId/publish', async(req,res,next)=>{ try { const published=req.body.published===true; const [result]=await pool.query('UPDATE courses SET is_published=? WHERE id=?',[published,req.params.courseId]); if(!result.affectedRows)return res.status(404).json({success:false,message:'Course not found'}); res.json({success:true,published}); } catch(error){next(error);} });

router.get('/instructors', async(_req,res,next)=>{ try { const [rows]=await pool.query(`SELECT u.id,u.first_name,u.last_name,u.email,u.is_active,u.created_at,COUNT(DISTINCT c.id) AS course_count,COUNT(DISTINCT CASE WHEN c.is_published=TRUE THEN c.id END) AS published_course_count,COUNT(DISTINCT e.student_id) AS total_students FROM users u JOIN roles r ON r.id=u.role_id AND r.name='instructor' LEFT JOIN courses c ON c.instructor_id=u.id LEFT JOIN enrollments e ON e.course_id=c.id GROUP BY u.id ORDER BY u.created_at DESC`); res.json({success:true,instructors:rows}); } catch(error){next(error);} });

router.get('/reports/courses', async(_req,res,next)=>{ try { const [rows]=await pool.query(`SELECT c.id,c.title,c.level_name,CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,'')) AS instructor_name,COUNT(DISTINCT e.student_id) AS enrolled_count,COUNT(DISTINCT cu.id) AS unit_count,COUNT(DISTINCT CASE WHEN up.completed=TRUE THEN CONCAT(up.student_id,'-',up.unit_id) END) AS completed_units,COUNT(DISTINCT a.id) AS assessment_count,COUNT(DISTINCT s.id) AS submission_count,COUNT(DISTINCT CASE WHEN s.graded_at IS NOT NULL THEN s.id END) AS graded_submission_count FROM courses c LEFT JOIN users u ON u.id=c.instructor_id LEFT JOIN enrollments e ON e.course_id=c.id LEFT JOIN course_units cu ON cu.course_id=c.id LEFT JOIN unit_progress up ON up.unit_id=cu.id LEFT JOIN assessments a ON a.course_id=c.id LEFT JOIN assessment_submissions s ON s.assessment_id=a.id GROUP BY c.id ORDER BY enrolled_count DESC,c.title ASC`); res.json({success:true,reports:rows}); } catch(error){next(error);} });

router.get('/reports/students', async(_req,res,next)=>{ try { const [rows]=await pool.query(`SELECT u.id,u.first_name,u.last_name,u.email,COUNT(DISTINCT e.course_id) AS enrolled_courses,COUNT(DISTINCT CASE WHEN up.completed=TRUE THEN up.unit_id END) AS completed_units,COUNT(DISTINCT s.id) AS submissions,COUNT(DISTINCT CASE WHEN s.graded_at IS NOT NULL THEN s.id END) AS graded_submissions,ROUND(AVG(s.score),2) AS average_score FROM users u JOIN roles r ON r.id=u.role_id AND r.name='student' LEFT JOIN enrollments e ON e.student_id=u.id LEFT JOIN unit_progress up ON up.student_id=u.id LEFT JOIN assessment_submissions s ON s.student_id=u.id GROUP BY u.id ORDER BY u.created_at DESC`); res.json({success:true,reports:rows}); } catch(error){next(error);} });

router.get('/courses/:courseId/students', async(req,res,next)=>{ try { const [rows]=await pool.query(`SELECT u.id,u.first_name,u.last_name,u.email,e.enrolled_at,COUNT(DISTINCT CASE WHEN up.completed=TRUE THEN up.unit_id END) AS completed_units,COUNT(DISTINCT cu.id) AS total_units,COUNT(DISTINCT s.id) AS submissions,ROUND(AVG(s.score),2) AS average_score FROM enrollments e JOIN users u ON u.id=e.student_id LEFT JOIN course_units cu ON cu.course_id=e.course_id LEFT JOIN unit_progress up ON up.student_id=u.id AND up.unit_id=cu.id LEFT JOIN assessments a ON a.course_id=e.course_id LEFT JOIN assessment_submissions s ON s.assessment_id=a.id AND s.student_id=u.id WHERE e.course_id=? GROUP BY u.id,e.enrolled_at ORDER BY e.enrolled_at DESC`,[req.params.courseId]); res.json({success:true,students:rows}); } catch(error){next(error);} });

export default router;
