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
exports.getWallet = exports.createBranch = exports.getBranches = exports.getOrders = exports.updateProduct = exports.createProduct = exports.getInventory = exports.getDashboardStats = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// Get dashboard stats
const getDashboardStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id },
            include: { sales: true, inventory: true, orders: true }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const totalSales = retailerProfile.sales.reduce((sum, s) => sum + s.totalAmount, 0);
        const totalProducts = retailerProfile.inventory.length;
        const pendingOrders = retailerProfile.orders.filter(o => o.status === 'pending').length;
        res.json({
            totalSales,
            totalProducts,
            pendingOrders,
            walletBalance: retailerProfile.walletBalance,
            creditLimit: retailerProfile.creditLimit
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getDashboardStats = getDashboardStats;
// Get inventory
const getInventory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const products = yield prisma_1.default.product.findMany({
            where: { retailerId: retailerProfile.id }
        });
        res.json({ products });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getInventory = getInventory;
// Create product
const createProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { name, description, sku, category, price, costPrice, stock } = req.body;
        const product = yield prisma_1.default.product.create({
            data: {
                name,
                description,
                sku,
                category,
                price: parseFloat(price),
                costPrice: costPrice ? parseFloat(costPrice) : undefined,
                stock: stock ? parseInt(stock) : 0,
                retailerId: retailerProfile.id
            }
        });
        res.json({ success: true, product });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.createProduct = createProduct;
// Update product
const updateProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, description, category, price, costPrice, stock } = req.body;
        const product = yield prisma_1.default.product.update({
            where: { id },
            data: {
                name,
                description,
                category,
                price: price ? parseFloat(price) : undefined,
                costPrice: costPrice ? parseFloat(costPrice) : undefined,
                stock: stock !== undefined ? parseInt(stock) : undefined
            }
        });
        res.json({ success: true, product });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.updateProduct = updateProduct;
// Get orders
const getOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const orders = yield prisma_1.default.order.findMany({
            where: { retailerId: retailerProfile.id },
            include: { items: { include: { product: true } }, wholesaler: true }
        });
        res.json({ orders });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getOrders = getOrders;
// Get branches
const getBranches = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const branches = yield prisma_1.default.branch.findMany({
            where: { retailerId: retailerProfile.id },
            include: { terminals: true }
        });
        res.json({ branches });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getBranches = getBranches;
// Create branch
const createBranch = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { name, location } = req.body;
        const branch = yield prisma_1.default.branch.create({
            data: {
                name,
                location,
                retailerId: retailerProfile.id
            }
        });
        res.json({ success: true, branch });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.createBranch = createBranch;
// Get wallet
const getWallet = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        res.json({
            balance: retailerProfile.walletBalance,
            creditLimit: retailerProfile.creditLimit,
            availableCredit: retailerProfile.creditLimit - 0 // Assuming no outstanding credit for now
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getWallet = getWallet;
