"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const adminController = __importStar(require("../controllers/adminController"));
const router = (0, express_1.Router)();
// All admin routes require admin authentication
router.use(authMiddleware_1.authenticate);
router.use((0, authMiddleware_1.authorize)('admin'));
// Dashboard
router.get('/dashboard', adminController.getDashboard);
// Customers
router.get('/customers', adminController.getCustomers);
// Retailers
router.get('/retailers', adminController.getRetailers);
router.post('/accounts/create-retailer', adminController.createRetailer);
// Wholesalers
router.get('/wholesalers', adminController.getWholesalers);
router.post('/accounts/create-wholesaler', adminController.createWholesaler);
// Loans
router.get('/loans', adminController.getLoans);
// NFC Cards
router.get('/nfc-cards', adminController.getNFCCards);
// Categories
router.get('/categories', adminController.getCategories);
exports.default = router;
