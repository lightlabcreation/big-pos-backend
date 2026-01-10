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
import debugRoutes from './routes/debugRoutes';
import trainingRoutes from './routes/trainingRoutes';
console.log('--- Server Starting ---');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;

// CORS Configuration
app.use(cors({
  origin: ["https://big-company-frontend.vercel.app", "http://localhost:3000", "https://big-pos.netlify.app", "http://localhost:5173", "http://localhost:3062", "http://localhost:9000"],
  credentials: true
}));

app.use(express.json());

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
app.use('/debug', debugRoutes); // Public debug endpoint

app.get('/', (req, res) => {
  res.send('Big Company API is running');
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
