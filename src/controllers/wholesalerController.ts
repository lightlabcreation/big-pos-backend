import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../utils/prisma';

// Get dashboard stats with comprehensive calculations
export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    console.log('📊 Fetching dashboard stats for user:', req.user?.id);

    const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!wholesalerProfile) {
      console.error('❌ Wholesaler profile not found');
      return res.status(404).json({ error: 'Wholesaler profile not found' });
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch all necessary data in parallel
    const [
      allOrders,
      todayOrders,
      allProducts,
      pendingCreditRequests
    ] = await Promise.all([
      // All orders for total revenue
      prisma.order.findMany({
        where: { wholesalerId: wholesalerProfile.id },
        include: {
          retailer: {
            include: { user: true }
          }
        }
      }),
      // Today's orders
      prisma.order.findMany({
        where: {
          wholesalerId: wholesalerProfile.id,
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        }
      }),
      // All products for inventory value
      prisma.product.findMany({
        where: { wholesalerId: wholesalerProfile.id }
      }),
      // Pending credit requests
      prisma.creditRequest.findMany({
        where: {
          retailer: {
            orders: {
              some: {
                wholesalerId: wholesalerProfile.id
              }
            }
          },
          status: 'pending'
        }
      })
    ]);

    // Calculate today's stats
    const todayOrdersCount = todayOrders.length;
    const todaySalesAmount = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Calculate total revenue (all time)
    const totalRevenue = allOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Calculate inventory values
    const inventoryValueWallet = allProducts.reduce((sum, p) =>
      sum + (p.stock * (p.costPrice || 0)), 0
    );

    const stockValueWholesaler = allProducts.reduce((sum, p) =>
      sum + (p.stock * p.price), 0
    );

    // Calculate profit wallet (potential profit from current stock)
    const profitWallet = stockValueWholesaler - inventoryValueWallet;

    // Count pending orders
    const pendingOrdersCount = allOrders.filter(o => o.status === 'pending').length;

    // Count pending credit requests
    const pendingCreditRequestsCount = pendingCreditRequests.length;

    // Get dates for 7-day trend
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      return d;
    }).reverse();

    // Fetch order items for top products
    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: { wholesalerId: wholesalerProfile.id }
      },
      include: { product: true }
    });

    // Calculate top products
    const productStatsMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    orderItems.forEach(item => {
      const productId = item.productId;
      if (!productStatsMap[productId]) {
        productStatsMap[productId] = { name: item.product.name, quantity: 0, revenue: 0 };
      }
      productStatsMap[productId].quantity += item.quantity;
      productStatsMap[productId].revenue += item.quantity * item.price;
    });

    const topSellingProducts = Object.values(productStatsMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Calculate revenue trend
    const revenueTrend = last7Days.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const amount = allOrders
        .filter(o => o.createdAt.toISOString().split('T')[0] === dateStr)
        .reduce((sum, o) => sum + o.totalAmount, 0);
      return { date: dateStr, amount };
    });

    // Calculate top buyers (retailers)
    const retailerStatsMap: Record<string, { name: string; orders: number; revenue: number }> = {};
    allOrders.forEach(order => {
      const retailerId = order.retailerId;
      if (!retailerStatsMap[retailerId]) {
        const name = order.retailer.shopName || order.retailer.user.name || `Retailer ${retailerId.substring(0, 5)}`;
        retailerStatsMap[retailerId] = { name, orders: 0, revenue: 0 };
      }
      retailerStatsMap[retailerId].orders += 1;
      retailerStatsMap[retailerId].revenue += order.totalAmount;
    });

    const topBuyers = Object.values(retailerStatsMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Count unique retailers
    const activeRetailersCount = new Set(allOrders.map(o => o.retailerId)).size;

    const stats = {
      todayDate: today.toISOString().split('T')[0],
      todaySalesAmount: todaySalesAmount,
      todayOrdersCount: todayOrdersCount,
      totalRevenue: totalRevenue,
      inventoryValueWallet: inventoryValueWallet,
      profitWallet: profitWallet,
      pendingOrdersCount: pendingOrdersCount,
      pendingCreditRequestsCount: pendingCreditRequestsCount,

      // Richer stats for Analytics
      totalOrders: allOrders.length,
      totalProducts: allProducts.length,
      stockValueWholesaler: stockValueWholesaler,
      activeRetailers: activeRetailersCount,
      revenueTrend,
      topSellingProducts,
      topBuyers,
      lowStockItems: allProducts.filter(p => p.lowStockThreshold && p.stock <= p.lowStockThreshold).length
    };

    console.log('✅ Dashboard stats calculated:', stats);
    res.json(stats);

  } catch (error: any) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get inventory with filters, pagination, and search
export const getInventory = async (req: AuthRequest, res: Response) => {
  try {
    console.log('📦 Fetching inventory for user:', req.user?.id);
    console.log('📦 Query params:', req.query);

    const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!wholesalerProfile) {
      console.error('❌ Wholesaler profile not found');
      return res.status(404).json({ error: 'Wholesaler profile not found' });
    }

    // Extract query parameters
    const {
      category,
      search,
      low_stock,
      limit = '20',
      offset = '0'
    } = req.query;

    // Build where clause
    const where: any = {
      wholesalerId: wholesalerProfile.id
    };

    if (category) {
      where.category = category as string;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { sku: { contains: search as string } },
        { description: { contains: search as string } }
      ];
    }

    if (low_stock === 'true') {
      where.AND = [
        { stock: { gt: 0 } },
        { lowStockThreshold: { not: null } }
      ];
    }

    // Get total count
    const total = await prisma.product.count({ where });

    // Get products with pagination
    let products = await prisma.product.findMany({
      where,
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: { createdAt: 'desc' }
    });

    // Filter low stock products if needed
    if (low_stock === 'true') {
      products = products.filter(p =>
        p.lowStockThreshold && p.stock <= p.lowStockThreshold
      );
    }

    console.log(`✅ Found ${products.length} products (total: ${total})`);

    res.json({
      products,
      count: products.length,
      total
    });
  } catch (error: any) {
    console.error('❌ Error fetching inventory:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get inventory statistics
export const getInventoryStats = async (req: AuthRequest, res: Response) => {
  try {
    const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!wholesalerProfile) {
      return res.status(404).json({ error: 'Wholesaler profile not found' });
    }

    const products = await prisma.product.findMany({
      where: { wholesalerId: wholesalerProfile.id }
    });

    // Calculate statistics
    const totalProducts = products.length;
    const stockValueSupplier = products.reduce((sum, p) => sum + (p.stock * (p.costPrice || 0)), 0);
    const stockValueWholesaler = products.reduce((sum, p) => sum + (p.stock * p.price), 0);
    const stockProfitMargin = stockValueWholesaler - stockValueSupplier;
    const lowStockCount = products.filter(p => p.lowStockThreshold && p.stock > 0 && p.stock <= p.lowStockThreshold).length;
    const outOfStockCount = products.filter(p => p.stock === 0).length;

    res.json({
      totalProducts,
      stockValueSupplier,
      stockValueWholesaler,
      stockProfitMargin,
      lowStockCount,
      outOfStockCount
    });
  } catch (error: any) {
    console.error('❌ Error fetching inventory stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get categories
export const getCategories = async (req: AuthRequest, res: Response) => {
  try {
    const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!wholesalerProfile) {
      return res.status(404).json({ error: 'Wholesaler profile not found' });
    }

    // Get unique categories from products
    const products = await prisma.product.findMany({
      where: { wholesalerId: wholesalerProfile.id },
      select: { category: true },
      distinct: ['category']
    });

    const categories = products.map(p => p.category).filter(Boolean);

    res.json({ categories });
  } catch (error: any) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({ error: error.message });
  }
};

// Create product
export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    console.log('📦 Creating product for user:', req.user?.id);
    console.log('📦 Request body:', req.body);

    // Validate user authentication
    if (!req.user || !req.user.id) {
      console.error('❌ User not authenticated');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
      where: { userId: req.user.id }
    });

    if (!wholesalerProfile) {
      console.error('❌ Wholesaler profile not found for user:', req.user.id);
      return res.status(404).json({
        error: 'Wholesaler profile not found',
        details: 'Please ensure you are logged in as a wholesaler'
      });
    }

    console.log('✅ Wholesaler profile found:', wholesalerProfile.id);

    // Extract fields from request body (matching frontend field names)
    const {
      name,
      description,
      sku,
      category,
      wholesale_price,  // Frontend sends wholesale_price
      cost_price,       // Frontend sends cost_price
      stock,
      unit,
      low_stock_threshold,
      invoice_number,
      barcode
    } = req.body;

    // Validate required fields
    if (!name || !category || !wholesale_price) {
      console.error('❌ Missing required fields');
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'category', 'wholesale_price'],
        received: { name, category, wholesale_price }
      });
    }

    // Validate wholesale_price is a valid number
    const parsedPrice = parseFloat(wholesale_price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      console.error('❌ Invalid wholesale_price:', wholesale_price);
      return res.status(400).json({
        error: 'Invalid wholesale price',
        details: 'Wholesale price must be a positive number'
      });
    }

    // Parse optional cost_price
    const parsedCostPrice = cost_price ? parseFloat(cost_price) : undefined;
    if (cost_price && (isNaN(parsedCostPrice!) || parsedCostPrice! < 0)) {
      console.error('❌ Invalid cost_price:', cost_price);
      return res.status(400).json({
        error: 'Invalid cost price',
        details: 'Cost price must be a positive number'
      });
    }

    // Parse stock
    const parsedStock = stock ? parseInt(stock) : 0;
    if (stock && (isNaN(parsedStock) || parsedStock < 0)) {
      console.error('❌ Invalid stock:', stock);
      return res.status(400).json({
        error: 'Invalid stock',
        details: 'Stock must be a non-negative integer'
      });
    }

    // Parse optional low_stock_threshold
    const parsedLowStockThreshold = low_stock_threshold ? parseInt(low_stock_threshold) : undefined;
    if (low_stock_threshold && (isNaN(parsedLowStockThreshold!) || parsedLowStockThreshold! < 0)) {
      console.error('❌ Invalid low_stock_threshold:', low_stock_threshold);
      return res.status(400).json({
        error: 'Invalid low stock threshold',
        details: 'Low stock threshold must be a non-negative integer'
      });
    }

    console.log('📦 Creating product with data:', {
      name,
      description,
      sku,
      category,
      price: parsedPrice,
      costPrice: parsedCostPrice,
      stock: parsedStock,
      unit,
      lowStockThreshold: parsedLowStockThreshold,
      invoiceNumber: invoice_number,
      barcode,
      wholesalerId: wholesalerProfile.id
    });

    const product = await prisma.product.create({
      data: {
        name,
        description,
        sku,
        category,
        price: parsedPrice,           // Store wholesale_price as price
        costPrice: parsedCostPrice,   // Store cost_price as costPrice
        stock: parsedStock,
        unit,
        lowStockThreshold: parsedLowStockThreshold,
        invoiceNumber: invoice_number,
        barcode,
        wholesalerId: wholesalerProfile.id
      }
    });

    console.log('✅ Product created successfully:', product.id);
    res.json({ success: true, product });
  } catch (error: any) {
    console.error('❌ Error creating product:', error);
    res.status(500).json({
      error: error.message,
      details: 'An unexpected error occurred while creating the product'
    });
  }
};

// Update product (general info)
export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category, sku, unit, low_stock_threshold, invoice_number, barcode, description } = req.body;

    const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
      where: { userId: req.user?.id }
    });

    if (!wholesalerProfile) {
      return res.status(404).json({ error: 'Wholesaler profile not found' });
    }

    const product = await prisma.product.update({
      where: {
        id,
        wholesalerId: wholesalerProfile.id // Ensure ownership
      },
      data: {
        name,
        category,
        sku,
        unit,
        lowStockThreshold: low_stock_threshold ? parseInt(low_stock_threshold) : undefined,
        invoiceNumber: invoice_number,
        barcode,
        description
      }
    });

    res.json({ success: true, product });
  } catch (error: any) {
    console.error('❌ Error updating product:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update stock
export const updateStock = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity, type, reason } = req.body; // type: 'add', 'remove', 'set'

    const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
      where: { userId: req.user?.id }
    });

    if (!wholesalerProfile) {
      return res.status(404).json({ error: 'Wholesaler profile not found' });
    }

    const currentProduct = await prisma.product.findUnique({
      where: { id, wholesalerId: wholesalerProfile.id }
    });

    if (!currentProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    let newStock = currentProduct.stock;
    const amount = parseInt(quantity);

    if (type === 'add') newStock += amount;
    else if (type === 'remove') newStock = Math.max(0, newStock - amount);
    else if (type === 'set') newStock = amount;

    const product = await prisma.product.update({
      where: { id },
      data: { stock: newStock }
    });

    // TODO: Log stock transaction/history if needed

    res.json({ success: true, product });
  } catch (error: any) {
    console.error('❌ Error updating stock:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update price
export const updatePrice = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { wholesale_price, cost_price } = req.body;

    const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
      where: { userId: req.user?.id }
    });

    if (!wholesalerProfile) {
      return res.status(404).json({ error: 'Wholesaler profile not found' });
    }

    const product = await prisma.product.update({
      where: { id, wholesalerId: wholesalerProfile.id },
      data: {
        price: wholesale_price ? parseFloat(wholesale_price) : undefined,
        costPrice: cost_price ? parseFloat(cost_price) : undefined
      }
    });

    res.json({ success: true, product });
  } catch (error: any) {
    console.error('❌ Error updating price:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete product
export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
      where: { userId: req.user?.id }
    });

    if (!wholesalerProfile) {
      return res.status(404).json({ error: 'Wholesaler profile not found' });
    }

    await prisma.product.delete({
      where: { id, wholesalerId: wholesalerProfile.id }
    });

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('❌ Error deleting product:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get retailer orders
export const getRetailerOrders = async (req: AuthRequest, res: Response) => {
  try {
    console.log('📋 Fetching orders for user:', req.user?.id);

    const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!wholesalerProfile) {
      console.error('❌ Wholesaler profile not found');
      return res.status(404).json({ error: 'Wholesaler profile not found' });
    }

    const orders = await prisma.order.findMany({
      where: { wholesalerId: wholesalerProfile.id },
      include: {
        items: {
          include: { product: true }
        },
        retailer: {
          include: { user: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`✅ Found ${orders.length} orders`);
    res.json({ orders, count: orders.length });
  } catch (error: any) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get single order with details
export const getOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    console.log('📋 Fetching order details for:', id);

    const wholesalerProfile = await prisma.wholesalerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!wholesalerProfile) {
      return res.status(404).json({ error: 'Wholesaler profile not found' });
    }

    const order = await prisma.order.findUnique({
      where: {
        id,
        wholesalerId: wholesalerProfile.id
      },
      include: {
        items: {
          include: { product: true }
        },
        retailer: {
          include: { user: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ order });
  } catch (error: any) {
    console.error('❌ Error fetching order details:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update order status
export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await prisma.order.update({
      where: { id },
      data: { status }
    });

    res.json({ success: true, order });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get credit requests (placeholder)
export const getCreditRequests = async (req: AuthRequest, res: Response) => {
  try {
    // This would require a CreditRequest model in the schema
    res.json({ requests: [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
