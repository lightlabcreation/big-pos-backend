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
app.use('/wholesaler', wholesalerRoutes);
app.use('/employee', employeeRoutes);
app.use('/admin', adminRoutes);
app.use('/nfc', nfcRoutes);
app.use('/wallet', walletRoutes);

app.get('/', (req, res) => {
  res.send('Big Company API is running');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
