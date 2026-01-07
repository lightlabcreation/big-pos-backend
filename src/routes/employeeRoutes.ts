import { Router } from 'express';
import { 
  getDashboard, 
  getAttendance, 
  getPayslips, 
  getTasks 
} from '../controllers/employeeController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/dashboard', getDashboard);
router.get('/attendance', getAttendance);
router.get('/payslips', getPayslips);
router.get('/tasks', getTasks);

export default router;
