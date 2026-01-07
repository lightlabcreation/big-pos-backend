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
exports.checkLoanEligibility = exports.getLoanProducts = exports.getLoans = exports.getRewardsBalance = exports.getWalletBalance = exports.getMyOrders = exports.getProducts = exports.getCategories = exports.getRetailers = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// Get retailers
const getRetailers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailers = yield prisma_1.default.retailerProfile.findMany({
            include: { user: true }
        });
        res.json({ retailers });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getRetailers = getRetailers;
// Get categories
const getCategories = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const products = yield prisma_1.default.product.findMany({ select: { category: true }, distinct: ['category'] });
        const categories = products.map(p => ({ name: p.category, id: p.category }));
        res.json({ categories });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getCategories = getCategories;
// Get products
const getProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { retailerId, category, search } = req.query;
        const where = {};
        if (retailerId)
            where.retailerId = retailerId;
        if (category)
            where.category = category;
        if (search)
            where.name = { contains: search };
        const products = yield prisma_1.default.product.findMany({ where });
        res.json({ products });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getProducts = getProducts;
// Get customer orders
const getMyOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!consumerProfile) {
            return res.status(404).json({ error: 'Consumer profile not found' });
        }
        const orders = yield prisma_1.default.sale.findMany({
            where: { consumerId: consumerProfile.id },
            include: { items: { include: { product: true } }, retailer: true }
        });
        res.json({ orders });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getMyOrders = getMyOrders;
// Get wallet balance
const getWalletBalance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!consumerProfile) {
            return res.status(404).json({ error: 'Consumer profile not found' });
        }
        res.json({
            balance: consumerProfile.walletBalance,
            currency: 'RWF'
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getWalletBalance = getWalletBalance;
// Get rewards balance
const getRewardsBalance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!consumerProfile) {
            return res.status(404).json({ error: 'Consumer profile not found' });
        }
        res.json({
            points: consumerProfile.rewardsPoints,
            tier: 'Bronze'
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getRewardsBalance = getRewardsBalance;
// Get loans
const getLoans = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!consumerProfile) {
            return res.status(404).json({ error: 'Consumer profile not found' });
        }
        const loans = yield prisma_1.default.loan.findMany({
            where: { consumerId: consumerProfile.id }
        });
        const totalOutstanding = loans
            .filter(l => l.status === 'active')
            .reduce((sum, l) => sum + l.amount, 0);
        res.json({ loans, summary: { total_outstanding: totalOutstanding } });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getLoans = getLoans;
// Get loan products
const getLoanProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const products = [
            { id: 'lp_1', name: 'Emergency Food Loan', min_amount: 1000, max_amount: 5000, interest_rate: 0, term_days: 7, loan_type: 'food' },
            { id: 'lp_2', name: 'Personal Cash Loan', min_amount: 5000, max_amount: 20000, interest_rate: 0.1, term_days: 30, loan_type: 'cash' }
        ];
        res.json({ products });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getLoanProducts = getLoanProducts;
// Check loan eligibility
const checkLoanEligibility = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.json({ eligible: true, credit_score: 65, max_eligible_amount: 15000 });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.checkLoanEligibility = checkLoanEligibility;
