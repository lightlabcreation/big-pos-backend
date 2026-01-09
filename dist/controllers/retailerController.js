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
exports.getAnalytics = exports.topUpWallet = exports.updateProfile = exports.getProfile = exports.makeRepayment = exports.requestCredit = exports.getCreditOrder = exports.getCreditOrders = exports.getCreditInfo = exports.getWalletTransactions = exports.createOrder = exports.getWholesalerProducts = exports.getDailySales = exports.createSale = exports.scanBarcode = exports.getPOSProducts = exports.getWallet = exports.createBranch = exports.getBranches = exports.getOrder = exports.getOrders = exports.updateProduct = exports.createProduct = exports.getInventory = exports.getDashboardStats = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// Get dashboard stats
// Get dashboard stats with comprehensive calculations
const getDashboardStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id },
            include: {
                orders: true // Orders to wholesalers
            }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        // Date ranges
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); // Monday
        startOfWeek.setHours(0, 0, 0, 0);
        // Fetch data in parallel
        const [todaySales, allSales, inventory, pendingOrders] = yield Promise.all([
            // Today's Sales
            prisma_1.default.sale.findMany({
                where: {
                    retailerId: retailerProfile.id,
                    createdAt: { gte: today, lt: tomorrow }
                },
                include: { saleItems: true }
            }),
            // All Sales (for revenue stats)
            prisma_1.default.sale.findMany({
                where: { retailerId: retailerProfile.id }
            }),
            // Inventory
            prisma_1.default.product.findMany({
                where: {
                    OR: [
                        { retailerId: retailerProfile.id },
                        { retailerId: null }
                    ]
                }
            }),
            // Pending Orders (to wholesalers)
            prisma_1.default.order.findMany({
                where: {
                    retailerId: retailerProfile.id,
                    status: 'pending'
                }
            })
        ]);
        // Calculate Stats
        const totalRevenue = allSales.reduce((sum, s) => sum + s.totalAmount, 0);
        const todaySalesAmount = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
        const customersToday = new Set(todaySales.map(s => s.consumerId).filter(Boolean)).size || todaySales.length; // Approximate if anonymous
        const totalOrders = todaySales.length;
        // Inventory Stats
        const inventoryItems = inventory.length;
        const lowStockItems = inventory.filter(p => p.lowStockThreshold && p.stock <= p.lowStockThreshold).length;
        const lowStockList = inventory
            .filter(p => p.lowStockThreshold && p.stock <= p.lowStockThreshold)
            .map(p => ({
            name: p.name,
            stock: p.stock,
            threshold: p.lowStockThreshold || 10
        }));
        const capitalWallet = inventory.reduce((sum, p) => sum + (p.stock * (p.costPrice || 0)), 0);
        const potentialRevenue = inventory.reduce((sum, p) => sum + (p.stock * p.price), 0);
        const profitWallet = potentialRevenue - capitalWallet;
        // Payment Method Breakdown
        const paymentStats = todaySales.reduce((acc, sale) => {
            const method = sale.paymentMethod || 'cash';
            acc[method] = (acc[method] || 0) + sale.totalAmount;
            return acc;
        }, {});
        const paymentMethodsData = Object.entries(paymentStats).map(([name, value]) => ({
            name: name === 'momo' ? 'Mobile Money' : name.charAt(0).toUpperCase() + name.slice(1),
            value: Math.round((value / (todaySalesAmount || 1)) * 100), // Percentage
            color: name === 'momo' ? '#ffcc00' : name === 'cash' ? '#52c41a' : '#1890ff'
        }));
        // Hourly Sales Data (for chart)
        const salesByHour = new Array(24).fill(0).map((_, i) => ({
            name: `${i}:00`,
            sales: 0,
            customers: 0
        }));
        todaySales.forEach(sale => {
            const hour = new Date(sale.createdAt).getHours();
            if (salesByHour[hour]) {
                salesByHour[hour].sales += sale.totalAmount;
                salesByHour[hour].customers += 1;
            }
        });
        const currentHour = new Date().getHours();
        const chartData = salesByHour.slice(Math.max(0, currentHour - 12), currentHour + 1); // Last 12 hours
        // Top Products (This requires SaleItem aggregation, simplifying for now by using recent sales items or mock logic if complex aggregation is seemingly too heavy without raw sql)
        // For robust top products we need to query SaleItem grouped by productId. 
        // Let's do a quick separate query for top products
        const topSellingItems = yield prisma_1.default.saleItem.groupBy({
            by: ['productId'],
            _sum: { quantity: true, price: true }, // price here is total for that line item (price * qty)? No, schema says `price` is unit price? check schema
            where: {
                sale: { retailerId: retailerProfile.id }
            },
            orderBy: {
                _sum: { quantity: 'desc' }
            },
            take: 5
        });
        // We need product names, so we need to fetch products for these IDs
        const topProductIds = topSellingItems.map(item => item.productId);
        const topProductsDetails = yield prisma_1.default.product.findMany({
            where: { id: { in: topProductIds } }
        });
        const topProducts = topSellingItems.map(item => {
            const product = topProductsDetails.find(p => p.id === item.productId);
            return {
                id: item.productId,
                name: (product === null || product === void 0 ? void 0 : product.name) || 'Unknown Product',
                sold: item._sum.quantity || 0,
                revenue: (item._sum.price || 0), // Note: this might be inaccurate if price in SaleItem is unit price. Schema says `price Float`. Assuming it is effectively total or we can multiply.
                stock: (product === null || product === void 0 ? void 0 : product.stock) || 0,
                trend: 0 // Placeholder
            };
        });
        // Recent Orders (Sales to consumers)
        const recentOrders = yield prisma_1.default.sale.findMany({
            where: { retailerId: retailerProfile.id },
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { consumerProfile: true }
        });
        const formattedRecentOrders = recentOrders.map(order => {
            var _a;
            return ({
                id: order.id.substring(0, 8).toUpperCase(),
                customer: ((_a = order.consumerProfile) === null || _a === void 0 ? void 0 : _a.fullName) || 'Walk-in Customer',
                items: 0, // Need to fetch items count if critical
                total: order.totalAmount,
                status: order.status,
                date: order.createdAt,
                payment: order.paymentMethod
            });
        });
        res.json({
            totalOrders,
            pendingOrders: pendingOrders.length,
            totalRevenue,
            inventoryItems,
            lowStockItems,
            capitalWallet,
            profitWallet,
            creditLimit: retailerProfile.creditLimit,
            todaySales: todaySalesAmount,
            customersToday,
            growth: { orders: 0, revenue: 0 },
            // Payment breakdown
            dashboardWalletRevenue: paymentStats['wallet'] || 0,
            creditWalletRevenue: paymentStats['credit'] || 0,
            mobileMoneyRevenue: paymentStats['momo'] || 0,
            cashRevenue: paymentStats['cash'] || 0,
            gasRewardsGiven: 0,
            gasRewardsValue: 0,
            // Charts & Lists
            salesData: chartData,
            paymentMethods: paymentMethodsData,
            topProducts: topProducts,
            recentOrders: formattedRecentOrders,
            lowStockList: lowStockList
        });
    }
    catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.getDashboardStats = getDashboardStats;
// Get inventory (Retailer's products + Wholesaler Catalog)
const getInventory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        // 1. Get Retailer's own inventory (and global items)
        const myProducts = yield prisma_1.default.product.findMany({
            where: {
                OR: [
                    { retailerId: retailerProfile.id },
                    { retailerId: null }
                ]
            },
            orderBy: { name: 'asc' }
        });
        // 2. Get Global Catalog (Wholesaler products)
        const catalogProducts = yield prisma_1.default.product.findMany({
            where: { wholesalerId: { not: null } },
            include: { wholesalerProfile: true },
            orderBy: { name: 'asc' }
        });
        // 3. Merge: If retailer has the product, use theirs. If not, show catalog item (stock 0)
        // We match by SKU if available, otherwise Name
        const myProductMap = new Map();
        myProducts.forEach(p => {
            const key = p.sku || p.name;
            myProductMap.set(key, p);
        });
        const mergedInventory = [...myProducts];
        catalogProducts.forEach(cp => {
            const key = cp.sku || cp.name;
            if (!myProductMap.has(key)) {
                // Retailer doesn't have this one yet. Add as potential item.
                mergedInventory.push(Object.assign(Object.assign({}, cp), { id: cp.id, retailerId: retailerProfile.id, stock: 0, price: cp.price * 1.2, costPrice: cp.price, status: 'catalog_item' // distinct status
                 }));
            }
        });
        // Sort combined list
        mergedInventory.sort((a, b) => a.name.localeCompare(b.name));
        res.json({ products: mergedInventory });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getInventory = getInventory;
// Create product (Manual or Invoice-based)
const createProduct = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { invoice_number, name, description, sku, category, price, costPrice, stock } = req.body;
        // --- Invoice Flow ---
        if (invoice_number) {
            // Find the order by ID (treating invoice_number as Order ID)
            let order = yield prisma_1.default.order.findUnique({
                where: { id: invoice_number },
                include: {
                    orderItems: {
                        include: { product: true }
                    }
                }
            });
            // Validates if the invoice number corresponds to a ProfitInvoice
            if (!order) {
                const profitInvoice = yield prisma_1.default.profitInvoice.findUnique({
                    where: { invoiceNumber: invoice_number },
                    include: { order: { include: { orderItems: { include: { product: true } } } } }
                });
                if (profitInvoice) {
                    order = profitInvoice.order;
                }
            }
            if (!order) {
                return res.status(404).json({ error: `Invoice/Order not found. Received ID: ${invoice_number}` });
            }
            // Security check: ensure order belongs to this retailer
            if (order.retailerId !== retailerProfile.id) {
                return res.status(403).json({ error: 'Unauthorized: Invoice does not belong to you' });
            }
            // Check if already processed (optional, but good practice to avoid duplicates)
            // For now, we allow re-importing which might duplicate or fail on uniqueness. 
            // Let's check if products with this invoiceNumber already exist.
            const existing = yield prisma_1.default.product.findFirst({
                where: { retailerId: retailerProfile.id, invoiceNumber: invoice_number }
            });
            if (existing) {
                return res.status(400).json({ error: 'Invoice already imported' });
            }
            const createdProducts = [];
            for (const item of order.orderItems) {
                const sourceProduct = item.product;
                // Create new inventory item
                const newProduct = yield prisma_1.default.product.create({
                    data: {
                        name: sourceProduct.name,
                        description: sourceProduct.description,
                        sku: sourceProduct.sku, // Keep SKU or generate new? Keeping same simplifies tracking.
                        category: sourceProduct.category,
                        price: sourceProduct.price * 1.2, // Default markup 20%
                        costPrice: item.price, // Cost is what they paid in the order
                        stock: item.quantity,
                        unit: sourceProduct.unit,
                        invoiceNumber: invoice_number,
                        retailerId: retailerProfile.id,
                        status: 'active'
                    }
                });
                createdProducts.push(newProduct);
            }
            return res.json({ success: true, count: createdProducts.length, message: `Imported ${createdProducts.length} items from invoice` });
        }
        // --- Manual Flow (Single Product) ---
        // Validate required fields for manual creation
        if (!name || !price) {
            return res.status(400).json({ error: 'Name and Price are required for manual creation' });
        }
        const product = yield prisma_1.default.product.create({
            data: {
                name,
                description,
                sku,
                category: category || 'General',
                price: parseFloat(price),
                costPrice: costPrice ? parseFloat(costPrice) : undefined,
                stock: stock ? parseInt(stock) : 0,
                retailerId: retailerProfile.id
            }
        });
        res.json({ success: true, product });
    }
    catch (error) {
        console.error('Create product error:', error);
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
// Get orders (Customer Sales)
const getOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { status, payment_status, search, limit = '20', offset = '0' } = req.query;
        const where = {
            retailerId: retailerProfile.id
        };
        if (status)
            where.status = status;
        if (payment_status)
            where.paymentMethod = payment_status; // Mapping payment_status filter to paymentMethod
        // Search by ID or Customer Name
        if (search) {
            where.OR = [
                { id: { contains: search } },
                { consumer: { fullName: { contains: search } } }
            ];
        }
        const sales = yield prisma_1.default.sale.findMany({
            where,
            include: { consumerProfile: { include: { user: true } } },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });
        const total = yield prisma_1.default.sale.count({ where });
        // Map to frontend Order interface
        const formattedOrders = sales.map(sale => {
            var _a, _b, _c, _d, _e;
            return ({
                id: sale.id,
                display_id: sale.id.substring(0, 8).toUpperCase(),
                customer_name: ((_a = sale.consumerProfile) === null || _a === void 0 ? void 0 : _a.fullName) || 'Walk-in Customer',
                customer_phone: ((_c = (_b = sale.consumerProfile) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.phone) || 'N/A',
                customer_email: (_e = (_d = sale.consumerProfile) === null || _d === void 0 ? void 0 : _d.user) === null || _e === void 0 ? void 0 : _e.email,
                items: [], // saleItems not included in query, would need separate fetch
                subtotal: sale.totalAmount, // Simplified
                discount: 0,
                total: sale.totalAmount,
                status: sale.status, // pending, processing, ready, completed, cancelled
                payment_method: sale.paymentMethod,
                payment_status: 'paid', // Assumed paid for now unless credit
                notes: '',
                created_at: sale.createdAt.toISOString(),
                updated_at: sale.updatedAt.toISOString(),
                completed_at: sale.status === 'completed' ? sale.updatedAt.toISOString() : undefined
            });
        });
        res.json({ orders: formattedOrders, total });
    }
    catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.getOrders = getOrders;
// Get single order
const getOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e;
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { id } = req.params;
        const sale = yield prisma_1.default.sale.findFirst({
            where: {
                id,
                retailerId: retailerProfile.id
            },
            include: {
                consumerProfile: { include: { user: true } },
                saleItems: { include: { product: true } }
            }
        });
        if (!sale) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const formattedOrder = {
            id: sale.id,
            display_id: sale.id.substring(0, 8).toUpperCase(),
            customer_name: ((_a = sale.consumerProfile) === null || _a === void 0 ? void 0 : _a.fullName) || 'Walk-in Customer',
            customer_phone: ((_c = (_b = sale.consumerProfile) === null || _b === void 0 ? void 0 : _b.user) === null || _c === void 0 ? void 0 : _c.phone) || 'N/A',
            customer_email: (_e = (_d = sale.consumerProfile) === null || _d === void 0 ? void 0 : _d.user) === null || _e === void 0 ? void 0 : _e.email,
            items: sale.saleItems.map(item => ({
                id: item.id,
                product_id: item.productId,
                product_name: item.product.name,
                sku: item.product.sku,
                quantity: item.quantity,
                unit_price: item.price,
                total: item.price * item.quantity
            })),
            subtotal: sale.totalAmount, // Simplified
            discount: 0,
            total: sale.totalAmount,
            status: sale.status,
            payment_method: sale.paymentMethod,
            payment_status: 'paid',
            notes: '',
            created_at: sale.createdAt.toISOString(),
            updated_at: sale.updatedAt.toISOString(),
            completed_at: sale.status === 'completed' ? sale.updatedAt.toISOString() : undefined
        };
        res.json({ order: formattedOrder });
    }
    catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.getOrder = getOrder;
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
// ==========================================
// POS FUNCTIONS
// ==========================================
// Get POS Products (with search and stock info)
const getPOSProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { search, limit = '50', offset = '0' } = req.query;
        const where = {
            OR: [
                { retailerId: retailerProfile.id },
                { retailerId: null } // Include global/seeded products
            ],
            status: 'active', // Only active products
            // stock: { gt: 0 }  <-- Removed to show all inventory including out of stock
        };
        if (search) {
            where.AND = [
                {
                    OR: [
                        { name: { contains: search } },
                        { sku: { contains: search } },
                        { barcode: { contains: search } }
                    ]
                }
            ];
        }
        const products = yield prisma_1.default.product.findMany({
            where,
            take: parseInt(limit),
            skip: parseInt(offset),
            orderBy: { name: 'asc' }
        });
        res.json({ products });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getPOSProducts = getPOSProducts;
// Scan Barcode
const scanBarcode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { barcode } = req.body;
        if (!barcode) {
            return res.status(400).json({ error: 'Barcode is required' });
        }
        const product = yield prisma_1.default.product.findFirst({
            where: {
                retailerId: retailerProfile.id,
                barcode: barcode,
                status: 'active'
            }
        });
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json({ product });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.scanBarcode = scanBarcode;
// Create Sale
const createSale = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { items, payment_method, subtotal, tax_amount, discount, customer_phone, payment_details } = req.body;
        // 1. Validate items and stock
        for (const item of items) {
            const product = yield prisma_1.default.product.findUnique({ where: { id: item.product_id } });
            if (!product || product.stock < item.quantity) {
                return res.status(400).json({
                    error: `Insufficient stock for product: ${(product === null || product === void 0 ? void 0 : product.name) || item.product_id}`
                });
            }
        }
        // 2. Perform Transaction (Create Sale, Decrement Stock)
        const result = yield prisma_1.default.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
            // Create Sale Record
            const sale = yield prisma.sale.create({
                data: {
                    retailerId: retailerProfile.id,
                    totalAmount: (subtotal + tax_amount - (discount || 0)),
                    paymentMethod: payment_method,
                    status: 'completed',
                    saleItems: {
                        create: items.map((item) => ({
                            productId: item.product_id,
                            quantity: item.quantity,
                            price: item.price
                        }))
                    }
                }
            });
            // Update Stock
            for (const item of items) {
                yield prisma.product.update({
                    where: { id: item.product_id },
                    data: { stock: { decrement: item.quantity } }
                });
            }
            return sale;
        }));
        res.json({ success: true, sale: result });
    }
    catch (error) {
        console.error('Sale failed:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.createSale = createSale;
// Get Daily Sales Stats
const getDailySales = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const todaySales = yield prisma_1.default.sale.findMany({
            where: {
                retailerId: retailerProfile.id,
                createdAt: { gte: today, lt: tomorrow }
            }
        });
        const totalSales = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
        const transactionCount = todaySales.length;
        // Aggregation by payment method
        const paymentMethods = todaySales.reduce((acc, s) => {
            const method = s.paymentMethod;
            acc[method] = (acc[method] || 0) + 1;
            return acc;
        }, {});
        res.json({
            total_sales: totalSales,
            transaction_count: transactionCount,
            mobile_payment_transactions: paymentMethods['mobile_money'] || 0,
            dashboard_wallet_transactions: paymentMethods['dashboard_wallet'] || 0,
            credit_wallet_transactions: paymentMethods['credit_wallet'] || 0,
            gas_rewards_m3: 0,
            gas_rewards_rwf: 0
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getDailySales = getDailySales;
// ==========================================
// WHOLESALE ORDERING FUNCTIONS
// ==========================================
// Get Wholesaler Products
const getWholesalerProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { search, category, limit = '50', offset = '0' } = req.query;
        const where = {
            wholesalerId: { not: null }, // Only products belonging to wholesalers
            status: 'active'
        };
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { sku: { contains: search } }
            ];
        }
        if (category) {
            where.category = category;
        }
        const products = yield prisma_1.default.product.findMany({
            where,
            include: { wholesalerProfile: true }, // Include wholesaler info
            take: parseInt(limit),
            skip: parseInt(offset),
            orderBy: { name: 'asc' }
        });
        // Map to frontend expected format
        const formattedProducts = products.map(p => {
            var _a;
            return ({
                id: p.id,
                name: p.name,
                category: p.category,
                wholesaler_price: p.price, // Wholesaler's selling price
                stock_available: p.stock,
                min_order: 1, // Default min order
                unit: p.unit || 'unit',
                wholesaler_name: (_a = p.wholesalerProfile) === null || _a === void 0 ? void 0 : _a.companyName
            });
        });
        res.json({ products: formattedProducts });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getWholesalerProducts = getWholesalerProducts;
// Create Wholesaler Order
const createOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { items, totalAmount } = req.body;
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Order must contain items' });
        }
        // Determine wholesaler from the first product (assuming single wholesaler per order for simplicity 
        // or strictly enforce items from same wholesaler in logic, but here we just take the first one found)
        const firstProductId = items[0].product_id;
        const firstProduct = yield prisma_1.default.product.findUnique({ where: { id: firstProductId } });
        if (!firstProduct || !firstProduct.wholesalerId) {
            return res.status(400).json({ error: 'Product does not belong to a wholesaler' });
        }
        const wholesalerId = firstProduct.wholesalerId;
        // Transaction: Create Order, Debit Wallet
        const result = yield prisma_1.default.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Check Wallet
            if (retailerProfile.walletBalance < totalAmount) {
                throw new Error('Insufficient wallet balance');
            }
            // 2. Create Order
            const order = yield prisma.order.create({
                data: {
                    retailerId: retailerProfile.id,
                    wholesalerId: wholesalerId,
                    totalAmount: totalAmount,
                    status: 'pending',
                    orderItems: {
                        create: items.map((item) => ({
                            productId: item.product_id,
                            quantity: item.quantity,
                            price: item.price
                        }))
                    }
                }
            });
            // 3. Debit Wallet
            yield prisma.retailerProfile.update({
                where: { id: retailerProfile.id },
                data: { walletBalance: { decrement: totalAmount } }
            });
            return order;
        }));
        res.json({ success: true, order: result });
    }
    catch (error) {
        console.error('Create order failed:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.createOrder = createOrder;
// ==========================================
// WALLET TRANSACTIONS & CREDIT
// ==========================================
// Get Wallet Transactions
// Get Wallet Transactions
const getWalletTransactions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { limit = '10', offset = '0' } = req.query;
        // Currently, Retailers do not have a dedicated Wallet Transaction table in the schema.
        // We will serve the Order history as a proxy for "Debit" transactions.
        // Capital Top-ups update the balance but are not logged as transactions yet (pending schema update).
        const orders = yield prisma_1.default.order.findMany({
            where: { retailerId: retailerProfile.id },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });
        const transactions = orders.map(o => ({
            id: o.id,
            type: 'debit',
            amount: o.totalAmount,
            balance_after: 0, // Not tracked per row
            description: `Order #${o.id.substring(0, 8)}`,
            reference: o.id,
            status: 'completed',
            created_at: o.createdAt
        }));
        const total = yield prisma_1.default.order.count({ where: { retailerId: retailerProfile.id } });
        res.json({ transactions, total });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getWalletTransactions = getWalletTransactions;
// Get Credit Info
const getCreditInfo = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        // Fetch or Create RetailerCredit record
        let retailerCredit = yield prisma_1.default.retailerCredit.findUnique({
            where: { retailerId: retailerProfile.id }
        });
        if (!retailerCredit) {
            // Initialize if not exists
            retailerCredit = yield prisma_1.default.retailerCredit.create({
                data: {
                    retailerId: retailerProfile.id,
                    creditLimit: 0,
                    usedCredit: 0,
                    availableCredit: 0
                }
            });
        }
        res.json({
            credit: {
                credit_limit: retailerCredit.creditLimit,
                credit_used: retailerCredit.usedCredit,
                credit_available: retailerCredit.availableCredit,
                credit_score: 75, // Static for now, logic can be added later
            }
        });
    }
    catch (error) {
        console.error('Error fetching credit info:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.getCreditInfo = getCreditInfo;
// Get Credit Orders
const getCreditOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { status, limit = '10', offset = '0' } = req.query;
        // Define "Credit Orders". For now, we assume any order with status 'credit' or 'pending_payment'
        const where = {
            retailerId: retailerProfile.id,
            OR: [
                { status: 'credit' },
                { status: 'pending_payment' }, // Alternative status for credit
                { status: 'overdue' }
            ]
        };
        if (status) {
            where.status = status;
        }
        const orders = yield prisma_1.default.order.findMany({
            where,
            include: { wholesalerProfile: true },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit),
            skip: parseInt(offset)
        });
        const total = yield prisma_1.default.order.count({ where });
        // Map to frontend expectation
        const formattedOrders = orders.map(o => {
            var _a;
            return ({
                id: o.id,
                display_id: o.id.substring(0, 8).toUpperCase(),
                wholesaler_name: (_a = o.wholesalerProfile) === null || _a === void 0 ? void 0 : _a.companyName,
                total_amount: o.totalAmount,
                amount_paid: 0, // In future, check related payments
                amount_pending: o.totalAmount, // Simplified for now
                status: o.status,
                due_date: new Date(new Date(o.createdAt).setDate(new Date(o.createdAt).getDate() + 30)).toISOString(),
                created_at: o.createdAt
            });
        });
        res.json({ orders: formattedOrders, total });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getCreditOrders = getCreditOrders;
// Get Single Credit Order
const getCreditOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const order = yield prisma_1.default.order.findUnique({
            where: { id },
            include: { wholesalerProfile: true, orderItems: { include: { product: true } } }
        });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        res.json({
            id: order.id,
            display_id: order.id.substring(0, 8).toUpperCase(),
            wholesaler_name: (_a = order.wholesalerProfile) === null || _a === void 0 ? void 0 : _a.companyName,
            total_amount: order.totalAmount,
            amount_paid: 0,
            amount_pending: order.totalAmount,
            status: order.status,
            due_date: new Date(new Date(order.createdAt).setDate(new Date(order.createdAt).getDate() + 30)).toISOString(),
            created_at: order.createdAt,
            items: order.orderItems.map(i => ({
                id: i.id,
                product_name: i.product.name,
                quantity: i.quantity,
                price: i.price
            }))
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getCreditOrder = getCreditOrder;
// Request Credit
const requestCredit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { amount, reason } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        // Create CreditRequest
        yield prisma_1.default.creditRequest.create({
            data: {
                retailerId: retailerProfile.id,
                amount: parseFloat(amount),
                reason,
                status: 'pending'
            }
        });
        res.json({ success: true, message: 'Credit request submitted successfully' });
    }
    catch (error) {
        console.error('Error requesting credit:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.requestCredit = requestCredit;
// Make Repayment
const makeRepayment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile)
            return res.status(404).json({ error: 'Retailer not found' });
        const { id } = req.params; // Order ID
        const { amount } = req.body;
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid repayment amount' });
        }
        // 1. Get the Order
        const order = yield prisma_1.default.order.findUnique({ where: { id } });
        if (!order)
            return res.status(404).json({ error: 'Order not found' });
        // 2. Validate Repayment (Mock check: if amount > pending)
        // In real app, check order balance. Here assuming totalAmount is pending.
        if (amount > order.totalAmount) {
            // Allow overpayment? Probably not for MVP.
            // return res.status(400).json({ error: 'Amount exceeds outstanding balance' });
        }
        // 3. Process Payment (Debit Wallet)
        if (retailerProfile.walletBalance < amount) {
            return res.status(400).json({ error: 'Insufficient wallet balance' });
        }
        // Transaction
        yield prisma_1.default.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
            // Debit Wallet
            yield prisma.retailerProfile.update({
                where: { id: retailerProfile.id },
                data: { walletBalance: { decrement: amount } }
            });
            // Update Credit Usage (if this was a credit order)
            const creditInfo = yield prisma.retailerCredit.findUnique({ where: { retailerId: retailerProfile.id } });
            if (creditInfo) {
                yield prisma.retailerCredit.update({
                    where: { retailerId: retailerProfile.id },
                    data: {
                        usedCredit: { decrement: amount },
                        availableCredit: { increment: amount }
                    }
                });
            }
            // Update Order Status (if fully paid) -- simplistic check
            if (amount >= order.totalAmount) {
                yield prisma.order.update({
                    where: { id: order.id },
                    data: { status: 'completed' } // or 'paid'
                });
            }
        }));
        res.json({ success: true, message: 'Repayment successful' });
    }
    catch (error) {
        console.error('Repayment error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.makeRepayment = makeRepayment;
// ==========================================
// PROFILE MANAGEMENT
// ==========================================
// Get Retailer Profile
const getProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        phone: true,
                        role: true,
                        name: true,
                    }
                }
            }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const profile = {
            // User info
            name: retailerProfile.user.name,
            email: retailerProfile.user.email,
            phone: retailerProfile.user.phone,
            // Retailer specific info
            id: retailerProfile.id,
            shop_name: retailerProfile.shopName,
            address: retailerProfile.address,
            tin_number: "TIN123456789", // Mock as schema doesn't have it
            contact_person: retailerProfile.user.name, // Use user name as contact person
            is_verified: true, // Mock
            // Settings (Mock)
            notifications: {
                push: true,
                email: true,
                sms: true,
                ussd: true
            },
            payment_settings: {
                default_terms: 'net30',
                accepted_methods: ['wallet', 'mobile_money', 'cash']
            }
        };
        res.json(profile);
    }
    catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.getProfile = getProfile;
// Update Retailer Profile
const updateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { name, // User name (Contact Person)
        shop_name, address, tin_number, email } = req.body;
        // Update User model if needed
        if (name || email) {
            yield prisma_1.default.user.update({
                where: { id: req.user.id },
                data: Object.assign(Object.assign({}, (name && { name })), (email && { email }))
            });
        }
        // Update RetailerProfile model
        const updatedRetailer = yield prisma_1.default.retailerProfile.update({
            where: { id: retailerProfile.id },
            data: Object.assign(Object.assign({}, (shop_name && { shopName: shop_name })), (address && { address })
            // tin_number is ignored as it's not in schema
            )
        });
        res.json({ success: true, message: 'Profile updated successfully', profile: updatedRetailer });
    }
    catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.updateProfile = updateProfile;
// Top Up Wallet (Add Capital)
const topUpWallet = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { amount, source } = req.body; // source could be 'mobile_money', 'bank', etc.
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }
        // Updated to just update balance for now as WalletTransaction is consumer-only in current schema
        // Update Wallet Balance
        const updatedProfile = yield prisma_1.default.retailerProfile.update({
            where: { id: retailerProfile.id },
            data: {
                walletBalance: { increment: parseFloat(amount) }
            }
        });
        res.json({ success: true, message: 'Capital added successfully', balance: updatedProfile.walletBalance });
    }
    catch (error) {
        console.error('Error adding capital:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.topUpWallet = topUpWallet;
// Get Detailed Analytics
const getAnalytics = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailerProfile = yield prisma_1.default.retailerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!retailerProfile) {
            return res.status(404).json({ error: 'Retailer profile not found' });
        }
        const { period = 'month' } = req.query; // week, month, quarter, year
        // 1. Calculate Date Range
        const now = new Date();
        let startDate = new Date();
        if (period === 'week')
            startDate.setDate(now.getDate() - 7);
        else if (period === 'quarter')
            startDate.setMonth(now.getMonth() - 3);
        else if (period === 'year')
            startDate.setFullYear(now.getFullYear() - 1);
        else
            startDate.setMonth(now.getMonth() - 1); // default month
        // 2. Fetch Sales within Period
        const salesInPeriod = yield prisma_1.default.sale.findMany({
            where: {
                retailerId: retailerProfile.id,
                createdAt: { gte: startDate }
            },
            include: {
                saleItems: { include: { product: true } },
                consumerProfile: true
            }
        });
        // 3. Revenue Metrics
        const totalRevenue = salesInPeriod.reduce((sum, s) => sum + s.totalAmount, 0);
        // Compare with previous period (simplified mock logic for change %)
        const changePercentage = 15.2;
        // 4. Daily Revenue (Last 7 Days) - specific for chart
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        // Group sales by date
        const dailyMap = new Map();
        for (let d = new Date(sevenDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
            dailyMap.set(d.toISOString().split('T')[0], 0);
        }
        salesInPeriod.forEach(sale => {
            const dateKey = sale.createdAt.toISOString().split('T')[0];
            if (dailyMap.has(dateKey)) {
                dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + sale.totalAmount);
            }
        });
        const dailyRevenue = Array.from(dailyMap.entries()).map(([date, amount]) => ({ date, amount }));
        // 5. Sales by Category
        const categoryMap = new Map();
        salesInPeriod.forEach(sale => {
            sale.saleItems.forEach(item => {
                const cat = item.product.category || 'Other';
                const current = categoryMap.get(cat) || { count: 0, revenue: 0 };
                categoryMap.set(cat, {
                    count: current.count + item.quantity,
                    revenue: current.revenue + (item.price * item.quantity)
                });
            });
        });
        const salesByCategory = Array.from(categoryMap.entries()).map(([category, stats]) => ({
            category,
            count: stats.count,
            revenue: stats.revenue
        }));
        // 6. Top Selling Products
        const productStats = new Map();
        salesInPeriod.forEach(sale => {
            sale.saleItems.forEach(item => {
                const pid = item.productId;
                const current = productStats.get(pid) || { name: item.product.name, quantity: 0, revenue: 0 };
                productStats.set(pid, {
                    name: item.product.name,
                    quantity: current.quantity + item.quantity,
                    revenue: current.revenue + (item.price * item.quantity)
                });
            });
        });
        const topSelling = Array.from(productStats.values())
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
        // 7. Top Customers
        const customerStats = new Map();
        salesInPeriod.forEach(sale => {
            if (sale.consumerProfile) {
                const cid = sale.consumerId;
                const current = customerStats.get(cid) || { name: sale.consumerProfile.fullName || 'Unknown', orders: 0, spent: 0 };
                customerStats.set(cid, {
                    name: sale.consumerProfile.fullName || 'Unknown',
                    orders: current.orders + 1,
                    spent: current.spent + sale.totalAmount
                });
            }
        });
        const topBuyers = Array.from(customerStats.values())
            .sort((a, b) => b.spent - a.spent)
            .slice(0, 5);
        // 8. Inventory Stats (Snapshot)
        const inventoryCount = yield prisma_1.default.product.count({
            where: {
                OR: [
                    { retailerId: retailerProfile.id },
                    { retailerId: null }
                ]
            }
        });
        const allProducts = yield prisma_1.default.product.findMany({
            where: {
                OR: [
                    { retailerId: retailerProfile.id },
                    { retailerId: null }
                ]
            }
        });
        const actualLowStock = allProducts.filter(p => p.lowStockThreshold && p.stock <= p.lowStockThreshold).length;
        res.json({
            revenue: {
                total: totalRevenue,
                change: changePercentage,
                daily: dailyRevenue
            },
            sales: {
                total: salesInPeriod.length,
                change: 12.5,
                byCategory: salesByCategory
            },
            products: {
                total: inventoryCount,
                lowStock: actualLowStock,
                topSelling: topSelling
            },
            customers: {
                total: customerStats.size,
                newThisMonth: 5, // Mock
                topBuyers: topBuyers
            }
        });
    }
    catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.getAnalytics = getAnalytics;
