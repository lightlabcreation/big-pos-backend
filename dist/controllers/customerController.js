"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWalletTransactions = exports.requestRefund = exports.topupWallet = exports.getWallets = exports.logout = exports.updateCustomerProfile = exports.getCustomerProfile = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// Get customer profile
const getCustomerProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        phone: true,
                        name: true
                    }
                },
                wallets: true
            }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        res.json({
            success: true,
            data: {
                id: consumerProfile.id,
                full_name: consumerProfile.fullName || consumerProfile.user.name,
                phone: consumerProfile.user.phone,
                email: consumerProfile.user.email,
                address: consumerProfile.address,
                landmark: consumerProfile.landmark,
                is_verified: consumerProfile.isVerified,
                membership_type: consumerProfile.membershipType
            }
        });
    }
    catch (error) {
        console.error('Get customer profile error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.getCustomerProfile = getCustomerProfile;
// Update customer profile
const updateCustomerProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { full_name, phone, email, address, landmark } = req.body;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        // Update user fields
        if (phone || email) {
            yield prisma_1.default.user.update({
                where: { id: userId },
                data: Object.assign(Object.assign(Object.assign({}, (phone && { phone })), (email && { email })), (full_name && { name: full_name }))
            });
        }
        // Update consumer profile fields
        const updatedProfile = yield prisma_1.default.consumerProfile.update({
            where: { userId },
            data: Object.assign(Object.assign(Object.assign({}, (full_name && { fullName: full_name })), (address && { address })), (landmark && { landmark })),
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        phone: true,
                        name: true
                    }
                }
            }
        });
        res.json({
            success: true,
            data: {
                id: updatedProfile.id,
                full_name: updatedProfile.fullName || updatedProfile.user.name,
                phone: updatedProfile.user.phone,
                email: updatedProfile.user.email,
                address: updatedProfile.address,
                landmark: updatedProfile.landmark,
                is_verified: updatedProfile.isVerified,
                membership_type: updatedProfile.membershipType
            },
            message: 'Profile updated successfully'
        });
    }
    catch (error) {
        console.error('Update customer profile error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.updateCustomerProfile = updateCustomerProfile;
// Logout
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // In a real app, you might want to blacklist the token
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.logout = logout;
// Get wallets
const getWallets = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        const wallets = yield prisma_1.default.wallet.findMany({
            where: { consumerId: consumerProfile.id }
        });
        res.json({
            success: true,
            data: wallets.map(w => ({
                id: w.id,
                type: w.type,
                balance: w.balance,
                currency: w.currency,
                created_at: w.createdAt,
                updated_at: w.updatedAt
            }))
        });
    }
    catch (error) {
        console.error('Get wallets error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.getWallets = getWallets;
// Topup wallet
const topupWallet = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { amount, payment_method } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid amount' });
        }
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        // Get or create dashboard wallet
        let wallet = yield prisma_1.default.wallet.findFirst({
            where: { consumerId: consumerProfile.id, type: 'dashboard_wallet' }
        });
        if (!wallet) {
            wallet = yield prisma_1.default.wallet.create({
                data: {
                    consumerId: consumerProfile.id,
                    type: 'dashboard_wallet',
                    balance: 0,
                    currency: 'RWF'
                }
            });
        }
        // Update wallet balance
        const updatedWallet = yield prisma_1.default.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: amount } }
        });
        // Create transaction record
        yield prisma_1.default.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: 'topup',
                amount,
                description: `Wallet topup via ${payment_method || 'mobile money'}`,
                status: 'completed'
            }
        });
        res.json({
            success: true,
            data: {
                wallet_id: updatedWallet.id,
                new_balance: updatedWallet.balance,
                amount_added: amount
            },
            message: 'Wallet topped up successfully'
        });
    }
    catch (error) {
        console.error('Topup wallet error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.topupWallet = topupWallet;
// Request refund
const requestRefund = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { amount, reason } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid amount' });
        }
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        const wallet = yield prisma_1.default.wallet.findFirst({
            where: { consumerId: consumerProfile.id, type: 'dashboard_wallet' }
        });
        if (!wallet) {
            return res.status(404).json({ success: false, error: 'Wallet not found' });
        }
        if (wallet.balance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient balance' });
        }
        // Create pending refund transaction
        const transaction = yield prisma_1.default.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: 'refund',
                amount,
                description: reason || 'Refund request',
                status: 'pending'
            }
        });
        res.json({
            success: true,
            data: {
                transaction_id: transaction.id,
                amount,
                status: transaction.status
            },
            message: 'Refund request submitted successfully'
        });
    }
    catch (error) {
        console.error('Request refund error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.requestRefund = requestRefund;
// Get wallet transactions
const getWalletTransactions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { limit = 20, offset = 0 } = req.query;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        const wallets = yield prisma_1.default.wallet.findMany({
            where: { consumerId: consumerProfile.id }
        });
        const walletIds = wallets.map(w => w.id);
        const transactions = yield prisma_1.default.walletTransaction.findMany({
            where: { walletId: { in: walletIds } },
            orderBy: { createdAt: 'desc' },
            take: Number(limit),
            skip: Number(offset),
            include: {
                wallet: {
                    select: {
                        type: true
                    }
                }
            }
        });
        res.json({
            success: true,
            data: transactions.map(t => ({
                id: t.id,
                wallet_type: t.wallet.type,
                type: t.type,
                amount: t.amount,
                description: t.description,
                reference: t.reference,
                status: t.status,
                created_at: t.createdAt
            }))
        });
    }
    catch (error) {
        console.error('Get wallet transactions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.getWalletTransactions = getWalletTransactions;
