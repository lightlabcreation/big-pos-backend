import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../utils/prisma';

// Get customer profile
export const getCustomerProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const consumerProfile = await prisma.consumerProfile.findUnique({
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
    } catch (error: any) {
        console.error('Get customer profile error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update customer profile
export const updateCustomerProfile = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { full_name, phone, email, address, landmark } = req.body;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        // Update user fields
        if (phone || email) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    ...(phone && { phone }),
                    ...(email && { email }),
                    ...(full_name && { name: full_name })
                }
            });
        }

        // Update consumer profile fields
        const updatedProfile = await prisma.consumerProfile.update({
            where: { userId },
            data: {
                ...(full_name && { fullName: full_name }),
                ...(address && { address }),
                ...(landmark && { landmark })
            },
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
    } catch (error: any) {
        console.error('Update customer profile error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Logout
export const logout = async (req: AuthRequest, res: Response) => {
    try {
        // In a real app, you might want to blacklist the token
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error: any) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get wallets
export const getWallets = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        const wallets = await prisma.wallet.findMany({
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
    } catch (error: any) {
        console.error('Get wallets error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Topup wallet
export const topupWallet = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { amount, payment_method } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid amount' });
        }

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        // Get or create dashboard wallet
        let wallet = await prisma.wallet.findFirst({
            where: { consumerId: consumerProfile.id, type: 'dashboard_wallet' }
        });

        if (!wallet) {
            wallet = await prisma.wallet.create({
                data: {
                    consumerId: consumerProfile.id,
                    type: 'dashboard_wallet',
                    balance: 0,
                    currency: 'RWF'
                }
            });
        }

        // Update wallet balance
        const updatedWallet = await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: amount } }
        });

        // Create transaction record
        await prisma.walletTransaction.create({
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
    } catch (error: any) {
        console.error('Topup wallet error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Request refund
export const requestRefund = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { amount, reason } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid amount' });
        }

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        const wallet = await prisma.wallet.findFirst({
            where: { consumerId: consumerProfile.id, type: 'dashboard_wallet' }
        });

        if (!wallet) {
            return res.status(404).json({ success: false, error: 'Wallet not found' });
        }

        if (wallet.balance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient balance' });
        }

        // Create pending refund transaction
        const transaction = await prisma.walletTransaction.create({
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
    } catch (error: any) {
        console.error('Request refund error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get wallet transactions
export const getWalletTransactions = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { limit = 20, offset = 0 } = req.query;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        const wallets = await prisma.wallet.findMany({
            where: { consumerId: consumerProfile.id }
        });

        const walletIds = wallets.map(w => w.id);

        const transactions = await prisma.walletTransaction.findMany({
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
    } catch (error: any) {
        console.error('Get wallet transactions error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get profile stats (total orders, wallet balance, gas rewards)
export const getProfileStats = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        // Get total orders count
        const totalOrders = await prisma.customerOrder.count({
            where: { consumerId: consumerProfile.id }
        });

        // Get wallet balances
        const wallets = await prisma.wallet.findMany({
            where: { consumerId: consumerProfile.id }
        });
        const walletBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);

        // Get gas rewards total
        const gasRewards = await prisma.gasReward.findMany({
            where: { consumerId: consumerProfile.id }
        });
        const totalGasRewards = gasRewards.reduce((sum, reward) => sum + reward.units, 0);

        res.json({
            success: true,
            data: {
                total_orders: totalOrders,
                wallet_balance: walletBalance,
                gas_rewards: totalGasRewards
            }
        });
    } catch (error: any) {
        console.error('Get profile stats error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get recent activity
export const getRecentActivity = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        // Get recent orders
        const recentOrders = await prisma.customerOrder.findMany({
            where: { consumerId: consumerProfile.id },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        // Get recent wallet transactions
        const wallets = await prisma.wallet.findMany({
            where: { consumerId: consumerProfile.id }
        });
        const walletIds = wallets.map(w => w.id);

        const recentTransactions = await prisma.walletTransaction.findMany({
            where: { walletId: { in: walletIds } },
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        // Combine and format activities
        const activities: any[] = [];

        // Add orders to activities
        recentOrders.forEach(order => {
            const timeAgo = getTimeAgo(order.createdAt);
            activities.push({
                action: `${order.orderType === 'gas' ? 'Gas topup' : 'Shop'} order #${order.id.substring(0, 8)}`,
                time: timeAgo,
                type: 'order',
                created_at: order.createdAt
            });
        });

        // Add transactions to activities
        recentTransactions.forEach(txn => {
            const timeAgo = getTimeAgo(txn.createdAt);
            activities.push({
                action: txn.description || `${txn.type} ${txn.amount} RWF`,
                time: timeAgo,
                type: 'wallet',
                created_at: txn.createdAt
            });
        });

        // Sort by date and take top 10
        activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const topActivities = activities.slice(0, 10);

        res.json({
            success: true,
            data: topActivities
        });
    } catch (error: any) {
        console.error('Get recent activity error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get notification preferences
export const getNotificationPreferences = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId },
            include: { settings: true }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        // Create default settings if none exist
        let settings = (consumerProfile as any).settings;
        if (!settings) {
            settings = await (prisma as any).consumerSettings.create({
                data: {
                    consumerId: consumerProfile.id,
                    pushNotifications: true,
                    emailNotifications: true,
                    smsNotifications: false
                }
            });
        }

        res.json({
            success: true,
            data: {
                push_notifications: settings.pushNotifications,
                email_notifications: settings.emailNotifications,
                sms_notifications: settings.smsNotifications
            }
        });
    } catch (error: any) {
        console.error('Get notification preferences error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update notification preferences
export const updateNotificationPreferences = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { push_notifications, email_notifications, sms_notifications } = req.body;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId },
            include: { settings: true }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        let settings;
        const updateData: any = {};
        if (push_notifications !== undefined) updateData.pushNotifications = push_notifications;
        if (email_notifications !== undefined) updateData.emailNotifications = email_notifications;
        if (sms_notifications !== undefined) updateData.smsNotifications = sms_notifications;

        if ((consumerProfile as any).settings) {
            // Update existing settings
            settings = await (prisma as any).consumerSettings.update({
                where: { id: (consumerProfile as any).settings.id },
                data: updateData
            });
        } else {
            // Create new settings
            settings = await (prisma as any).consumerSettings.create({
                data: {
                    consumerId: consumerProfile.id,
                    ...updateData
                }
            });
        }

        res.json({
            success: true,
            data: {
                push_notifications: settings.pushNotifications,
                email_notifications: settings.emailNotifications,
                sms_notifications: settings.smsNotifications
            },
            message: 'Preferences updated successfully'
        });
    } catch (error: any) {
        console.error('Update notification preferences error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Helper function to calculate time ago
function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffMs / 604800000);

    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return `${diffWeeks} week${diffWeeks !== 1 ? 's' : ''} ago`;
}

// Get referral code
export const getReferralCode = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, phone: true }
        });

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Generate referral code from user ID (deterministic)
        // Format: BIG + last 6 chars of user ID in uppercase
        const referralCode = 'BIG' + user.id.slice(-6).toUpperCase();

        res.json({
            success: true,
            data: {
                referral_code: referralCode
            }
        });
    } catch (error: any) {
        console.error('Get referral code error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Redeem gas rewards
export const redeemGasRewards = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { points } = req.body;

        if (!points || points < 100) {
            return res.status(400).json({ success: false, error: 'Minimum 100 points required to redeem' });
        }

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        // Convert points to m³ (100 points = 1 m³)
        const unitsToRedeem = points / 100;

        // Get total available gas rewards
        const rewards = await prisma.gasReward.findMany({
            where: { consumerId: consumerProfile.id }
        });

        const totalUnits = rewards.reduce((sum, r) => sum + r.units, 0);

        if (totalUnits < unitsToRedeem) {
            return res.status(400).json({
                success: false,
                error: 'Insufficient gas rewards',
                available: totalUnits * 100
            });
        }

        // Conversion rate: 1 M³ = 1000 RWF
        const walletCredit = unitsToRedeem * 1000;

        // Get or create dashboard wallet
        let wallet = await prisma.wallet.findFirst({
            where: {
                consumerId: consumerProfile.id,
                type: 'dashboard_wallet'
            }
        });

        if (!wallet) {
            wallet = await prisma.wallet.create({
                data: {
                    consumerId: consumerProfile.id,
                    type: 'dashboard_wallet',
                    balance: 0,
                    currency: 'RWF'
                }
            });
        }

        // Credit wallet
        await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: walletCredit } }
        });

        // Create wallet transaction record
        await prisma.walletTransaction.create({
            data: {
                walletId: wallet.id,
                type: 'credit',
                amount: walletCredit,
                description: `Redeemed ${unitsToRedeem.toFixed(2)} M³ gas rewards`,
                status: 'completed'
            }
        });

        // Deduct gas rewards (create negative reward entry)
        await prisma.gasReward.create({
            data: {
                consumerId: consumerProfile.id,
                units: -unitsToRedeem,
                source: 'redemption',
                reference: `Redeemed for ${walletCredit} RWF wallet credit`
            }
        });

        res.json({
            success: true,
            data: {
                points_redeemed: points,
                units_redeemed: unitsToRedeem,
                wallet_credit: walletCredit,
                new_balance: totalUnits - unitsToRedeem
            },
            message: `Successfully redeemed ${points} points for ${walletCredit.toLocaleString()} RWF wallet credit`
        });
    } catch (error: any) {
        console.error('Redeem gas rewards error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};
