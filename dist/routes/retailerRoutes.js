"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const retailerController_1 = require("../controllers/retailerController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticate);
router.get('/dashboard', retailerController_1.getDashboardStats);
router.get('/inventory', retailerController_1.getInventory);
router.post('/inventory', retailerController_1.createProduct);
router.put('/inventory/:id', retailerController_1.updateProduct);
router.get('/orders', retailerController_1.getOrders);
router.get('/orders/:id', retailerController_1.getOrder);
router.post('/orders', retailerController_1.createOrder); // Add this line
router.get('/branches', retailerController_1.getBranches);
router.post('/branches', retailerController_1.createBranch);
router.get('/wallet', retailerController_1.getWallet);
router.get('/wallet/transactions', retailerController_1.getWalletTransactions);
router.post('/wallet/topup', retailerController_1.topUpWallet);
// Analytics Routes
router.get('/analytics', retailerController_1.getAnalytics);
// Credit Routes
router.get('/credit', retailerController_1.getCreditInfo);
router.get('/credit/orders', retailerController_1.getCreditOrders);
router.get('/credit/orders/:id', retailerController_1.getCreditOrder);
router.post('/credit/request', retailerController_1.requestCredit);
router.post('/credit/orders/:id/repay', retailerController_1.makeRepayment);
// Profile Routes
router.get('/profile', retailerController_1.getProfile);
router.put('/profile', retailerController_1.updateProfile);
// POS Routes
router.get('/pos/products', retailerController_1.getPOSProducts);
router.post('/pos/scan', retailerController_1.scanBarcode);
router.post('/pos/sale', retailerController_1.createSale);
router.get('/pos/daily-sales', retailerController_1.getDailySales);
// Wholesaler Products (for Add Stock)
router.get('/wholesaler/products', retailerController_1.getWholesalerProducts);
exports.default = router;
