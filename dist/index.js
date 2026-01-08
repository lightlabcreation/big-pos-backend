"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const storeRoutes_1 = __importDefault(require("./routes/storeRoutes"));
const retailerRoutes_1 = __importDefault(require("./routes/retailerRoutes"));
const employeeRoutes_1 = __importDefault(require("./routes/employeeRoutes"));
const walletRoutes_1 = __importDefault(require("./routes/walletRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 9000;
// CORS Configuration
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3062",
    "http://localhost:3063",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3062",
    "http://127.0.0.1:3063",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://big-company-frontend.vercel.app"
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // console.log('Checking origin:', origin);
        if (!origin)
            return callback(null, true);
        // Check if it matches allowedOrigins or is any localhost/127.0.0.1
        const isLocal = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
        if (allowedOrigins.includes(origin) || isLocal) {
            callback(null, true);
        }
        else {
            console.warn('Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
// Handle preflight requests explicitly
// In Express 5, global cors middleware handles this, and '*' syntax is strict
// app.options('*', cors());
// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(express_1.default.json());
// Routes
app.use('/store/auth', authRoutes_1.default); // Consumer uses /store/auth
app.use('/retailer/auth', authRoutes_1.default);
app.use('/wholesaler/auth', authRoutes_1.default);
app.use('/admin/auth', authRoutes_1.default);
app.use('/admin/auth', authRoutes_1.default);
app.use('/employee/auth', authRoutes_1.default);
app.use('/employee', employeeRoutes_1.default);
app.use('/store', storeRoutes_1.default);
app.use('/retailer', retailerRoutes_1.default);
const debugRoutes_1 = __importDefault(require("./routes/debugRoutes"));
// ... imports
app.use('/wallet', walletRoutes_1.default);
app.use('/debug', debugRoutes_1.default); // Public debug endpoint
app.get('/', (req, res) => {
    res.send('Big Company API is running');
});
// Global error handler
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err);
    // Log to file
    try {
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(__dirname, '../error.log');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `[${timestamp}] ${err.stack || err}\n`);
    }
    catch (fsError) {
        console.error('Failed to write to error log:', fsError);
    }
    res.status(500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
