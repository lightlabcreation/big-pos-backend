import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../utils/prisma';

// Get employee dashboard
export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const employeeProfile = await prisma.employeeProfile.findUnique({
      where: { userId: req.user!.id },
      include: { user: true }
    });

    if (!employeeProfile) {
      return res.status(404).json({ error: 'Employee profile not found' });
    }

    res.json({
      employee: {
        name: employeeProfile.user.name,
        employeeNumber: employeeProfile.employeeNumber,
        department: employeeProfile.department,
        position: employeeProfile.position
      },
      stats: {
        attendance: 95,
        tasksCompleted: 42,
        pendingTasks: 5
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get attendance (placeholder)
export const getAttendance = async (req: AuthRequest, res: Response) => {
  try {
    res.json({ attendance: [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get payslips (placeholder)
export const getPayslips = async (req: AuthRequest, res: Response) => {
  try {
    res.json({ payslips: [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get tasks (placeholder)
export const getTasks = async (req: AuthRequest, res: Response) => {
  try {
    res.json({ tasks: [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
