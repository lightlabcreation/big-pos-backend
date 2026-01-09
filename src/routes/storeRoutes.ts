import { Router } from 'express';
import {
  getRetailers,
  getCategories,
  getProducts,
  getMyOrders,
  getWalletBalance,
  getRewardsBalance,
  getLoans,
  getLoanProducts,
  checkLoanEligibility,
  applyForLoan,
  repayLoan,
  getFoodCredit,
  cancelOrder,
  confirmDelivery,
  createOrder,
  getActiveLoanLedger,
  getCreditTransactions
} from '../controllers/storeController';
import {
  getCustomerProfile,
  updateCustomerProfile,
  logout,
  getWallets,
  topupWallet,
  requestRefund,
  getWalletTransactions,
  getProfileStats,
  getRecentActivity,
  getNotificationPreferences,
  updateNotificationPreferences,
  getReferralCode,
  redeemGasRewards
} from '../controllers/customerController';
import {
  getGasMeters,
  addGasMeter,
  removeGasMeter,
  topupGas,
  getGasUsage,
  getGasRewardsBalance,
  getGasRewardsHistory,
  getGasRewardsLeaderboard,
  getCustomerOrders,
  getOrderDetails
} from '../controllers/gasController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Public routes
router.get('/retailers', getRetailers);
router.get('/categories', getCategories);
router.get('/products', getProducts);

// Protected routes - Auth
router.post('/auth/logout', authenticate, logout);

// Protected routes - Customer Profile
router.get('/customers/me', authenticate, getCustomerProfile);
router.put('/customers/me', authenticate, updateCustomerProfile);
router.get('/customers/me/stats', authenticate, getProfileStats);
router.get('/customers/me/activity', authenticate, getRecentActivity);
router.get('/customers/me/preferences', authenticate, getNotificationPreferences);
router.put('/customers/me/preferences', authenticate, updateNotificationPreferences);

// Protected routes - Wallets
router.get('/wallets', authenticate, getWallets);
router.post('/wallets/topup', authenticate, topupWallet);
router.post('/wallets/refund-request', authenticate, requestRefund);
router.get('/wallets/transactions', authenticate, getWalletTransactions);

// Protected routes - Gas Service
router.get('/gas/meters', authenticate, getGasMeters);
router.post('/gas/meters', authenticate, addGasMeter);
router.delete('/gas/meters/:id', authenticate, removeGasMeter);
router.post('/gas/topup', authenticate, topupGas);
router.get('/gas/usage', authenticate, getGasUsage);

// Protected routes - Gas Rewards
router.get('/gas/rewards/balance', authenticate, getGasRewardsBalance);
router.get('/gas/rewards/history', authenticate, getGasRewardsHistory);
router.get('/gas/rewards/leaderboard', authenticate, getGasRewardsLeaderboard);

// Rewards - Referral & Redemption
router.get('/rewards/referral-code', authenticate, getReferralCode);
router.post('/rewards/redeem', authenticate, redeemGasRewards);

// Protected routes - Orders
router.get('/customers/me/orders', authenticate, getMyOrders);
router.get('/orders/:id', authenticate, getOrderDetails);
router.post('/orders/:id/cancel', authenticate, cancelOrder);
router.post('/orders/:id/confirm-delivery', authenticate, confirmDelivery);
router.post('/orders', authenticate, createOrder);

// Legacy routes (keep for backward compatibility)
router.get('/orders', authenticate, getMyOrders);
router.get('/wallet/balance', authenticate, getWalletBalance);
router.get('/rewards/balance', authenticate, getRewardsBalance);
router.get('/loans', authenticate, getLoans); // List of loans
router.get('/loans/products', authenticate, getLoanProducts);
router.get('/loans/active', authenticate, getActiveLoanLedger); // Active loan detailed ledger
router.get('/loans/transactions', authenticate, getCreditTransactions); // filtered credit-related transactions
router.get('/loans/eligibility', authenticate, checkLoanEligibility);
router.post('/loans/apply', authenticate, applyForLoan);
router.post('/loans/:id/repay', authenticate, repayLoan);
router.get('/loans/food-credit', authenticate, getFoodCredit);

export default router;
