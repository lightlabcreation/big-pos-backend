"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storeController_1 = require("../controllers/storeController");
const customerController_1 = require("../controllers/customerController");
const gasController_1 = require("../controllers/gasController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Public routes
router.get('/retailers', storeController_1.getRetailers);
router.get('/categories', storeController_1.getCategories);
router.get('/products', storeController_1.getProducts);
// Protected routes - Auth
router.post('/auth/logout', authMiddleware_1.authenticate, customerController_1.logout);
// Protected routes - Customer Profile
router.get('/customers/me', authMiddleware_1.authenticate, customerController_1.getCustomerProfile);
router.put('/customers/me', authMiddleware_1.authenticate, customerController_1.updateCustomerProfile);
// Protected routes - Wallets
router.get('/wallets', authMiddleware_1.authenticate, customerController_1.getWallets);
router.post('/wallets/topup', authMiddleware_1.authenticate, customerController_1.topupWallet);
router.post('/wallets/refund-request', authMiddleware_1.authenticate, customerController_1.requestRefund);
router.get('/wallets/transactions', authMiddleware_1.authenticate, customerController_1.getWalletTransactions);
// Protected routes - Gas Service
router.get('/gas/meters', authMiddleware_1.authenticate, gasController_1.getGasMeters);
router.post('/gas/meters', authMiddleware_1.authenticate, gasController_1.addGasMeter);
router.delete('/gas/meters/:id', authMiddleware_1.authenticate, gasController_1.removeGasMeter);
router.post('/gas/topup', authMiddleware_1.authenticate, gasController_1.topupGas);
router.get('/gas/usage', authMiddleware_1.authenticate, gasController_1.getGasUsage);
// Protected routes - Gas Rewards
router.get('/gas/rewards/balance', authMiddleware_1.authenticate, gasController_1.getGasRewardsBalance);
router.get('/gas/rewards/history', authMiddleware_1.authenticate, gasController_1.getGasRewardsHistory);
router.get('/gas/rewards/leaderboard', authMiddleware_1.authenticate, gasController_1.getGasRewardsLeaderboard);
// Protected routes - Orders
router.get('/customers/me/orders', authMiddleware_1.authenticate, gasController_1.getCustomerOrders);
router.get('/orders/:id', authMiddleware_1.authenticate, gasController_1.getOrderDetails);
// Legacy routes (keep for backward compatibility)
router.get('/orders', authMiddleware_1.authenticate, storeController_1.getMyOrders);
router.get('/wallet/balance', authMiddleware_1.authenticate, storeController_1.getWalletBalance);
router.get('/rewards/balance', authMiddleware_1.authenticate, storeController_1.getRewardsBalance);
router.get('/loans', authMiddleware_1.authenticate, storeController_1.getLoans);
router.get('/loans/products', authMiddleware_1.authenticate, storeController_1.getLoanProducts);
router.get('/loans/check-eligibility', authMiddleware_1.authenticate, storeController_1.checkLoanEligibility);
exports.default = router;
