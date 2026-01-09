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
exports.getFoodCredit = exports.getCreditTransactions = exports.getActiveLoanLedger = exports.repayLoan = exports.applyForLoan = exports.checkLoanEligibility = exports.getLoanProducts = exports.getLoans = exports.getRewardsBalance = exports.getWalletBalance = exports.confirmDelivery = exports.cancelOrder = exports.getMyOrders = exports.getProducts = exports.getCategories = exports.getRetailers = exports.createOrder = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// Create a new retail order
const createOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { retailerId, items, paymentMethod, total } = req.body;
        const userId = req.user.id;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ error: 'Consumer profile not found' });
        }
        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'Order must contain items' });
        }
        const result = yield prisma_1.default.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Process Payment (Wallet deduction)
            if (paymentMethod === 'wallet') {
                const wallet = yield prisma.wallet.findFirst({
                    where: { consumerId: consumerProfile.id, type: 'dashboard_wallet' }
                });
                if (!wallet || wallet.balance < total) {
                    throw new Error('Insufficient wallet balance');
                }
                yield prisma.wallet.update({
                    where: { id: wallet.id },
                    data: { balance: { decrement: total } }
                });
                yield prisma.walletTransaction.create({
                    data: {
                        walletId: wallet.id,
                        type: 'purchase',
                        amount: -total,
                        description: `Payment to Retailer`,
                        status: 'completed'
                    }
                });
            }
            // 2. Create Sale Record
            const sale = yield prisma.sale.create({
                data: {
                    consumerId: consumerProfile.id,
                    retailerId: retailerId,
                    totalAmount: total,
                    status: 'pending',
                    paymentMethod: paymentMethod,
                    saleItems: {
                        create: items.map((item) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            price: item.price
                        }))
                    }
                },
                include: { saleItems: true }
            });
            // 3. Update Product Stock (Optional based on business logic, assuming simple stock handling)
            /*
            // If we were tracking inventory strictly, we would decrement here.
            for (const item of items) {
               await prisma.product.update({
                  where: { id: item.productId },
                  data: { stock: { decrement: item.quantity } }
               });
            }
            */
            return sale;
        }));
        res.json({ success: true, order: result, message: 'Order created successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.createOrder = createOrder;
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
// Get normalized customer orders (merging Sales and CustomerOrders)
const getMyOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!consumerProfile) {
            return res.status(404).json({ error: 'Consumer profile not found' });
        }
        // 1. Fetch Sales (Retail Orders)
        const sales = yield prisma_1.default.sale.findMany({
            where: { consumerId: consumerProfile.id },
            include: {
                saleItems: {
                    include: { product: true }
                },
                retailerProfile: {
                    select: {
                        id: true,
                        shopName: true,
                        address: true,
                        user: { select: { phone: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        // 2. Fetch CustomerOrders (Gas/Other)
        const otherOrders = yield prisma_1.default.customerOrder.findMany({
            where: { consumerId: consumerProfile.id },
            orderBy: { createdAt: 'desc' }
        });
        // 3. Normalize Sales to Order Interface
        const normalizedSales = sales.map(sale => {
            var _a;
            return ({
                id: sale.id,
                order_number: `ORD-${sale.createdAt.getFullYear()}-${sale.id.substring(0, 4).toUpperCase()}`, // Generate if missing
                status: sale.status,
                retailer: {
                    id: sale.retailerId,
                    name: sale.retailerProfile.shopName,
                    location: sale.retailerProfile.address || 'Unknown Location',
                    phone: ((_a = sale.retailerProfile.user) === null || _a === void 0 ? void 0 : _a.phone) || 'N/A'
                },
                items: sale.saleItems.map(item => ({
                    id: item.id,
                    product_id: item.productId,
                    product_name: item.product.name,
                    quantity: item.quantity,
                    unit_price: item.price,
                    total: item.price * item.quantity
                })),
                subtotal: sale.totalAmount, // Assuming no extra fees for now
                delivery_fee: 0,
                total: sale.totalAmount,
                delivery_address: consumerProfile.address || 'Pickup',
                created_at: sale.createdAt.toISOString(),
                updated_at: sale.updatedAt.toISOString(),
                payment_method: sale.paymentMethod,
                // Optional fields defaulting to null/undefined
                packager: undefined,
                shipper: undefined,
                meter_id: undefined
            });
        });
        // 4. Normalize CustomerOrders (Gas/Service)
        const normalizedOthers = otherOrders.map(order => {
            var _a;
            let items = [];
            let meterId = undefined;
            try {
                items = JSON.parse(order.items || '[]');
                // For gas, items might be different, let's try to map generic items
                // If gas order, items structure is [{meterNumber, units, amount}]
                if (order.orderType === 'gas') {
                    // Try to extract meter info if available in metadata or items
                    // This is a simplification based on typical gas order structure
                }
            }
            catch (e) { }
            const metadata = order.metadata ? JSON.parse(order.metadata) : {};
            return {
                id: order.id,
                order_number: `ORD-${order.createdAt.getFullYear()}-${order.id.substring(0, 4).toUpperCase()}`,
                status: order.status,
                retailer: {
                    id: 'GAS_SERVICE',
                    name: 'Big Gas Service',
                    location: 'Main Depot',
                    phone: '+250 788 000 000'
                },
                items: items.map((i, idx) => ({
                    id: `${order.id}-${idx}`,
                    product_id: 'gas',
                    product_name: order.orderType === 'gas' ? `Gas Token (${i.units} units)` : 'Service Item',
                    quantity: 1,
                    unit_price: i.amount,
                    total: i.amount
                })),
                subtotal: order.amount,
                delivery_fee: 0,
                total: order.amount,
                delivery_address: 'Digital Delivery',
                created_at: order.createdAt.toISOString(),
                updated_at: order.updatedAt.toISOString(),
                payment_method: metadata.paymentMethod || 'Wallet',
                meter_id: (_a = items[0]) === null || _a === void 0 ? void 0 : _a.meterNumber // Attempt to grab meter number
            };
        });
        // Merge and sort
        const allOrders = [...normalizedSales, ...normalizedOthers].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        res.json({ orders: allOrders });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getMyOrders = getMyOrders;
const cancelOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user.id;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({ where: { userId } });
        if (!consumerProfile)
            return res.status(404).json({ error: 'Profile not found' });
        // Check Sales
        const sale = yield prisma_1.default.sale.findUnique({ where: { id } });
        if (sale) {
            if (sale.consumerId !== consumerProfile.id)
                return res.status(403).json({ error: 'Unauthorized' });
            if (!['pending', 'confirmed'].includes(sale.status)) {
                return res.status(400).json({ error: 'Order cannot be cancelled in current state' });
            }
            yield prisma_1.default.sale.update({
                where: { id },
                data: { status: 'cancelled' } // In real world, would add reason to a notes field
            });
            return res.json({ success: true, message: 'Order cancelled' });
        }
        // Check CustomerOrders
        const order = yield prisma_1.default.customerOrder.findUnique({ where: { id } });
        if (order) {
            if (order.consumerId !== consumerProfile.id)
                return res.status(403).json({ error: 'Unauthorized' });
            if (!['pending', 'active'].includes(order.status)) {
                return res.status(400).json({ error: 'Order cannot be cancelled' });
            }
            yield prisma_1.default.customerOrder.update({
                where: { id },
                data: { status: 'cancelled' }
            });
            return res.json({ success: true, message: 'Order cancelled' });
        }
        res.status(404).json({ error: 'Order not found' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.cancelOrder = cancelOrder;
const confirmDelivery = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({ where: { userId } });
        if (!consumerProfile)
            return res.status(404).json({ error: 'Profile not found' });
        // Only Sales typically have delivery
        const sale = yield prisma_1.default.sale.findUnique({ where: { id } });
        if (!sale)
            return res.status(404).json({ error: 'Order not found' });
        if (sale.consumerId !== consumerProfile.id)
            return res.status(403).json({ error: 'Unauthorized' });
        yield prisma_1.default.sale.update({
            where: { id },
            data: { status: 'delivered' }
        });
        res.json({ success: true, message: 'Delivery confirmed' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.confirmDelivery = confirmDelivery;
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
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!consumerProfile) {
            return res.status(404).json({ error: 'Consumer profile not found' });
        }
        // Simple eligibility logic: verified users with some orders get better eligibility
        const eligible = consumerProfile.isVerified;
        const creditScore = eligible ? 80 : 50;
        const maxAmount = eligible ? 50000 : 5000;
        res.json({ eligible, credit_score: creditScore, max_eligible_amount: maxAmount });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.checkLoanEligibility = checkLoanEligibility;
// Apply for loan
const applyForLoan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { loan_product_id, amount, purpose } = req.body;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!consumerProfile) {
            return res.status(404).json({ error: 'Consumer profile not found' });
        }
        if (amount > 50000) {
            return res.status(400).json({ error: 'Amount exceeds maximum limit' });
        }
        const result = yield prisma_1.default.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
            // 1. Create loan record (Auto-approved for demo)
            const loan = yield prisma.loan.create({
                data: {
                    consumerId: consumerProfile.id,
                    amount,
                    status: 'approved',
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }
            });
            // 2. Get or Create Credit Wallet
            let creditWallet = yield prisma.wallet.findFirst({
                where: { consumerId: consumerProfile.id, type: 'credit_wallet' }
            });
            if (!creditWallet) {
                creditWallet = yield prisma.wallet.create({
                    data: {
                        consumerId: consumerProfile.id,
                        type: 'credit_wallet',
                        balance: 0,
                        currency: 'RWF'
                    }
                });
            }
            // 3. Add to Credit Wallet Balance (Limit)
            yield prisma.wallet.update({
                where: { id: creditWallet.id },
                data: { balance: { increment: amount } }
            });
            // 4. Create Transaction
            yield prisma.walletTransaction.create({
                data: {
                    walletId: creditWallet.id,
                    type: 'loan_disbursement',
                    amount: amount,
                    description: `Loan Approved (${purpose || 'Cash Loan'})`,
                    status: 'completed',
                    reference: loan.id
                }
            });
            return loan;
        }));
        res.json({ success: true, loan: result, message: 'Loan approved and credited successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.applyForLoan = applyForLoan;
// Repay loan
const repayLoan = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { amount, payment_method } = req.body;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!consumerProfile)
            return res.status(404).json({ error: 'Profile not found' });
        yield prisma_1.default.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
            const loan = yield prisma.loan.findUnique({ where: { id } });
            if (!loan)
                throw new Error('Loan not found');
            // 1. Handle Wallet Payment
            if (payment_method === 'wallet') {
                const dashboardWallet = yield prisma.wallet.findFirst({
                    where: { consumerId: consumerProfile.id, type: 'dashboard_wallet' }
                });
                if (!dashboardWallet || dashboardWallet.balance < amount) {
                    throw new Error('Insufficient dashboard wallet balance');
                }
                // Deduct from Dashboard
                yield prisma.wallet.update({
                    where: { id: dashboardWallet.id },
                    data: { balance: { decrement: amount } }
                });
                yield prisma.walletTransaction.create({
                    data: {
                        walletId: dashboardWallet.id,
                        type: 'debit',
                        amount: -amount,
                        description: `Loan Repayment`,
                        status: 'completed',
                        reference: loan.id
                    }
                });
            }
            // 3. Add amount back to 'credit_wallet' (replenish limit)
            const creditWallet = yield prisma.wallet.findFirst({
                where: { consumerId: consumerProfile.id, type: 'credit_wallet' }
            });
            if (creditWallet) { // Only replenish if credit wallet exists
                yield prisma.wallet.update({
                    where: { id: creditWallet.id },
                    data: { balance: { increment: amount } }
                });
                // 4. Add repayment transaction to credit wallet
                yield prisma.walletTransaction.create({
                    data: {
                        walletId: creditWallet.id,
                        type: 'loan_repayment_replenish',
                        amount: amount,
                        description: `Loan Repayment Replenishment for Loan ID: ${loan.id}`,
                        status: 'completed',
                        reference: loan.id
                    }
                });
            }
            // 5. Check if fully paid
            const allRepayments = yield prisma.walletTransaction.findMany({
                where: { reference: loan.id, type: 'loan_repayment_replenish' }
            });
            const totalPaid = allRepayments.reduce((sum, t) => sum + t.amount, 0) + amount; // existing + current
            if (totalPaid >= loan.amount) {
                yield prisma.loan.update({
                    where: { id },
                    data: { status: 'repaid' }
                });
            }
        }));
        res.json({ success: true, message: 'Loan repayment successful' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.repayLoan = repayLoan;
const getActiveLoanLedger = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!consumerProfile)
            return res.status(404).json({ error: 'Profile not found' });
        // Find active loan (status approved or active)
        const loan = yield prisma_1.default.loan.findFirst({
            where: {
                consumerId: consumerProfile.id,
                status: { in: ['approved', 'active'] }
            },
            orderBy: { createdAt: 'desc' }
        });
        if (!loan) {
            return res.json({ loan: null });
        }
        // Calculate details
        const repayments = yield prisma_1.default.walletTransaction.findMany({
            where: { reference: loan.id, type: 'loan_repayment_replenish' }
        });
        const paidAmount = repayments.reduce((sum, t) => sum + t.amount, 0);
        const totalAmount = loan.amount; // Assuming 0 interest for now based on schema
        const interestRate = 0; // Fixed for now
        const outstandingBalance = Math.max(0, totalAmount - paidAmount);
        // Generate Schedule (Synthetic 4 weeks)
        const schedule = [];
        const weeks = 4;
        const weeklyAmount = totalAmount / weeks;
        let runningPaid = paidAmount;
        for (let i = 1; i <= weeks; i++) {
            const dueDate = new Date(loan.createdAt);
            dueDate.setDate(dueDate.getDate() + (i * 7));
            let status = 'upcoming';
            let paidDate = undefined;
            if (runningPaid >= weeklyAmount) {
                status = 'paid';
                runningPaid -= weeklyAmount;
                // Approximate paid date as the latest transaction
                paidDate = repayments.length > 0 ? repayments[repayments.length - 1].createdAt.toISOString() : undefined;
            }
            else if (runningPaid > 0) {
                // Partially paid, we'll mark as upcoming but logic could be complex. 
                // For simple visualization, if the bucket isn't full, it's upcoming/overdue.
                status = new Date() > dueDate ? 'overdue' : 'upcoming';
                runningPaid = 0; // Consumed rest
            }
            else {
                status = new Date() > dueDate ? 'overdue' : 'upcoming';
            }
            schedule.push({
                id: `${loan.id}-sch-${i}`,
                payment_number: i,
                due_date: dueDate.toISOString(),
                amount: weeklyAmount,
                status: status,
                paid_date: paidDate
            });
        }
        const nextPayment = schedule.find(s => s.status !== 'paid');
        const loanDetails = {
            id: loan.id,
            loan_number: `LOAN-${loan.createdAt.getFullYear()}-${loan.id.substring(0, 4).toUpperCase()}`,
            amount: loan.amount,
            disbursed_date: loan.createdAt.toISOString(),
            repayment_frequency: 'weekly',
            interest_rate: interestRate,
            total_amount: totalAmount,
            outstanding_balance: outstandingBalance,
            paid_amount: paidAmount,
            next_payment_date: (nextPayment === null || nextPayment === void 0 ? void 0 : nextPayment.due_date) || ((_a = loan.dueDate) === null || _a === void 0 ? void 0 : _a.toISOString()),
            next_payment_amount: (nextPayment === null || nextPayment === void 0 ? void 0 : nextPayment.amount) || 0,
            status: loan.status === 'approved' ? 'active' : loan.status,
            payment_schedule: schedule
        };
        res.json({ loan: loanDetails });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getActiveLoanLedger = getActiveLoanLedger;
const getCreditTransactions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId: req.user.id }
        });
        if (!consumerProfile)
            return res.status(404).json({ error: 'Profile not found' });
        const wallets = yield prisma_1.default.wallet.findMany({
            where: { consumerId: consumerProfile.id }
        });
        const walletIds = wallets.map(w => w.id);
        const transactions = yield prisma_1.default.walletTransaction.findMany({
            where: {
                walletId: { in: walletIds },
                // Filter for specific types relevant to credit history
                type: { in: ['loan_disbursement', 'purchase', 'debit', 'loan_repayment_replenish'] }
            },
            orderBy: { createdAt: 'desc' }
        });
        const mappedTransactions = transactions.map(t => {
            var _a;
            let type = 'card_order';
            let paymentMethod = undefined;
            if (t.type === 'loan_disbursement') {
                type = 'loan_given';
            }
            else if (t.type === 'purchase') {
                type = 'card_order';
                paymentMethod = 'Wallet';
            }
            else if (t.type === 'debit' && ((_a = t.description) === null || _a === void 0 ? void 0 : _a.includes('Loan Repayment'))) {
                type = 'payment_made';
                paymentMethod = 'Wallet';
            }
            else if (t.type === 'loan_repayment_replenish') {
                // duplicate of debit but on credit wallet side. 
                // We might want to filter this out if we already capture the Debit on dashboard wallet,
                // OR if we want to show the specific credit ledger effect. Only show if we didn't show the debit?
                // For simplicity, let's treat it as payment_made on the credit ledger
                type = 'payment_made';
            }
            else {
                return null; // Don't include generic debits not related to loans
            }
            return {
                id: t.id,
                type,
                amount: Math.abs(t.amount),
                date: t.createdAt.toISOString(),
                description: t.description || 'Transaction',
                reference_number: t.reference || t.id.substring(0, 8).toUpperCase(),
                shop_name: t.type === 'purchase' ? 'Retailer' : undefined, // Could fetch actual retailer if we stored retailerId in transaction
                loan_number: (t.type === 'loan_disbursement' || t.type.includes('repayment')) ? (t.reference ? `LOAN-${t.reference.substring(0, 4)}` : undefined) : undefined,
                payment_method: paymentMethod,
                status: t.status
            };
        }).filter(t => t !== null);
        res.json({ transactions: mappedTransactions });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getCreditTransactions = getCreditTransactions;
const getFoodCredit = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    res.json({ available_credit: 2500 }); // Mock for now
});
exports.getFoodCredit = getFoodCredit;
