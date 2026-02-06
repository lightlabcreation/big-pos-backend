import express from 'express'; // Restart trigger
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import storeRoutes from './routes/storeRoutes';
import retailerRoutes from './routes/retailerRoutes';
import wholesalerRoutes from './routes/wholesalerRoutes';
import employeeRoutes from './routes/employeeRoutes';
import adminRoutes from './routes/adminRoutes';
import nfcRoutes from './routes/nfcRoutes';
import walletRoutes from './routes/walletRoutes';
import rewardsRoutes from './routes/rewardsRoutes';
import debugRoutes, { setAppInstance } from './routes/debugRoutes';
import trainingRoutes from './routes/trainingRoutes';
import webhookRoutes from './routes/webhookRoutes';
console.log('--- Server Starting ---');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9001;

// CORS Configuration
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3062",
  "http://localhost:5173",
  "http://localhost:9001",
  "http://localhost:9000",
  "http://127.0.0.1:9001",
  "https://big-company-frontend.vercel.app",
  "https://big-pos-backend-production.up.railway.app",
  "https://big-pos.netlify.app"
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Request Logger
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`  Body: ${JSON.stringify(req.body)}`);
  }
  next();
});

// Routes
app.use('/store/auth', authRoutes); // Consumer uses /store/auth
app.use('/retailer/auth', authRoutes);
app.use('/wholesaler/auth', authRoutes);
app.use('/admin/auth', authRoutes);
app.use('/employee/auth', authRoutes);

app.use('/employee', employeeRoutes);
app.use('/employee', trainingRoutes);
app.use('/store', storeRoutes);
app.use('/retailer', retailerRoutes);
app.use('/wholesaler', wholesalerRoutes);
app.use('/admin', adminRoutes);
app.use('/nfc', nfcRoutes);
app.use('/wallet', walletRoutes);
app.use('/rewards', rewardsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/debug', debugRoutes); // Public debug endpoint
setAppInstance(app); // Enable route listing in debug

app.get('/', (req, res) => {
  res.send('Big Company API is running');
});

// Handle 404 cases
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('SERVER ERROR:', err);

  // Log to file
  try {
    const fs = require('fs');
    const path = require('path');
    const logPath = path.join(__dirname, '../error.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${err.stack || err}\\n`);
  } catch (fsError) {
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
