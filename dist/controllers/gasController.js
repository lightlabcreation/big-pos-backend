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
exports.getOrderDetails = exports.getCustomerOrders = exports.getGasRewardsLeaderboard = exports.getGasRewardsHistory = exports.getGasRewardsBalance = exports.getGasUsage = exports.topupGas = exports.removeGasMeter = exports.addGasMeter = exports.getGasMeters = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
// Get gas meters
const getGasMeters = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        const meters = yield prisma_1.default.gasMeter.findMany({
            where: {
                consumerId: consumerProfile.id,
                status: { not: 'removed' }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({
            success: true,
            data: meters.map(m => ({
                id: m.id,
                meter_number: m.meterNumber,
                alias_name: m.aliasName,
                owner_name: m.ownerName,
                owner_phone: m.ownerPhone,
                status: m.status,
                created_at: m.createdAt
            }))
        });
    }
    catch (error) {
        console.error('Get gas meters error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.getGasMeters = getGasMeters;
// Add gas meter
const addGasMeter = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { meter_number, alias_name, owner_name, owner_phone } = req.body;
        if (!meter_number) {
            return res.status(400).json({ success: false, error: 'Meter number is required' });
        }
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        // Check if meter already exists
        const existingMeter = yield prisma_1.default.gasMeter.findUnique({
            where: { meterNumber: meter_number }
        });
        if (existingMeter) {
            return res.status(400).json({ success: false, error: 'Meter number already registered' });
        }
        const meter = yield prisma_1.default.gasMeter.create({
            data: {
                consumerId: consumerProfile.id,
                meterNumber: meter_number,
                aliasName: alias_name,
                ownerName: owner_name,
                ownerPhone: owner_phone,
                status: 'active'
            }
        });
        res.json({
            success: true,
            data: {
                id: meter.id,
                meter_number: meter.meterNumber,
                alias_name: meter.aliasName,
                owner_name: meter.ownerName,
                owner_phone: meter.ownerPhone,
                status: meter.status
            },
            message: 'Gas meter added successfully'
        });
    }
    catch (error) {
        console.error('Add gas meter error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.addGasMeter = addGasMeter;
// Remove gas meter
const removeGasMeter = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        const meter = yield prisma_1.default.gasMeter.findUnique({
            where: { id }
        });
        if (!meter || meter.consumerId !== consumerProfile.id) {
            return res.status(404).json({ success: false, error: 'Gas meter not found' });
        }
        // Soft delete
        yield prisma_1.default.gasMeter.update({
            where: { id },
            data: { status: 'removed' }
        });
        res.json({
            success: true,
            message: 'Gas meter removed successfully'
        });
    }
    catch (error) {
        console.error('Remove gas meter error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.removeGasMeter = removeGasMeter;
// Topup gas
const topupGas = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { meter_number, amount, payment_method } = req.body;
        if (!meter_number || !amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid request data' });
        }
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        const meter = yield prisma_1.default.gasMeter.findFirst({
            where: {
                meterNumber: meter_number,
                consumerId: consumerProfile.id,
                status: 'active'
            }
        });
        if (!meter) {
            return res.status(404).json({ success: false, error: 'Gas meter not found' });
        }
        // Get dashboard wallet
        const wallet = yield prisma_1.default.wallet.findFirst({
            where: { consumerId: consumerProfile.id, type: 'dashboard_wallet' }
        });
        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient wallet balance' });
        }
        // Calculate units (assuming 1000 RWF = 1.1 m3)
        const units = (amount / 1000) * 1.1;
        // Create topup record
        const topup = yield prisma_1.default.gasTopup.create({
            data: {
                consumerId: consumerProfile.id,
                meterId: meter.id,
                amount,
                units,
                currency: 'RWF',
                status: 'completed'
            }
        });
        // Create customer order
        const order = yield prisma_1.default.customerOrder.create({
            data: {
                consumerId: consumerProfile.id,
                orderType: 'gas',
                status: 'completed',
                amount,
                currency: 'RWF',
                items: JSON.stringify([{
                        meterNumber: meter_number,
                        units,
                        amount
                    }]),
                metadata: JSON.stringify({ paymentMethod: payment_method || 'wallet' })
            }
        });
        // Deduct from wallet
        yield prisma_1.default.wallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: amount } }
        });
        // Create wallet transaction
        yield prisma_1.default.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: 'debit',
                amount,
                description: `Gas topup for meter ${meter_number}`,
                reference: order.id,
                status: 'completed'
            }
        });
        // Award gas rewards (10% of units)
        const rewardUnits = units * 0.1;
        yield prisma_1.default.gasReward.create({
            data: {
                consumerId: consumerProfile.id,
                units: rewardUnits,
                source: 'purchase',
                reference: order.id
            }
        });
        // Generate gas meter token (16 digits formatted as XXXX-XXXX-XXXX-XXXX)
        const generateToken = () => {
            var _a;
            const digits = Math.random().toString().slice(2, 18).padEnd(16, '0');
            return ((_a = digits.match(/.{1,4}/g)) === null || _a === void 0 ? void 0 : _a.join('-')) || '0000-0000-0000-0000';
        };
        const token = generateToken();
        res.json({
            success: true,
            data: {
                topup_id: topup.id,
                order_id: order.id,
                meter_number,
                amount,
                units,
                token,
                reward_units: rewardUnits,
                new_wallet_balance: wallet.balance - amount
            },
            message: 'Gas topup successful'
        });
    }
    catch (error) {
        console.error('Topup gas error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.topupGas = topupGas;
// Get gas usage
const getGasUsage = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { meter_id } = req.query;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        const where = { consumerId: consumerProfile.id };
        if (meter_id) {
            where.meterId = meter_id;
        }
        const topups = yield prisma_1.default.gasTopup.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                gasMeter: {
                    select: {
                        meterNumber: true,
                        aliasName: true
                    }
                }
            }
        });
        res.json({
            success: true,
            data: topups.map(t => ({
                id: t.id,
                meter_number: t.gasMeter.meterNumber,
                meter_alias: t.gasMeter.aliasName,
                amount: t.amount,
                units: t.units,
                currency: t.currency,
                status: t.status,
                created_at: t.createdAt
            }))
        });
    }
    catch (error) {
        console.error('Get gas usage error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.getGasUsage = getGasUsage;
// Get gas rewards balance
const getGasRewardsBalance = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        const rewards = yield prisma_1.default.gasReward.findMany({
            where: { consumerId: consumerProfile.id }
        });
        const totalUnits = rewards.reduce((sum, r) => sum + r.units, 0);
        res.json({
            success: true,
            data: {
                total_units: totalUnits,
                currency: 'm3',
                tier: totalUnits > 100 ? 'Gold' : totalUnits > 50 ? 'Silver' : 'Bronze'
            }
        });
    }
    catch (error) {
        console.error('Get gas rewards balance error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.getGasRewardsBalance = getGasRewardsBalance;
// Get gas rewards history
const getGasRewardsHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { limit = 20 } = req.query;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        const rewards = yield prisma_1.default.gasReward.findMany({
            where: { consumerId: consumerProfile.id },
            orderBy: { createdAt: 'desc' },
            take: Number(limit)
        });
        res.json({
            success: true,
            data: rewards.map(r => ({
                id: r.id,
                units: r.units,
                source: r.source,
                reference: r.reference,
                created_at: r.createdAt
            }))
        });
    }
    catch (error) {
        console.error('Get gas rewards history error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.getGasRewardsHistory = getGasRewardsHistory;
// Get gas rewards leaderboard
const getGasRewardsLeaderboard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { period = 'month' } = req.query;
        // Calculate date filter based on period
        let dateFilter;
        const now = new Date();
        if (period === 'week') {
            dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        else if (period === 'month') {
            dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        // Get all rewards with filter
        const rewards = yield prisma_1.default.gasReward.findMany({
            where: dateFilter ? { createdAt: { gte: dateFilter } } : {},
            include: {
                consumerProfile: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                phone: true
                            }
                        }
                    }
                }
            }
        });
        // Group by consumer and sum units
        const leaderboard = rewards.reduce((acc, reward) => {
            const existing = acc.find(item => item.consumerId === reward.consumerId);
            if (existing) {
                existing.total_units += reward.units;
            }
            else {
                acc.push({
                    consumerId: reward.consumerId,
                    customer_name: reward.consumerProfile.user.name || 'Anonymous',
                    total_units: reward.units
                });
            }
            return acc;
        }, []);
        // Sort by total units and take top 10
        leaderboard.sort((a, b) => b.total_units - a.total_units);
        const top10 = leaderboard.slice(0, 10);
        res.json({
            success: true,
            data: top10.map((item, index) => ({
                rank: index + 1,
                customer_name: item.customer_name,
                total_units: item.total_units
            }))
        });
    }
    catch (error) {
        console.error('Get gas rewards leaderboard error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.getGasRewardsLeaderboard = getGasRewardsLeaderboard;
// Get customer orders
const getCustomerOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { limit = 20, offset = 0 } = req.query;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        const orders = yield prisma_1.default.customerOrder.findMany({
            where: { consumerId: consumerProfile.id },
            orderBy: { createdAt: 'desc' },
            take: Number(limit),
            skip: Number(offset)
        });
        res.json({
            success: true,
            data: orders.map(o => ({
                id: o.id,
                order_type: o.orderType,
                status: o.status,
                amount: o.amount,
                currency: o.currency,
                items: o.items,
                metadata: o.metadata,
                created_at: o.createdAt,
                updated_at: o.updatedAt
            }))
        });
    }
    catch (error) {
        console.error('Get customer orders error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.getCustomerOrders = getCustomerOrders;
// Get order details
const getOrderDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const consumerProfile = yield prisma_1.default.consumerProfile.findUnique({
            where: { userId }
        });
        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }
        const order = yield prisma_1.default.customerOrder.findFirst({
            where: {
                id,
                consumerId: consumerProfile.id
            }
        });
        if (!order) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        res.json({
            success: true,
            data: {
                id: order.id,
                order_type: order.orderType,
                status: order.status,
                amount: order.amount,
                currency: order.currency,
                items: order.items,
                metadata: order.metadata,
                created_at: order.createdAt,
                updated_at: order.updatedAt
            }
        });
    }
    catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.getOrderDetails = getOrderDetails;
