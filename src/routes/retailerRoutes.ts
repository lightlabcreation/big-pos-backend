import { Router } from 'express';
import { 
  getDashboardStats, 
  getInventory, 
  createProduct, 
  updateProduct,
  getOrders,
  getBranches,
  createBranch,
  getWallet,
  getPOSProducts,
  scanBarcode,
  createSale,
  getDailySales,
  getWholesalerProducts,
  createOrder,
  getWalletTransactions,
  getCreditInfo,
  getCreditOrders,
  getCreditOrder,
  requestCredit,
  makeRepayment,
  getProfile,
  updateProfile,
  topUpWallet,
  getAnalytics
} from '../controllers/retailerController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/dashboard', getDashboardStats);
router.get('/inventory', getInventory);
router.post('/inventory', createProduct);
router.put('/inventory/:id', updateProduct);
router.get('/orders', getOrders);
router.post('/orders', createOrder); // Add this line
router.get('/branches', getBranches);
router.post('/branches', createBranch);
router.get('/wallet', getWallet);
router.get('/wallet/transactions', getWalletTransactions);
router.post('/wallet/topup', topUpWallet);

// Analytics Routes
router.get('/analytics', getAnalytics);

// Credit Routes
router.get('/credit', getCreditInfo);
router.get('/credit/orders', getCreditOrders);
router.get('/credit/orders/:id', getCreditOrder);
router.post('/credit/request', requestCredit);
router.post('/credit/orders/:id/repay', makeRepayment);

// Profile Routes
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// POS Routes
router.get('/pos/products', getPOSProducts);
router.post('/pos/scan', scanBarcode);
router.post('/pos/sale', createSale);
router.get('/pos/daily-sales', getDailySales);

// Wholesaler Products (for Add Stock)
router.get('/wholesaler/products', getWholesalerProducts);

export default router;
