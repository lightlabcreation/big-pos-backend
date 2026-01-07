import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../utils/prisma';

// Get retailers
export const getRetailers = async (req: AuthRequest, res: Response) => {
  try {
    const retailers = await prisma.retailerProfile.findMany({
      include: { user: true }
    });
    res.json({ retailers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get categories
export const getCategories = async (req: AuthRequest, res: Response) => {
  try {
    const products = await prisma.product.findMany({ select: { category: true }, distinct: ['category'] });
    const categories = products.map(p => ({ name: p.category, id: p.category }));
    res.json({ categories });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get products
export const getProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { retailerId, category, search } = req.query;
    const where: any = {};
    
    if (retailerId) where.retailerId = retailerId as string;
    if (category) where.category = category as string;
    if (search) where.name = { contains: search as string };

    const products = await prisma.product.findMany({ where });
    res.json({ products });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get customer orders
export const getMyOrders = async (req: AuthRequest, res: Response) => {
  try {
    const consumerProfile = await prisma.consumerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!consumerProfile) {
      return res.status(404).json({ error: 'Consumer profile not found' });
    }

    const orders = await prisma.sale.findMany({
      where: { consumerId: consumerProfile.id },
      include: { items: { include: { product: true } }, retailer: true }
    });

    res.json({ orders });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get wallet balance
export const getWalletBalance = async (req: AuthRequest, res: Response) => {
  try {
    const consumerProfile = await prisma.consumerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!consumerProfile) {
      return res.status(404).json({ error: 'Consumer profile not found' });
    }

    res.json({
      balance: consumerProfile.walletBalance,
      currency: 'RWF'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get rewards balance
export const getRewardsBalance = async (req: AuthRequest, res: Response) => {
  try {
    const consumerProfile = await prisma.consumerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!consumerProfile) {
      return res.status(404).json({ error: 'Consumer profile not found' });
    }

    res.json({
      points: consumerProfile.rewardsPoints,
      tier: 'Bronze'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get loans
export const getLoans = async (req: AuthRequest, res: Response) => {
  try {
    const consumerProfile = await prisma.consumerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!consumerProfile) {
      return res.status(404).json({ error: 'Consumer profile not found' });
    }

    const loans = await prisma.loan.findMany({
      where: { consumerId: consumerProfile.id }
    });

    const totalOutstanding = loans
      .filter(l => l.status === 'active')
      .reduce((sum, l) => sum + l.amount, 0);

    res.json({ loans, summary: { total_outstanding: totalOutstanding } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get loan products
export const getLoanProducts = async (req: AuthRequest, res: Response) => {
  try {
    const products = [
      { id: 'lp_1', name: 'Emergency Food Loan', min_amount: 1000, max_amount: 5000, interest_rate: 0, term_days: 7, loan_type: 'food' },
      { id: 'lp_2', name: 'Personal Cash Loan', min_amount: 5000, max_amount: 20000, interest_rate: 0.1, term_days: 30, loan_type: 'cash' }
    ];
    res.json({ products });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Check loan eligibility
export const checkLoanEligibility = async (req: AuthRequest, res: Response) => {
  try {
    res.json({ eligible: true, credit_score: 65, max_eligible_amount: 15000 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
