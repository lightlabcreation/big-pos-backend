"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTasks = exports.getPayslips = exports.getAttendance = exports.getDashboard = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// Get employee dashboard
const getDashboard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const employeeProfile = yield prisma_1.default.employeeProfile.findUnique({
            where: { userId: req.user.id },
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getDashboard = getDashboard;
// Get attendance (placeholder)
const getAttendance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.json({ attendance: [] });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getAttendance = getAttendance;
// Get payslips (placeholder)
const getPayslips = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.json({ payslips: [] });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getPayslips = getPayslips;
// Get tasks (placeholder)
const getTasks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.json({ tasks: [] });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getTasks = getTasks;
