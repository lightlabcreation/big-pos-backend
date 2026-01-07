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
