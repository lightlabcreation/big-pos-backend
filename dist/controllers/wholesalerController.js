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
exports.getCreditRequests = exports.updateOrderStatus = exports.getRetailerOrders = exports.createProduct = exports.getInventory = exports.getDashboardStats = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// Get dashboard stats
const getDashboardStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const wholesalerProfile = yield prisma_1.default.wholesalerProfile.findUnique({
            where: { userId: req.user.id },
            include: { receivedOrders: true, inventory: true }
        });
        if (!wholesalerProfile) {
            return res.status(404).json({ error: 'Wholesaler profile not found' });
        }
        const totalOrders = wholesalerProfile.receivedOrders.length;
        const totalRevenue = wholesalerProfile.receivedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const totalProducts = wholesalerProfile.inventory.length;
        const pendingOrders = wholesalerProfile.receivedOrders.filter(o => o.status === 'pending').length;
        res.json({
            totalOrders,
            totalRevenue,
            totalProducts,
            pendingOrders
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
        const wholesalerProfile = yield prisma_1.default.wholesalerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!wholesalerProfile) {
            return res.status(404).json({ error: 'Wholesaler profile not found' });
        }
        const products = yield prisma_1.default.product.findMany({
            where: { wholesalerId: wholesalerProfile.id }
        });
        res.json({ products, count: products.length });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getInventory = getInventory;
// Create product
const createProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const wholesalerProfile = yield prisma_1.default.wholesalerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!wholesalerProfile) {
            return res.status(404).json({ error: 'Wholesaler profile not found' });
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
                wholesalerId: wholesalerProfile.id
            }
        });
        res.json({ success: true, product });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.createProduct = createProduct;
// Get retailer orders
const getRetailerOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const wholesalerProfile = yield prisma_1.default.wholesalerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!wholesalerProfile) {
            return res.status(404).json({ error: 'Wholesaler profile not found' });
        }
        const orders = yield prisma_1.default.order.findMany({
            where: { wholesalerId: wholesalerProfile.id },
            include: { items: { include: { product: true } }, retailer: { include: { user: true } } }
        });
        res.json({ orders, count: orders.length });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getRetailerOrders = getRetailerOrders;
// Update order status
const updateOrderStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const order = yield prisma_1.default.order.update({
            where: { id },
            data: { status }
        });
        res.json({ success: true, order });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.updateOrderStatus = updateOrderStatus;
// Get credit requests (placeholder)
const getCreditRequests = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // This would require a CreditRequest model in the schema
        res.json({ requests: [] });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getCreditRequests = getCreditRequests;
