import express from 'express';
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/store/auth', authRoutes); // Consumer uses /store/auth
app.use('/retailer/auth', authRoutes);
app.use('/wholesaler/auth', authRoutes);
app.use('/admin/auth', authRoutes);
app.use('/employee/auth', authRoutes);

app.use('/store', storeRoutes);
app.use('/retailer', retailerRoutes);
import debugRoutes from './routes/debugRoutes';

// ... imports

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
    fs.appendFileSync(logPath, `[${timestamp}] ${err.stack || err}\n`);
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
