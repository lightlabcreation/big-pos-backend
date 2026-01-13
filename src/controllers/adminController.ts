import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../utils/prisma';
import { hashPassword } from '../utils/auth';

// Get detailed dashboard stats
export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now.setHours(0, 0, 0, 0));

    // 1. Customers
    const customerTotal = await prisma.consumerProfile.count();
    const customerLast24h = await prisma.consumerProfile.count({ where: { user: { createdAt: { gte: last24h } } } });
    const customerLast7d = await prisma.consumerProfile.count({ where: { user: { createdAt: { gte: last7d } } } });
    const customerLast30d = await prisma.consumerProfile.count({ where: { user: { createdAt: { gte: last30d } } } });

    // 2. Orders (Sales)
    const sales = await prisma.sale.findMany();
    const orderTotal = sales.length;
    const orderPending = sales.filter(s => s.status === 'pending').length;
    const orderProcessing = sales.filter(s => s.status === 'processing').length;
    const orderDelivered = sales.filter(s => s.status === 'completed' || s.status === 'delivered').length;
    const orderCancelled = sales.filter(s => s.status === 'cancelled').length;
    const totalRevenue = sales.reduce((acc, s) => acc + s.totalAmount, 0);
    const todayOrders = sales.filter(s => s.createdAt >= todayStart).length;

    // 3. Transactions (using WalletTransaction)
    const txs = await prisma.walletTransaction.findMany({ where: { createdAt: { gte: last30d } } });
    const txTotal = await prisma.walletTransaction.count();
    const walletTopups = txs.filter(t => t.type === 'top_up').length;
    const gasPurchases = txs.filter(t => t.type === 'gas_payment' || t.type === 'gas_purchase').length;
    const nfcPayments = sales.filter(s => s.paymentMethod === 'nfc' && s.createdAt >= last30d).length;
    const totalVolume = txs.reduce((acc, t) => acc + t.amount, 0);

    // 4. Loans
    const loans = await prisma.loan.findMany();
    const loanTotal = loans.length;
    const loanPending = loans.filter(l => l.status === 'pending').length;
    const loanActive = loans.filter(l => l.status === 'active' || l.status === 'approved').length;
    const loanPaid = loans.filter(l => l.status === 'paid' || l.status === 'repaid').length;
    const loanDefaulted = loans.filter(l => l.status === 'defaulted' || l.status === 'overdue').length;
    const outstandingAmount = loans.reduce((acc, l) => l.status === 'active' ? acc + l.amount : acc, 0);

    // 5. Gas (using GasTopup or Sale with gas category)
    const gasTopups = await prisma.gasTopup.findMany();
    const gasTotalPurchases = gasTopups.length;
    const gasTotalAmount = gasTopups.reduce((acc, g) => acc + g.amount, 0);
    const gasTotalUnits = gasTopups.reduce((acc, g) => acc + g.units, 0);

    // 6. NFC Cards
    const nfcTotal = await prisma.nfcCard.count();
    const nfcActive = await prisma.nfcCard.count({ where: { status: 'active' } });
    const nfcLinked = await prisma.nfcCard.count({ where: { consumerId: { not: null } } });

    // 7. Retailers & Wholesalers
    const retailerTotal = await prisma.retailerProfile.count();
    const retailerActive = await prisma.user.count({ where: { role: 'retailer', isActive: true } });
    const retailerVerified = await prisma.retailerProfile.count({ where: { isVerified: true } });
    const wholesalerTotal = await prisma.wholesalerProfile.count();
    const wholesalerActive = await prisma.user.count({ where: { role: 'wholesaler', isActive: true } });

    // Recent Activity - Merge Sales, New Customers, and Loans
    const [recentSales, recentConsumers, recentLoans] = await Promise.all([
      prisma.sale.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          retailerProfile: { select: { shopName: true } },
          consumerProfile: { select: { fullName: true } }
        }
      }),
      prisma.consumerProfile.findMany({
        take: 5,
        orderBy: { user: { createdAt: 'desc' } },
        include: { user: true }
      }),
      prisma.loan.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { consumerProfile: true }
      })
    ]);

    const activities: any[] = [
      ...recentSales.map(s => ({
        id: `sale-${s.id}`,
        action: 'order_placed',
        entity_type: 'order',
        description: `Order of ${s.totalAmount} RWF by ${s.consumerProfile?.fullName || 'Customer'}`,
        created_at: s.createdAt
      })),
      ...recentConsumers.map(c => ({
        id: `cust-${c.id}`,
        action: 'new_customer',
        entity_type: 'customer',
        description: `New customer ${c.fullName || c.user.name} joined`,
        created_at: c.user.createdAt
      })),
      ...recentLoans.map(l => ({
        id: `loan-${l.id}`,
        action: l.status === 'approved' ? 'loan_approved' : 'loan_requested',
        entity_type: 'loan',
        description: `Loan of ${l.amount} RWF ${l.status}`,
        created_at: l.createdAt
      }))
    ];

    const recentActivity = activities
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    const dashboard = {
      customers: { total: customerTotal, last24h: customerLast24h, last7d: customerLast7d, last30d: customerLast30d },
      orders: { 
        total: orderTotal, 
        pending: orderPending, 
        processing: orderProcessing, 
        delivered: orderDelivered, 
        cancelled: orderCancelled, 
        totalRevenue,
        todayOrders
      },
      transactions: {
        total: txTotal,
        walletTopups,
        gasPurchases,
        nfcPayments,
        loanDisbursements: loanActive, // Approximate
        totalVolume
      },
      loans: {
        total: loanTotal,
        pending: loanPending,
        active: loanActive,
        paid: loanPaid,
        defaulted: loanDefaulted,
        outstandingAmount
      },
      gas: { totalPurchases: gasTotalPurchases, totalAmount: gasTotalAmount, totalUnits: gasTotalUnits },
      nfcCards: { total: nfcTotal, active: nfcActive, linked: nfcLinked },
      retailers: { total: retailerTotal, active: retailerActive, verified: retailerVerified },
      wholesalers: { total: wholesalerTotal, active: wholesalerActive },
      recentActivity
    };

    res.json({
      success: true,
      dashboard
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getReports = async (req: AuthRequest, res: Response) => {
  try {
    const { dateRange } = req.query;
    const now = new Date();
    let startDate = new Date(0); // All time default

    if (dateRange === 'today') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (dateRange === '7days') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === '30days') {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (dateRange === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    // 1. Stats based on date range
    const [sales, gasTopups] = await Promise.all([
      prisma.sale.findMany({ where: { createdAt: { gte: startDate } } }),
      prisma.gasTopup.findMany({ where: { createdAt: { gte: startDate } } })
    ]);

    const totalRevenue = sales.reduce((acc, s) => acc + s.totalAmount, 0);
    const orderTotal = sales.length;
    const gasDistributed = gasTopups.reduce((acc, g) => acc + g.units, 0);

    // 2. Global counts
    const [retailerTotal, wholesalerTotal, productTotal, customerTotal, loans] = await Promise.all([
      prisma.retailerProfile.count(),
      prisma.wholesalerProfile.count(),
      prisma.product.count(),
      prisma.consumerProfile.count(),
      prisma.loan.findMany()
    ]);

    const activeLoans = loans.filter(l => l.status === 'active' || l.status === 'approved').length;
    const pendingLoans = loans.filter(l => l.status === 'pending').length;
    const totalLoanAmount = loans.reduce((acc, l) => (l.status === 'active' || l.status === 'approved') ? acc + l.amount : acc, 0);

    // 3. Growth rate (Simple mock for now, or compare with previous period if data exists)
    const growthRate = 12.5; 

    res.json({
      success: true,
      summary: {
        totalRevenue,
        orderTotal,
        retailerTotal,
        wholesalerTotal,
        gasDistributed,
        growthRate,
        businessOverview: {
          totalProducts: productTotal,
          totalCustomers: customerTotal,
          totalSalesVolume: orderTotal, // Assuming volume means count here, or we could use total items
          avgOrderValue: orderTotal > 0 ? Math.round(totalRevenue / orderTotal) : 0
        },
        loanOverview: {
          activeLoans,
          totalLoanAmount,
          pendingApprovals: pendingLoans
        },
        targets: {
          orders: 5000,
          retailers: 200,
          gas: 2000
        }
      }
    });
  } catch (error: any) {
    console.error('Get Reports Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get customers
export const getCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const customers = await prisma.consumerProfile.findMany({
      include: { user: true }
    });
    res.json({ success: true, customers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const customer = await prisma.consumerProfile.findUnique({
      where: { id: Number(id) },
      include: {
        user: true,
        wallets: true,
        nfcCards: true
      }
    });

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, customer });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getRetailers = async (req: AuthRequest, res: Response) => {
  try {
    const retailers = await prisma.retailerProfile.findMany({
      include: { user: true }
    });
    res.json({ success: true, retailers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create retailer
export const createRetailer = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, business_name, phone, address, credit_limit } = req.body;

    if (!email || !password || !business_name || !phone) {
      return res.status(400).json({ error: 'Missing required fields: email, password, business_name, and phone are required' });
    }

    const existingEmail = await prisma.user.findFirst({ where: { email } });
    if (existingEmail) return res.status(400).json({ error: `Retailer with email ${email} already exists` });

    const existingPhone = await prisma.user.findFirst({ where: { phone } });
    if (existingPhone) return res.status(400).json({ error: `Retailer with phone ${phone} already exists` });

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        role: 'retailer',
        name: business_name,
        isActive: true // Default to active?
      }
    });

    await prisma.retailerProfile.create({
      data: {
        userId: user.id,
        shopName: business_name,
        address,
        creditLimit: credit_limit || 0
      }
    });

    res.json({ success: true, message: 'Retailer created successfully' });
  } catch (error: any) {
    console.error('Create Retailer Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get wholesalers
export const getWholesalers = async (req: AuthRequest, res: Response) => {
  try {
    const wholesalers = await prisma.wholesalerProfile.findMany({
      include: { user: true }
    });
    res.json({ success: true, wholesalers });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create wholesaler
export const createWholesaler = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, company_name, phone, address } = req.body;

    if (!email || !password || !company_name || !phone) {
      return res.status(400).json({ error: 'Missing required fields: email, password, company_name, and phone are required' });
    }

    const existingEmail = await prisma.user.findFirst({ where: { email } });
    if (existingEmail) return res.status(400).json({ error: `Wholesaler with email ${email} already exists` });

    const existingPhone = await prisma.user.findFirst({ where: { phone } });
    if (existingPhone) return res.status(400).json({ error: `Wholesaler with phone ${phone} already exists` });

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        role: 'wholesaler',
        name: company_name,
        isActive: true
      }
    });

    await prisma.wholesalerProfile.create({
      data: {
        userId: user.id,
        companyName: company_name,
        address
      }
    });

    res.json({ success: true, message: 'Wholesaler created successfully' });
  } catch (error: any) {
    console.error('Create Wholesaler Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get loans
export const getLoans = async (req: AuthRequest, res: Response) => {
  try {
    const loans = await prisma.loan.findMany({
      include: {
        consumerProfile: {
          include: {
            user: true,
            wallets: true // Include wallets to access transactions
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate payment progress for each loan
    const formattedLoans = await Promise.all(loans.map(async (loan) => {
      // Get all repayment transactions for this loan
      // Check both 'loan_repayment_replenish' (dashboard wallet payments) 
      // and 'debit' from credit_wallet (credit wallet payments)
      const repaymentTransactions = await prisma.walletTransaction.findMany({
        where: {
          reference: loan.id.toString(),
          OR: [
            { type: 'loan_repayment_replenish' },
            { 
              type: 'debit',
              description: { contains: 'Loan Repayment' }
            }
          ]
        }
      });

      // Calculate total amount paid
      const amountPaid = repaymentTransactions.reduce((sum, txn) => {
        // For 'loan_repayment_replenish', amount is positive
        // For 'debit', amount is negative, so we need absolute value
        return sum + Math.abs(txn.amount);
      }, 0);

      const totalRepayable = loan.amount; // Simplified: no interest for now
      const amountRemaining = Math.max(0, totalRepayable - amountPaid);

      // Update loan status if fully paid
      let loanStatus = loan.status;
      if (amountPaid >= totalRepayable && loan.status !== 'repaid') {
        await prisma.loan.update({
          where: { id: loan.id },
          data: { status: 'repaid' }
        });
        loanStatus = 'repaid';
      }

      return {
        id: loan.id,
        user_id: loan.consumerProfile?.userId,
        user_name: loan.consumerProfile?.fullName || loan.consumerProfile?.user?.name || 'Unknown',
        user_type: 'consumer',
        amount: loan.amount,
        interest_rate: 5,
        duration_months: 1,
        monthly_payment: loan.amount,
        total_repayable: totalRepayable,
        amount_paid: amountPaid,
        amount_remaining: amountRemaining,
        status: loanStatus,
        created_at: loan.createdAt,
        due_date: loan.dueDate
      };
    }));

    res.json({ success: true, loans: formattedLoans });
  } catch (error: any) {
    console.error('Get Admin Loans Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get NFC cards
export const getNFCCards = async (req: AuthRequest, res: Response) => {
  try {
    const cards = await prisma.nfcCard.findMany({
      include: {
        consumerProfile: { include: { user: true } },
        retailerProfile: { include: { user: true } }
      }
    });

    const formattedCards = cards.map(card => ({
      id: card.id,
      uid: card.uid,
      status: card.status === 'available' ? 'active' : card.status,
      balance: card.balance,
      user_name: card.consumerProfile?.fullName || card.retailerProfile?.shopName || 'Unassigned',
      user_type: card.consumerProfile ? 'consumer' : (card.retailerProfile ? 'retailer' : undefined),
      created_at: card.createdAt,
      last_used: card.updatedAt
    }));

    res.json({ success: true, cards: formattedCards });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ==========================================
// CATEGORY MANAGEMENT
// ==========================================

export const getCategories = async (req: AuthRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    });
    res.json({ success: true, categories });
  } catch (error: any) {
    console.error('Get Categories Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, code } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    // Check if code exists
    if (code) {
      const existing = await prisma.category.findUnique({ where: { code } });
      if (existing) return res.status(400).json({ success: false, message: 'Category code already exists' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        code: code || name.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
        description,
        isActive: true
      }
    });
    res.status(201).json({ success: true, category, message: 'Category created successfully' });
  } catch (error: any) {
    console.error('Create Category Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, code, description, isActive } = req.body;
    const category = await prisma.category.update({
      where: { id: Number(id) },
      data: { name, code, description, isActive }
    });
    res.json({ success: true, category, message: 'Category updated successfully' });
  } catch (error: any) {
    console.error('Update Category Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.category.delete({ where: { id: Number(id) } });
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error: any) {
    console.error('Delete Category Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// RETAILER MANAGEMENT (Extra CRUD)
// ==========================================

export const updateRetailer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // RetailerProfile ID
    const { business_name, email, phone, address, credit_limit, status } = req.body;

    const retailer = await prisma.retailerProfile.findUnique({ where: { id: Number(id) } });
    if (!retailer) return res.status(404).json({ error: 'Retailer not found' });

    // Check for duplicate phone on OTHER users
    if (phone) {
      const existingUser = await prisma.user.findFirst({
        where: {
          phone,
          id: { not: retailer.userId }
        }
      });
      if (existingUser) {
        return res.status(400).json({ error: `Phone ${phone} is already in use by another account` });
      }
    }

    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          id: { not: retailer.userId }
        }
      });
      if (existingUser) {
        return res.status(400).json({ error: `Email ${email} is already in use by another account` });
      }
    }

    await prisma.retailerProfile.update({
      where: { id: Number(id) },
      data: {
        shopName: business_name,
        address,
        creditLimit: Number(credit_limit),
      }
    });

    if (phone || business_name || status) {
      await prisma.user.update({
        where: { id: retailer.userId },
        data: {
          phone,
          name: business_name,
          isActive: status === 'active'
        }
      });
    }

    res.json({ success: true, message: 'Retailer updated' });
  } catch (error: any) {
    console.error('Update Retailer Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteRetailer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const retailer = await prisma.retailerProfile.findUnique({ where: { id: Number(id) } });
    if (retailer) {
      // Delete profile first to satisfy FK
      await prisma.retailerProfile.delete({ where: { id: Number(id) } });
      // Then delete user
      await prisma.user.delete({ where: { id: retailer.userId } });
    }
    res.json({ success: true, message: 'Retailer deleted' });
  } catch (error: any) {
    console.error('Delete Retailer Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const verifyRetailer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if retailer exists
    const retailer = await prisma.retailerProfile.findUnique({ where: { id: Number(id) } });
    if (!retailer) return res.status(404).json({ success: false, message: 'Retailer not found' });

    // Update isVerified status
    await prisma.retailerProfile.update({
      where: { id: Number(id) },
      data: { isVerified: true }
    });

    res.json({ success: true, message: 'Retailer verified successfully' });
  } catch (error: any) {
    console.error('Verify Retailer Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const verifyWholesaler = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Check if wholesaler exists
    const wholesaler = await prisma.wholesalerProfile.findUnique({ where: { id: Number(id) } });
    if (!wholesaler) return res.status(404).json({ success: false, message: 'Wholesaler not found' });

    // Update isVerified status
    await prisma.wholesalerProfile.update({
      where: { id: Number(id) },
      data: { isVerified: true }
    });

    res.json({ success: true, message: 'Wholesaler verified successfully' });
  } catch (error: any) {
    console.error('Verify Wholesaler Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// WHOLESALER MANAGEMENT (Extra CRUD)
// ==========================================

export const updateWholesaler = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { company_name, email, phone, address, status } = req.body;

    const wholesaler = await prisma.wholesalerProfile.findUnique({ where: { id: Number(id) } });
    if (!wholesaler) return res.status(404).json({ error: 'Wholesaler not found' });

    // Check for duplicate phone on OTHER users
    if (phone) {
      const existingUser = await prisma.user.findFirst({
        where: {
          phone,
          id: { not: wholesaler.userId }
        }
      });
      if (existingUser) {
        return res.status(400).json({ error: `Phone ${phone} is already in use by another account` });
      }
    }

    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          id: { not: wholesaler.userId }
        }
      });
      if (existingUser) {
        return res.status(400).json({ error: `Email ${email} is already in use by another account` });
      }
    }

    await prisma.wholesalerProfile.update({
      where: { id: Number(id) },
      data: {
        companyName: company_name,
        address
      }
    });

    if (phone || company_name || status) {
      await prisma.user.update({
        where: { id: wholesaler.userId },
        data: {
          phone,
          name: company_name,
          isActive: status === 'active'
        }
      });
    }

    res.json({ success: true, message: 'Wholesaler updated' });
  } catch (error: any) {
    console.error('Update Wholesaler Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteWholesaler = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const wholesaler = await prisma.wholesalerProfile.findUnique({ where: { id: Number(id) } });
    if (wholesaler) {
      // Delete profile first to satisfy FK
      await prisma.wholesalerProfile.delete({ where: { id: Number(id) } });
      // Then delete user
      await prisma.user.delete({ where: { id: wholesaler.userId } });
    }
    res.json({ success: true, message: 'Wholesaler deleted' });
  } catch (error: any) {
    console.error('Delete Wholesaler Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateRetailerStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive, status } = req.body;
    console.log(`Updating Retailer Status - ID: ${id}, isActive: ${isActive}, status: ${status}`);

    const retailer = await prisma.retailerProfile.findUnique({ where: { id: Number(id) } });
    if (!retailer) {
      console.log(`Retailer NOT FOUND for ID: ${id}`);
      return res.status(404).json({ error: 'Retailer not found' });
    }

    // Determine new status
    let newStatus = false;
    if (typeof isActive === 'boolean') {
      newStatus = isActive;
    } else if (status === 'active') {
      newStatus = true;
    } else if (status === 'inactive') {
      newStatus = false;
    }

    console.log(`Resolved status for User ${retailer.userId}: ${newStatus}`);

    // Update User status
    await prisma.user.update({
      where: { id: retailer.userId },
      data: {
        isActive: newStatus
      }
    });

    res.json({ success: true, message: `Retailer status updated to ${newStatus ? 'active' : 'inactive'}` });
  } catch (error: any) {
    console.error('Update Retailer Status Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateWholesalerStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive, status } = req.body;
    console.log(`Updating Wholesaler Status - ID: ${id}, isActive: ${isActive}, status: ${status}`);

    const wholesaler = await prisma.wholesalerProfile.findUnique({ where: { id: Number(id) } });
    if (!wholesaler) {
      console.log(`Wholesaler NOT FOUND for ID: ${id}`);
      return res.status(404).json({ error: 'Wholesaler not found' });
    }

    // Determine new status
    let newStatus = false;
    if (typeof isActive === 'boolean') {
      newStatus = isActive;
    } else if (status === 'active') {
      newStatus = true;
    } else if (status === 'inactive') {
      newStatus = false;
    }

    console.log(`Resolved status for User ${wholesaler.userId}: ${newStatus}`);

    // Update User status
    await prisma.user.update({
      where: { id: wholesaler.userId },
      data: {
        isActive: newStatus
      }
    });

    res.json({ success: true, message: `Wholesaler status updated to ${newStatus ? 'active' : 'inactive'}` });
  } catch (error: any) {
    console.error('Update Wholesaler Status Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// CUSTOMER MANAGEMENT (Extra CRUD)
// ==========================================

export const createCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;

    if (!email || !phone) {
      return res.status(400).json({ error: 'Email and Phone are required' });
    }

    const existingEmail = await prisma.user.findFirst({ where: { email: email as string } });
    if (existingEmail) {
      return res.status(400).json({ error: `Customer with email ${email} already exists` });
    }

    const existingPhone = await prisma.user.findFirst({ where: { phone: phone as string } });
    if (existingPhone) {
      return res.status(400).json({ error: `Customer with phone ${phone} already exists` });
    }

    // const exists = await prisma.user.findFirst({
    //     where: {
    //         OR: [
    //             { email },
    //             { phone }
    //         ]
    //     }
    // });

    // if (exists) {
    //     return res.status(400).json({ error: 'User with this email or phone already exists' });
    // }

    const hashedPassword = await hashPassword(password || '123456'); // Default pin/pass

    const user = await prisma.user.create({
      data: {
        name: `${firstName} ${lastName}`,
        email,
        phone,
        password: hashedPassword,
        role: 'consumer',
        isActive: true,
        consumerProfile: {
          create: {
            fullName: `${firstName} ${lastName}`,
            isVerified: true
          }
        }
      },
      include: { consumerProfile: true }
    });

    res.status(201).json({ success: true, customer: user.consumerProfile });
  } catch (error: any) {
    console.error('Create Customer Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // ConsumerProfile ID
    const { firstName, lastName, email, phone, status } = req.body;

    const profile = await prisma.consumerProfile.findUnique({ where: { id: Number(id) } });
    if (!profile) return res.status(404).json({ error: 'Customer not found' });

    // Check if email/phone is taken by ANOTHER user
    if (email || phone) {
      const existingUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: profile.userId } }, // Exclude current user
            {
              OR: [
                email ? { email } : {},
                phone ? { phone } : {}
              ]
            }
          ]
        }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Email or phone already in use by another user' });
      }
    }

    await prisma.user.update({
      where: { id: profile.userId },
      data: {
        name: `${firstName} ${lastName}`,
        email,
        phone,
        isActive: status === 'active'
      }
    });

    await prisma.consumerProfile.update({
      where: { id: Number(id) },
      data: { fullName: `${firstName} ${lastName}` }
    });

    res.json({ success: true, message: 'Customer updated' });
  } catch (error: any) {
    console.error('Update Customer Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateCustomerStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // ConsumerProfile ID or User ID? 
    // The frontend passes record.user.id which is the USER ID.
    // Let's assume the ID passed is the USER ID because customer status is on the User model.
    // However, consistency suggests we might pass the ConsumerProfile ID and look up the user.
    // In apiService.ts: api.put(`/admin/customers/${id}/status`, data)
    // The call in CustomerManagementPage.tsx is updateCustomerStatus(record.user.id, newStatus).
    // record.user.id IS the User ID.
    // But RESTfully, /admin/customers/:id Usually implies ConsumerProfile ID.
    // Let's check updateWholesalerStatus. It takes params.id (WholesalerProfile ID) and finds profile then user.
    // So for consistency, the frontend SHOULD pass ConsumerProfile ID, and backend looks up User.
    // BUT current frontend code passes `record.user.id`.
    // I will support BOTH or check if the ID exists as a ConsumerProfile first.
    // Actually, to be consistent with getCustomers returning ConsumerProfiles, :id should be ConsumerProfile ID.
    // I will change the frontend to pass record.id (ConsumerProfile ID) instead of record.user.id.
    // Backend implementation:
    const { status } = req.body;
    // Map status string to boolean if needed, or expect boolean 'isActive'
    // apiService sends: { status: string } from definition?
    // apiService definition: updateCustomerStatus: (id: string, data: { status: string })
    // usage in frontend: await adminApi.updateCustomerStatus(record.user.id, newStatus); 
    // Wait, newStatus is boolean.
    // Frontend: const newStatus = !record.user?.isActive; ... updateCustomerStatus(..., newStatus)
    // apiService expects object? No, logic in apiService: api.put(..., data). 
    // If I pass boolean as data, it sends request body as boolean? No, must be object.
    // Frontend usage: adminApi.updateCustomerStatus(record.user.id, newStatus)
    // API Service: updateCustomerStatus: (id, data) => api.put(..., data)
    // So frontend is passing a boolean where an object is expected? 
    // Let's check frontend again.
    // Frontend: await adminApi.updateCustomerStatus(record.user.id, newStatus);
    // apiService: updateCustomerStatus: (id: string, data: { status: string }) => ... 
    // Wait, the interface in apiService says it takes `data: { status: string }` but the implementation just passes `data`.
    // So if frontend passes a boolean, the body is just `true` or `false`.
    // I should fix the frontend to pass `{ status: newStatus ? 'active' : 'inactive' }` or `{ isActive: newStatus }`.
    // And backend should handle it.
    
    // For now, let's look for profile by ID.
    
    const profileId = Number(id);
    let profile = await prisma.consumerProfile.findUnique({ where: { id: profileId } });
    
    if (!profile) {
        // Fallback: maybe it IS a user ID?
        const user = await prisma.user.findUnique({ where: { id: profileId } });
        if (!user) return res.status(404).json({ error: 'Customer not found' });
        
        // It was a user ID
        await prisma.user.update({
            where: { id: profileId },
            data: { isActive: req.body.isActive ?? (req.body.status === 'active') }
        });
    } else {
        // It was a profile ID
        await prisma.user.update({
            where: { id: profile.userId },
            data: { isActive: req.body.isActive ?? (req.body.status === 'active') }
        });
    }

    res.json({ success: true, message: 'Customer status updated' });
  } catch (error: any) {
    console.error('Update Customer Status Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await prisma.consumerProfile.findUnique({
      where: { id: Number(id) },
      include: { wallets: true }
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Customer profile not found' });
    }

    // Manual Cascade Deletion
    await prisma.$transaction([
      // 1. Delete Wallet Transactions
      prisma.walletTransaction.deleteMany({
        where: { walletId: { in: profile.wallets.map(w => w.id) } }
      }),
      // 2. Delete Wallets
      prisma.wallet.deleteMany({ where: { consumerId: Number(id) } }),
      // 3. Delete Gas Topups and Rewards
      prisma.gasTopup.deleteMany({ where: { consumerId: Number(id) } }),
      prisma.gasReward.deleteMany({ where: { consumerId: Number(id) } }),
      // 4. Delete Gas Meters
      prisma.gasMeter.deleteMany({ where: { consumerId: Number(id) } }),
      // 5. Delete Customer Orders
      prisma.customerOrder.deleteMany({ where: { consumerId: Number(id) } }),
      // 6. Delete Loans
      prisma.loan.deleteMany({ where: { consumerId: Number(id) } }),
      // 7. Unlink or delete NFC cards (unlinking is safer if cards are reusable)
      prisma.nfcCard.updateMany({
        where: { consumerId: Number(id) },
        data: { consumerId: null, status: 'inactive' }
      }),
      // 8. Delete Sales (if they belong to this consumer)
      prisma.sale.deleteMany({ where: { consumerId: Number(id) } }),
      // 9. Delete Settings
      prisma.consumerSettings.deleteMany({ where: { consumerId: Number(id) } }),
      // 10. Delete Messages and Notifications
      prisma.message.deleteMany({
        where: { OR: [{ senderId: profile.userId }, { receiverId: profile.userId }] }
      }),
      prisma.notification.deleteMany({ where: { userId: profile.userId } }),
      // 11. Delete the profile itself
      prisma.consumerProfile.delete({ where: { id: Number(id) } }),
      // 12. Finally delete the User record
      prisma.user.delete({ where: { id: profile.userId } })
    ]);

    res.json({ success: true, message: 'Customer and all associated data deleted successfully' });
  } catch (error: any) {
    console.error('Delete Customer Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all products
export const getProducts = async (req: AuthRequest, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        retailerProfile: {
          select: { shopName: true }
        },
        wholesalerProfile: {
          select: { companyName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ products });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create product
export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      description,
      sku,
      category,
      price,
      costPrice,
      retailerPrice,
      stock,
      unit,
      lowStockThreshold,
      invoiceNumber,
      barcode,
      wholesalerId,
      retailerId
    } = req.body;

    const product = await prisma.product.create({
      data: {
        name,
        description,
        sku,
        category,
        price: parseFloat(price),
        costPrice: costPrice ? parseFloat(costPrice) : null,
        retailerPrice: retailerPrice ? parseFloat(retailerPrice) : null,
        stock: parseInt(stock) || 0,
        unit,
        lowStockThreshold: lowStockThreshold ? parseInt(lowStockThreshold) : null,
        invoiceNumber,
        barcode,
        wholesalerId,
        retailerId,
        status: 'active'
      }
    });

    res.status(201).json({ success: true, product });
  } catch (error: any) {
    console.error('Create Product Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update product
export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      sku,
      category,
      price,
      costPrice,
      retailerPrice,
      stock,
      unit,
      lowStockThreshold,
      invoiceNumber,
      barcode,
      status
    } = req.body;

    const product = await prisma.product.update({
      where: { id: Number(id) },
      data: {
        name,
        description,
        sku,
        category,
        price: price ? parseFloat(price) : undefined,
        costPrice: costPrice !== undefined ? (costPrice ? parseFloat(costPrice) : null) : undefined,
        retailerPrice: retailerPrice !== undefined ? (retailerPrice ? parseFloat(retailerPrice) : null) : undefined,
        stock: stock !== undefined ? parseInt(stock) : undefined,
        unit,
        lowStockThreshold: lowStockThreshold !== undefined ? (lowStockThreshold ? parseInt(lowStockThreshold) : null) : undefined,
        invoiceNumber,
        barcode,
        status
      }
    });

    res.json({ success: true, product });
  } catch (error: any) {
    console.error('Update Product Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete product
export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.product.delete({ where: { id: Number(id) } });
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Delete Product Error:', error);
    res.status(500).json({ error: error.message });
  }
};


// ==========================================
// EMPLOYEE MANAGEMENT
// ==========================================

// Get All Employees
export const getEmployees = async (req: AuthRequest, res: Response) => {
  try {
    const employees = await prisma.employeeProfile.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            name: true,
            role: true,
            isActive: true
          }
        }
      }
    });

    // Transform data for frontend
    const formattedEmployees = employees.map(emp => ({
      id: emp.id,
      userId: emp.userId,
      employeeNumber: emp.employeeNumber,
      firstName: emp.user.name ? emp.user.name.split(' ')[0] : 'Unknown', // Basic name splitting
      lastName: emp.user.name ? emp.user.name.split(' ').slice(1).join(' ') : 'Employee',
      email: emp.user.email,
      phone: emp.user.phone,
      department: emp.department,
      position: emp.position,
      salary: emp.salary,
      status: emp.status,
      dateOfJoining: emp.joiningDate,
      bankAccount: emp.bankAccount
    }));

    res.json({ employees: formattedEmployees });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create Employee
export const createEmployee = async (req: AuthRequest, res: Response) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      department,
      position,
      salary,
      dateOfJoining,
      bankAccount,
      password // Get password from request
    } = req.body;

    const fullName = `${firstName} ${lastName}`;

    // check existing
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email or phone already exists' });
    }

    // Generate random password or use default
    const finalPassword = password || 'employee123';
    const hashedPassword = await hashPassword(finalPassword);

    // Generate Employee Number (simple auto-increment logic or random)
    const count = await prisma.employeeProfile.count();
    const employeeNumber = `EMP${(count + 1).toString().padStart(3, '0')}`;

    // Transaction to create User and Profile
    const result = await prisma.$transaction(async (prisma) => {
      const user = await prisma.user.create({
        data: {
          email,
          phone,
          name: fullName,
          password: hashedPassword,
          role: 'employee',
          isActive: true
        }
      });

      const profile = await prisma.employeeProfile.create({
        data: {
          userId: user.id,
          employeeNumber,
          department,
          position,
          salary: Number(salary),
          joiningDate: new Date(dateOfJoining),
          status: 'active',
          bankAccount
        }
      });

      return { user, profile };
    });

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      employee: result
    });

  } catch (error: any) {
    console.error('Create Employee Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update Employee
export const updateEmployee = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // This is the EmployeeProfile ID
    const {
      firstName,
      lastName,
      email,
      phone,
      department,
      position,
      salary,
      status,
      dateOfJoining,
      bankAccount
    } = req.body;

    const fullName = `${firstName} ${lastName}`;

    // Find profile first
    const profile = await prisma.employeeProfile.findUnique({
      where: { id: Number(id) },
      include: { user: true }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Update User and Profile
    await prisma.$transaction([
      prisma.user.update({
        where: { id: profile.userId },
        data: {
          name: fullName,
          email,
          phone,
          isActive: status === 'active'
        }
      }),
      prisma.employeeProfile.update({
        where: { id: Number(id) },
        data: {
          department,
          position,
          salary: Number(salary),
          status, // 'active', 'inactive', 'on_leave'
          joiningDate: new Date(dateOfJoining),
          bankAccount
        }
      })
    ]);

    res.json({ success: true, message: 'Employee updated successfully' });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Delete Employee
export const deleteEmployee = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // EmployeeProfile ID

    const profile = await prisma.employeeProfile.findUnique({
      where: { id: Number(id) }
    });

    if (!profile) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Delete User (Cascade will handle profile deletion if configured, but let's be explicit or rely on schema)
    // In our updated schema we added onDelete: Cascade to the relation.
    // So deleting the User deletes the Profile.

    await prisma.user.delete({
      where: { id: profile.userId }
    });

    res.json({ success: true, message: 'Employee deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// LOAN MANAGEMENT
// ==========================================

export const approveLoan = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await prisma.$transaction(async (prisma) => {
      const loan = await prisma.loan.findUnique({
        where: { id: Number(id) },
        include: { consumerProfile: true }
      });

      if (!loan) throw new Error('Loan not found');
      if (loan.status !== 'pending') throw new Error('Loan is already processed');

      // 1. Update Loan status
      const updatedLoan = await prisma.loan.update({
        where: { id: Number(id) },
        data: {
          status: 'approved',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      });

      // 2. Get or Create Credit Wallet
      let creditWallet = await prisma.wallet.findFirst({
        where: { consumerId: loan.consumerId, type: 'credit_wallet' }
      });

      if (!creditWallet) {
        creditWallet = await prisma.wallet.create({
          data: {
            consumerId: loan.consumerId,
            type: 'credit_wallet',
            balance: 0,
            currency: 'RWF'
          }
        });
      }

      // 3. Add to Credit Wallet Balance
      await prisma.wallet.update({
        where: { id: creditWallet.id },
        data: { balance: { increment: loan.amount } }
      });

      // 4. Create Transaction
      await prisma.walletTransaction.create({
        data: {
          walletId: creditWallet.id,
          type: 'loan_disbursement',
          amount: loan.amount,
          description: `Loan Approved by Admin`,
          status: 'completed',
          reference: loan.id.toString()
        }
      });

      return updatedLoan;
    });

    res.json({ success: true, loan: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectLoan = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const loan = await prisma.loan.update({
      where: { id: Number(id) },
      data: { status: 'rejected' }
    });

    res.json({ success: true, loan });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// NFC CARD MANAGEMENT
// ==========================================

export const registerNFCCard = async (req: AuthRequest, res: Response) => {
  try {
    const { 
      uid, 
      pin, 
      cardType,
      cardholderName,
      nationalId,
      phone,
      email,
      province,
      district,
      sector,
      cell,
      streetAddress,
      landmark,
      userId // Optional: Valid User ID passed from frontend
    } = req.body;

    if (!uid) return res.status(400).json({ error: 'UID is required' });

    const existing = await prisma.nfcCard.findUnique({ where: { uid } });
    if (existing) return res.status(400).json({ error: 'NFC Card with this UID already exists' });

    // Try to link to a consumer
    let consumerId = null;
    let finalStatus = 'available';

    // 1. If userId provided explicitly
    if (userId) {
        const profile = await prisma.consumerProfile.findFirst({ where: { userId: userId } }); // Assuming userId is User model ID
        if (profile) consumerId = profile.id;
        else {
            // Maybe it WAS the consumerProfile ID?
             const profileById = await prisma.consumerProfile.findUnique({ where: { id: Number(userId) } });
             if (profileById) consumerId = profileById.id;
        }
    } 
    // 2. If no userId, try to match by phone
    else if (phone) {
        const user = await prisma.user.findFirst({ where: { phone } });
        if (user) {
            const profile = await prisma.consumerProfile.findUnique({ where: { userId: user.id } });
            if (profile) consumerId = profile.id;
        }
    }

    if (consumerId) {
        finalStatus = 'active';
    }

    const card = await prisma.nfcCard.create({
      data: {
        uid,
        pin: pin || '1234',
        status: finalStatus,
        balance: 0,
        cardType,
        cardholderName,
        nationalId,
        phone,
        email,
        province,
        district,
        sector,
        cell,
        streetAddress,
        landmark,
        consumerId: consumerId
      }
    });

    res.status(201).json({ success: true, card, message: consumerId ? 'Card registered and linked to customer' : 'Card registered successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const blockNFCCard = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const card = await prisma.nfcCard.update({
      where: { id: Number(id) },
      data: { status: 'blocked' }
    });
    res.json({ success: true, card });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const activateNFCCard = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const card = await prisma.nfcCard.update({
      where: { id: Number(id) },
      data: { status: 'available' }
    });
    res.json({ success: true, card });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const unlinkNFCCard = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const card = await prisma.nfcCard.update({
      where: { id: Number(id) },
      data: { 
        consumerId: null,
        retailerId: null,
        status: 'available' // Reset to available upon unlink
      }
    });
    res.json({ success: true, card });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// REPORTS
// ==========================================

export const getTransactionReport = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, groupBy } = req.query;

    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    const txs = await prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'asc' }
    });

    // Group by period
    const report: any[] = [];
    const grouped: Record<string, any> = {};

    txs.forEach(tx => {
      const date = new Date(tx.createdAt);
      let period = '';
      if (groupBy === 'month') {
        period = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      } else {
        period = date.toISOString().split('T')[0];
      }

      // Map types to frontend expectations
      let type = tx.type;
      if (type === 'topup' || type === 'top_up') type = 'wallet_topup';
      if (type === 'gas_payment' || type === 'gas_topup') type = 'gas_purchase';
      if (type === 'loan' || type === 'disbursement') type = 'loan_disbursement';
      if (type === 'nfc') type = 'nfc_payment';

      const key = `${period}_${type}`;
      if (!grouped[key]) {
        grouped[key] = { period, type, count: 0, total_amount: 0 };
      }
      grouped[key].count += 1;
      grouped[key].total_amount += tx.amount;
    });

    res.json({ success: true, report: Object.values(grouped) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getRevenueReport = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, groupBy } = req.query;

    const where: any = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    // Revenue comes from Sales and GasTopups
    const [sales, gasTopups] = await Promise.all([
      prisma.sale.findMany({ where, orderBy: { createdAt: 'asc' } }),
      prisma.gasTopup.findMany({ where, orderBy: { createdAt: 'asc' } })
    ]);

    const grouped: Record<string, any> = {};

    sales.forEach(s => {
      const date = new Date(s.createdAt);
      let period = groupBy === 'month' 
        ? `${date.getFullYear()}-${(date.getMonth() + 0).toString().padStart(2, '0')}` // Using 0 based or 1 based? Let's use 1 based to be consistent
        : date.toISOString().split('T')[0];
      
      // Fix month calculation to be 1-based
      if (groupBy === 'month') {
        period = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      }

      if (!grouped[period]) {
        grouped[period] = { period, order_revenue: 0, order_count: 0, gas_revenue: 0, gas_count: 0 };
      }
      grouped[period].order_revenue += s.totalAmount;
      grouped[period].order_count += 1;
    });

    gasTopups.forEach(g => {
      const date = new Date(g.createdAt);
      let period = groupBy === 'month' 
        ? `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
        : date.toISOString().split('T')[0];

      if (!grouped[period]) {
        grouped[period] = { period, order_revenue: 0, order_count: 0, gas_revenue: 0, gas_count: 0 };
      }
      grouped[period].gas_revenue += g.amount;
      grouped[period].gas_count += 1;
    });

    res.json({ success: true, orders: Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period)) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// SYSTEM CONFIGURATION
// ==========================================

export const getSystemConfig = async (req: AuthRequest, res: Response) => {
  try {
    let config = await prisma.systemConfig.findFirst();
    
    // Create default config if it doesn't exist
    if (!config) {
      config = await prisma.systemConfig.create({
        data: {
          retailerShare: 60,
          companyShare: 28,
          gasRewardShare: 12,
          gasPricePerM3: 850,
          minGasTopup: 500,
          maxGasTopup: 100000,
          minWalletTopup: 500,
          maxWalletTopup: 500000,
          maxDailyTransaction: 1000000,
          maxCreditLimit: 500000
        }
      });
    }
    
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateSystemConfig = async (req: AuthRequest, res: Response) => {
  try {
    const data = req.body;
    let config = await prisma.systemConfig.findFirst();

    if (!config) {
      config = await prisma.systemConfig.create({ data });
    } else {
      config = await prisma.systemConfig.update({
        where: { id: config.id },
        data
      });
    }

    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
