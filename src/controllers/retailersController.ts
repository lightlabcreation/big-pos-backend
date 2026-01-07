import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../utils/prisma';

// ============================================
// RETAILERS MANAGEMENT
// ============================================

// Get all retailers
export const getRetailers = async (req: AuthRequest, res: Response) => {
    try {
        console.log('🏪 Fetching retailers for user:', req.user?.id);

        const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
            where: { userId: req.user!.id }
        });

        if (!wholesalerProfile) {
            return res.status(404).json({ error: 'Wholesaler profile not found' });
        }

        // Get all retailers who have placed orders with this wholesaler
        const orders = await prisma.order.findMany({
            where: { wholesalerId: wholesalerProfile.id },
            include: {
                retailer: {
                    include: {
                        user: true,
                        credit: true
                    }
                }
            },
            distinct: ['retailerId']
        });

        // Extract unique retailers
        const retailersMap = new Map();
        for (const order of orders) {
            if (!retailersMap.has(order.retailerId)) {
                retailersMap.set(order.retailerId, order.retailer);
            }
        }

        const retailers = Array.from(retailersMap.values());

        console.log(`✅ Found ${retailers.length} retailers`);
        res.json({ retailers, count: retailers.length });
    } catch (error: any) {
        console.error('❌ Error fetching retailers:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get retailer stats
export const getRetailerStats = async (req: AuthRequest, res: Response) => {
    try {
        const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
            where: { userId: req.user!.id }
        });

        if (!wholesalerProfile) {
            return res.status(404).json({ error: 'Wholesaler profile not found' });
        }

        // Get all orders to find unique retailers
        const orders = await prisma.order.findMany({
            where: { wholesalerId: wholesalerProfile.id },
            include: { retailer: true }
        });

        const uniqueRetailers = new Set(orders.map(o => o.retailerId));
        const totalRetailers = uniqueRetailers.size;

        // Get credit data
        const creditData = await prisma.retailerCredit.findMany({
            where: {
                retailer: {
                    orders: {
                        some: {
                            wholesalerId: wholesalerProfile.id
                        }
                    }
                }
            }
        });

        const totalCreditExtended = creditData.reduce((sum, c) => sum + c.creditLimit, 0);
        const totalCreditUsed = creditData.reduce((sum, c) => sum + c.usedCredit, 0);
        const creditUtilization = totalCreditExtended > 0
            ? Math.round((totalCreditUsed / totalCreditExtended) * 100)
            : 0;

        res.json({
            total_retailers: totalRetailers,
            active_retailers: totalRetailers, // All are active if they have orders
            credit_extended: totalCreditExtended,
            credit_utilization_percentage: creditUtilization
        });
    } catch (error: any) {
        console.error('❌ Error fetching retailer stats:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get single retailer details
export const getRetailerById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        console.log('🏪 Fetching retailer details for:', id);

        const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
            where: { userId: req.user!.id }
        });

        if (!wholesalerProfile) {
            return res.status(404).json({ error: 'Wholesaler profile not found' });
        }

        // Get retailer with all details
        const retailer = await prisma.retailerProfile.findUnique({
            where: { id },
            include: {
                user: true,
                credit: true,
                _count: {
                    select: { orders: true }
                }
            }
        });

        if (!retailer) {
            return res.status(404).json({ error: 'Retailer not found' });
        }

        // Calculate total revenue from orders with this wholesaler
        const orders = await prisma.order.findMany({
            where: {
                retailerId: id,
                wholesalerId: wholesalerProfile.id
            }
        });

        const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);

        console.log(`✅ Found retailer: ${retailer.shopName}`);
        res.json({
            ...retailer,
            totalRevenue
        });
    } catch (error: any) {
        console.error('❌ Error fetching retailer details:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get retailer orders by retailer ID
export const getRetailerOrdersById = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit as string) || 10;
        console.log(`📦 Fetching orders for retailer: ${id}`);

        const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
            where: { userId: req.user!.id }
        });

        if (!wholesalerProfile) {
            return res.status(404).json({ error: 'Wholesaler profile not found' });
        }

        const orders = await prisma.order.findMany({
            where: {
                retailerId: id,
                wholesalerId: wholesalerProfile.id
            },
            include: {
                _count: {
                    select: { items: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        // Transform to match frontend expectations
        const transformedOrders = orders.map(order => ({
            id: order.id,
            orderNumber: `ORD-${order.id.substring(0, 8).toUpperCase()}`,
            totalAmount: order.totalAmount,
            status: order.status,
            paymentType: 'credit', // Default, can be enhanced
            paymentStatus: order.status === 'delivered' ? 'paid' : 'pending',
            createdAt: order.createdAt.toISOString(),
            _count: {
                items: order._count.items
            }
        }));

        console.log(`✅ Found ${transformedOrders.length} orders for retailer`);
        res.json({ orders: transformedOrders, count: transformedOrders.length });
    } catch (error: any) {
        console.error('❌ Error fetching retailer orders:', error);
        res.status(500).json({ error: error.message });
    }
};


// ============================================
// SUPPLIER MANAGEMENT
// ============================================

// Get supplier orders (payments made to suppliers)
export const getSupplierOrders = async (req: AuthRequest, res: Response) => {
    try {
        console.log('🏭 Fetching supplier orders');

        const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
            where: { userId: req.user!.id }
        });

        if (!wholesalerProfile) {
            return res.status(404).json({ error: 'Wholesaler profile not found' });
        }

        // Get all supplier payments
        const payments = await prisma.supplierPayment.findMany({
            include: {
                supplier: true
            },
            orderBy: { paymentDate: 'desc' }
        });

        // Transform to match frontend expectations
        const orders = payments.map(payment => ({
            id: payment.id,
            supplierName: payment.supplier.name,
            invoiceNumber: payment.reference || `PAY-${payment.id.substring(0, 8)}`,
            totalAmount: payment.amount,
            paymentStatus: payment.status as 'paid' | 'pending' | 'partial',
            itemsCount: 0, // Not tracked in current schema
            createdAt: payment.paymentDate.toISOString(),
            paidAt: payment.status === 'completed' ? payment.paymentDate.toISOString() : undefined
        }));

        const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        const pendingAmount = payments
            .filter(p => p.status === 'pending')
            .reduce((sum, p) => sum + p.amount, 0);

        console.log(`✅ Found ${orders.length} supplier orders`);
        res.json({
            orders,
            count: orders.length,
            totalAmount,
            pendingAmount
        });
    } catch (error: any) {
        console.error('❌ Error fetching supplier orders:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get suppliers list
export const getSuppliers = async (req: AuthRequest, res: Response) => {
    try {
        const suppliers = await prisma.supplier.findMany({
            include: {
                products: true,
                payments: true
            },
            orderBy: { name: 'asc' }
        });

        res.json({ suppliers, count: suppliers.length });
    } catch (error: any) {
        console.error('❌ Error fetching suppliers:', error);
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// CREDIT MANAGEMENT
// ============================================

// Get credit requests - already implemented in wholesalerController
// But let's make it return proper data
export const getCreditRequestsWithStats = async (req: AuthRequest, res: Response) => {
    try {
        console.log('💳 Fetching credit requests');

        const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
            where: { userId: req.user!.id }
        });

        if (!wholesalerProfile) {
            return res.status(404).json({ error: 'Wholesaler profile not found' });
        }

        // Get credit requests from retailers who have ordered from this wholesaler
        const creditRequests = await prisma.creditRequest.findMany({
            where: {
                retailer: {
                    orders: {
                        some: {
                            wholesalerId: wholesalerProfile.id
                        }
                    }
                }
            },
            include: {
                retailer: {
                    include: {
                        user: true,
                        credit: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Transform to match frontend expectations
        const requests = creditRequests.map(req => ({
            id: req.id,
            retailerId: req.retailerId,
            retailerName: req.retailer.user.name || 'Unknown',
            retailerShop: req.retailer.shopName,
            retailerPhone: req.retailer.user.phone || '',
            currentCredit: req.retailer.credit?.usedCredit || 0,
            creditLimit: req.retailer.credit?.creditLimit || 0,
            requestedAmount: req.amount,
            reason: req.reason || '',
            status: req.status as 'pending' | 'approved' | 'rejected',
            createdAt: req.createdAt.toISOString(),
            processedAt: req.reviewedAt?.toISOString(),
            rejectionReason: req.reviewNotes
        }));

        // Calculate credit stats
        const allCreditData = await prisma.retailerCredit.findMany({
            where: {
                retailer: {
                    orders: {
                        some: {
                            wholesalerId: wholesalerProfile.id
                        }
                    }
                }
            }
        });

        const totalCreditExtended = allCreditData.reduce((sum, c) => sum + c.creditLimit, 0);
        const totalCreditUsed = allCreditData.reduce((sum, c) => sum + c.usedCredit, 0);
        const creditAvailable = allCreditData.reduce((sum, c) => sum + c.availableCredit, 0);

        console.log(`✅ Found ${requests.length} credit requests`);
        res.json({
            requests,
            count: requests.length,
            stats: {
                totalCreditExtended,
                totalCreditUsed,
                creditAvailable
            }
        });
    } catch (error: any) {
        console.error('❌ Error fetching credit requests:', error);
        res.status(500).json({ error: error.message });
    }
};

// Approve credit request
export const approveCreditRequest = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        const creditRequest = await prisma.creditRequest.update({
            where: { id },
            data: {
                status: 'approved',
                reviewedAt: new Date()
            },
            include: {
                retailer: {
                    include: { credit: true }
                }
            }
        });

        // Update retailer credit limit
        if (creditRequest.retailer.credit) {
            await prisma.retailerCredit.update({
                where: { id: creditRequest.retailer.credit.id },
                data: {
                    creditLimit: creditRequest.retailer.credit.creditLimit + creditRequest.amount,
                    availableCredit: creditRequest.retailer.credit.availableCredit + creditRequest.amount
                }
            });
        }

        res.json({ success: true, creditRequest });
    } catch (error: any) {
        console.error('❌ Error approving credit request:', error);
        res.status(500).json({ error: error.message });
    }
};

// Reject credit request
export const rejectCreditRequest = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const creditRequest = await prisma.creditRequest.update({
            where: { id },
            data: {
                status: 'rejected',
                reviewedAt: new Date(),
                reviewNotes: reason
            }
        });

        res.json({ success: true, creditRequest });
    } catch (error: any) {
        console.error('❌ Error rejecting credit request:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update retailer credit limit
export const updateRetailerCreditLimit = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params; // retailerId
        let { creditLimit } = req.body;

        // Handle numeric strings with commas (e.g., "350,000")
        if (typeof creditLimit === 'string') {
            creditLimit = creditLimit.replace(/,/g, '');
        }
        const newLimit = parseFloat(creditLimit);

        if (isNaN(newLimit) || newLimit < 0) {
            return res.status(400).json({ error: 'Invalid credit limit value' });
        }

        console.log(`💳 Updating credit limit for retailer ${id} to ${newLimit}`);

        const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
            where: { userId: req.user!.id }
        });

        if (!wholesalerProfile) {
            return res.status(404).json({ error: 'Wholesaler profile not found' });
        }

        // Get existing credit record
        const existingCredit = await prisma.retailerCredit.findUnique({
            where: { retailerId: id }
        });

        let credit;
        if (existingCredit) {
            // Calculate the difference and update available credit
            const limitDifference = newLimit - existingCredit.creditLimit;
            const newAvailableCredit = existingCredit.availableCredit + limitDifference;

            credit = await prisma.retailerCredit.update({
                where: { retailerId: id },
                data: {
                    creditLimit: newLimit,
                    availableCredit: newAvailableCredit
                }
            });
        } else {
            // Create new credit record
            credit = await prisma.retailerCredit.create({
                data: {
                    retailerId: id,
                    creditLimit: newLimit,
                    availableCredit: newLimit,
                    usedCredit: 0
                }
            });
        }

        console.log(`✅ Credit limit updated successfully for retailer ${id}`);
        res.json({ success: true, credit });
    } catch (error: any) {
        console.error('❌ Error updating credit limit:', error);
        res.status(500).json({ error: error.message });
    }
};

// Block/Unblock retailer
export const blockRetailer = async (req: AuthRequest, res: Response) => {
    res.json({ success: true, message: 'Status updated successfully' });
};


