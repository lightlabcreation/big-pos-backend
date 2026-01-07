import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../utils/prisma';

// Get gas meters
export const getGasMeters = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        const meters = await prisma.gasMeter.findMany({
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
    } catch (error: any) {
        console.error('Get gas meters error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Add gas meter
export const addGasMeter = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { meter_number, alias_name, owner_name, owner_phone } = req.body;

        if (!meter_number) {
            return res.status(400).json({ success: false, error: 'Meter number is required' });
        }

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        // Check if meter already exists
        const existingMeter = await prisma.gasMeter.findUnique({
            where: { meterNumber: meter_number }
        });

        if (existingMeter) {
            return res.status(400).json({ success: false, error: 'Meter number already registered' });
        }

        const meter = await prisma.gasMeter.create({
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
    } catch (error: any) {
        console.error('Add gas meter error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Remove gas meter
export const removeGasMeter = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        const meter = await prisma.gasMeter.findUnique({
            where: { id }
        });

        if (!meter || meter.consumerId !== consumerProfile.id) {
            return res.status(404).json({ success: false, error: 'Gas meter not found' });
        }

        // Soft delete
        await prisma.gasMeter.update({
            where: { id },
            data: { status: 'removed' }
        });

        res.json({
            success: true,
            message: 'Gas meter removed successfully'
        });
    } catch (error: any) {
        console.error('Remove gas meter error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Topup gas
export const topupGas = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { meter_number, amount, payment_method } = req.body;

        if (!meter_number || !amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid request data' });
        }

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        const meter = await prisma.gasMeter.findFirst({
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
        const wallet = await prisma.wallet.findFirst({
            where: { consumerId: consumerProfile.id, type: 'dashboard_wallet' }
        });

        if (!wallet || wallet.balance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient wallet balance' });
        }

        // Calculate units (assuming 1000 RWF = 1.1 m3)
        const units = (amount / 1000) * 1.1;

        // Create topup record
        const topup = await prisma.gasTopup.create({
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
        const order = await prisma.customerOrder.create({
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
        await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: amount } }
        });

        // Create wallet transaction
        await prisma.walletTransaction.create({
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
        await prisma.gasReward.create({
            data: {
                consumerId: consumerProfile.id,
                units: rewardUnits,
                source: 'purchase',
                reference: order.id
            }
        });

        res.json({
            success: true,
            data: {
                topup_id: topup.id,
                order_id: order.id,
                meter_number,
                amount,
                units,
                reward_units: rewardUnits,
                new_wallet_balance: wallet.balance - amount
            },
            message: 'Gas topup successful'
        });
    } catch (error: any) {
        console.error('Topup gas error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get gas usage
export const getGasUsage = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { meter_id } = req.query;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        const where: any = { consumerId: consumerProfile.id };
        if (meter_id) {
            where.meterId = meter_id as string;
        }

        const topups = await prisma.gasTopup.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                meter: {
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
                meter_number: t.meter.meterNumber,
                meter_alias: t.meter.aliasName,
                amount: t.amount,
                units: t.units,
                currency: t.currency,
                status: t.status,
                created_at: t.createdAt
            }))
        });
    } catch (error: any) {
        console.error('Get gas usage error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get gas rewards balance
export const getGasRewardsBalance = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        const rewards = await prisma.gasReward.findMany({
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
    } catch (error: any) {
        console.error('Get gas rewards balance error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get gas rewards history
export const getGasRewardsHistory = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { limit = 20 } = req.query;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        const rewards = await prisma.gasReward.findMany({
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
    } catch (error: any) {
        console.error('Get gas rewards history error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get gas rewards leaderboard
export const getGasRewardsLeaderboard = async (req: AuthRequest, res: Response) => {
    try {
        const { period = 'month' } = req.query;

        // Calculate date filter based on period
        let dateFilter: Date | undefined;
        const now = new Date();

        if (period === 'week') {
            dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (period === 'month') {
            dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        // Get all rewards with filter
        const rewards = await prisma.gasReward.findMany({
            where: dateFilter ? { createdAt: { gte: dateFilter } } : {},
            include: {
                consumer: {
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
        const leaderboard = rewards.reduce((acc: any[], reward) => {
            const existing = acc.find(item => item.consumerId === reward.consumerId);
            if (existing) {
                existing.total_units += reward.units;
            } else {
                acc.push({
                    consumerId: reward.consumerId,
                    customer_name: reward.consumer.user.name || 'Anonymous',
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
    } catch (error: any) {
        console.error('Get gas rewards leaderboard error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get customer orders
export const getCustomerOrders = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { limit = 20, offset = 0 } = req.query;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        const orders = await prisma.customerOrder.findMany({
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
    } catch (error: any) {
        console.error('Get customer orders error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get order details
export const getOrderDetails = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        const order = await prisma.customerOrder.findFirst({
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
    } catch (error: any) {
        console.error('Get order details error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
