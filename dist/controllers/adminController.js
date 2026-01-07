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
exports.getCategories = exports.getNFCCards = exports.getLoans = exports.createWholesaler = exports.getWholesalers = exports.createRetailer = exports.getRetailers = exports.getCustomers = exports.getDashboard = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const auth_1 = require("../utils/auth");
// Get dashboard
const getDashboard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const totalCustomers = yield prisma_1.default.consumerProfile.count();
        const totalRetailers = yield prisma_1.default.retailerProfile.count();
        const totalWholesalers = yield prisma_1.default.wholesalerProfile.count();
        const totalLoans = yield prisma_1.default.loan.count();
        const totalSales = yield prisma_1.default.sale.count();
        const totalRevenue = (yield prisma_1.default.sale.findMany()).reduce((sum, s) => sum + s.totalAmount, 0);
        res.json({
            success: true,
            totalCustomers,
            totalRetailers,
            totalWholesalers,
            totalLoans,
            totalSales,
            totalRevenue
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getDashboard = getDashboard;
// Get customers
const getCustomers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const customers = yield prisma_1.default.consumerProfile.findMany({
            include: { user: true }
        });
        res.json({ customers });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getCustomers = getCustomers;
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
// Create retailer
const createRetailer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, business_name, phone, address, credit_limit } = req.body;
        const existingUser = yield prisma_1.default.user.findFirst({
            where: { OR: [{ email }, { phone }] }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        const hashedPassword = yield (0, auth_1.hashPassword)(password);
        const user = yield prisma_1.default.user.create({
            data: {
                email,
                phone,
                password: hashedPassword,
                role: 'retailer',
                name: business_name
            }
        });
        yield prisma_1.default.retailerProfile.create({
            data: {
                userId: user.id,
                shopName: business_name,
                address,
                creditLimit: credit_limit || 0
            }
        });
        res.json({ success: true, message: 'Retailer created successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.createRetailer = createRetailer;
// Get wholesalers
const getWholesalers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const wholesalers = yield prisma_1.default.wholesalerProfile.findMany({
            include: { user: true }
        });
        res.json({ wholesalers });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getWholesalers = getWholesalers;
// Create wholesaler
const createWholesaler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, company_name, phone, address } = req.body;
        const existingUser = yield prisma_1.default.user.findFirst({
            where: { OR: [{ email }, { phone }] }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        const hashedPassword = yield (0, auth_1.hashPassword)(password);
        const user = yield prisma_1.default.user.create({
            data: {
                email,
                phone,
                password: hashedPassword,
                role: 'wholesaler',
                name: company_name
            }
        });
        yield prisma_1.default.wholesalerProfile.create({
            data: {
                userId: user.id,
                companyName: company_name,
                address
            }
        });
        res.json({ success: true, message: 'Wholesaler created successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.createWholesaler = createWholesaler;
// Get loans
const getLoans = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const loans = yield prisma_1.default.loan.findMany({
            include: { consumer: { include: { user: true } } }
        });
        res.json({ loans });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getLoans = getLoans;
// Get NFC cards
const getNFCCards = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cards = yield prisma_1.default.nfcCard.findMany({
            include: { consumer: { include: { user: true } } }
        });
        res.json({ cards });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getNFCCards = getNFCCards;
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
