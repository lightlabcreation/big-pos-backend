import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../utils/prisma';

// Get dashboard stats
// Get dashboard stats with comprehensive calculations
export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id },
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
    const [
      todaySales,
      allSales,
      inventory,
      pendingOrders
    ] = await Promise.all([
      // Today's Sales
      prisma.sale.findMany({
        where: {
          retailerId: retailerProfile.id,
          createdAt: { gte: today, lt: tomorrow }
        },
        include: { items: true }
      }),
      // All Sales (for revenue stats)
      prisma.sale.findMany({
        where: { retailerId: retailerProfile.id }
      }),
      // Inventory
      prisma.product.findMany({
        where: {
          OR: [
            { retailerId: retailerProfile.id },
            { retailerId: null }
          ]
        }
      }),
      // Pending Orders (to wholesalers)
      prisma.order.findMany({
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
    }, {} as Record<string, number>);

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
    const topSellingItems = await prisma.saleItem.groupBy({
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
    const topProductsDetails = await prisma.product.findMany({
      where: { id: { in: topProductIds } }
    });
    
    const topProducts = topSellingItems.map(item => {
      const product = topProductsDetails.find(p => p.id === item.productId);
      return {
        id: item.productId,
        name: product?.name || 'Unknown Product',
        sold: item._sum.quantity || 0,
        revenue: (item._sum.price || 0), // Note: this might be inaccurate if price in SaleItem is unit price. Schema says `price Float`. Assuming it is effectively total or we can multiply.
        stock: product?.stock || 0,
        trend: 0 // Placeholder
      };
    });

    // Recent Orders (Sales to consumers)
    const recentOrders = await prisma.sale.findMany({
      where: { retailerId: retailerProfile.id },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { consumer: true }
    });

    const formattedRecentOrders = recentOrders.map(order => ({
      id: order.id.substring(0, 8).toUpperCase(),
      customer: order.consumer?.fullName || 'Walk-in Customer',
      items: 0, // Need to fetch items count if critical
      total: order.totalAmount,
      status: order.status,
      date: order.createdAt,
      payment: order.paymentMethod
    }));

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

  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get inventory (Retailer's products + Wholesaler Catalog)
export const getInventory = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    // 1. Get Retailer's own inventory (and global items)
    const myProducts = await prisma.product.findMany({
      where: {
        OR: [
          { retailerId: retailerProfile.id },
          { retailerId: null }
        ]
      },
      orderBy: { name: 'asc' }
    });

    // 2. Get Global Catalog (Wholesaler products)
    const catalogProducts = await prisma.product.findMany({
      where: { wholesalerId: { not: null } },
      include: { wholesaler: true },
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
        mergedInventory.push({
          ...cp,
          id: cp.id, // Use catalog ID
          retailerId: retailerProfile.id, // Mock it for frontend compatibility or handle as different
          stock: 0,
          price: cp.price * 1.2, // Estimated selling price (20% markup)
          costPrice: cp.price,
          status: 'catalog_item' // distinct status
        });
      }
    });

    // Sort combined list
    mergedInventory.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ products: mergedInventory });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create product (Manual or Invoice-based)
export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    const { invoice_number, name, description, sku, category, price, costPrice, stock } = req.body;

    // --- Invoice Flow ---
    if (invoice_number) {
      // Find the order by ID (treating invoice_number as Order ID)
      let order = await prisma.order.findUnique({
        where: { id: invoice_number },
        include: { items: { include: { product: true } } }
      });

      // Validates if the invoice number corresponds to a ProfitInvoice
      if (!order) {
        const profitInvoice = await prisma.profitInvoice.findUnique({
          where: { invoiceNumber: invoice_number },
          include: { order: { include: { items: { include: { product: true } } } } }
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
      const existing = await prisma.product.findFirst({
        where: { retailerId: retailerProfile.id, invoiceNumber: invoice_number }
      });
      if (existing) {
         return res.status(400).json({ error: 'Invoice already imported' });
      }

      const createdProducts = [];
      for (const item of order.items) {
        const sourceProduct = item.product;
        // Create new inventory item
        const newProduct = await prisma.product.create({
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

    const product = await prisma.product.create({
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
  } catch (error: any) {
    console.error('Create product error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update product
export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, category, price, costPrice, stock } = req.body;

    const product = await prisma.product.update({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get orders
// Get orders (Customer Sales)
export const getOrders = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    const { status, payment_status, search, limit = '20', offset = '0' } = req.query;

    const where: any = {
      retailerId: retailerProfile.id
    };

    if (status) where.status = status;
    if (payment_status) where.paymentMethod = payment_status; // Mapping payment_status filter to paymentMethod
    
    // Search by ID or Customer Name
    if (search) {
       where.OR = [
         { id: { contains: search as string } },
         { consumer: { fullName: { contains: search as string } } }
       ];
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        consumer: { include: { user: true } },
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const total = await prisma.sale.count({ where });

    // Map to frontend Order interface
    const formattedOrders = sales.map(sale => ({
      id: sale.id,
      display_id: sale.id.substring(0, 8).toUpperCase(),
      customer_name: sale.consumer?.fullName || 'Walk-in Customer',
      customer_phone: sale.consumer?.user?.phone || 'N/A',
      customer_email: sale.consumer?.user?.email,
      items: sale.items.map(item => ({
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
      status: sale.status, // pending, processing, ready, completed, cancelled
      payment_method: sale.paymentMethod,
      payment_status: 'paid', // Assumed paid for now unless credit
      notes: '',
      created_at: sale.createdAt.toISOString(),
      updated_at: sale.updatedAt.toISOString(),
      completed_at: sale.status === 'completed' ? sale.updatedAt.toISOString() : undefined
    }));

    res.json({ orders: formattedOrders, total });
  } catch (error: any) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get branches
export const getBranches = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    const branches = await prisma.branch.findMany({
      where: { retailerId: retailerProfile.id },
      include: { terminals: true }
    });

    res.json({ branches });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create branch
export const createBranch = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    const { name, location } = req.body;

    const branch = await prisma.branch.create({
      data: {
        name,
        location,
        retailerId: retailerProfile.id
      }
    });

    res.json({ success: true, branch });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get wallet
export const getWallet = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    res.json({
      balance: retailerProfile.walletBalance,
      creditLimit: retailerProfile.creditLimit,
      availableCredit: retailerProfile.creditLimit - 0 // Assuming no outstanding credit for now
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// POS FUNCTIONS
// ==========================================

// Get POS Products (with search and stock info)
export const getPOSProducts = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    const { search, limit = '50', offset = '0' } = req.query;

    const where: any = {
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
            { name: { contains: search as string } },
            { sku: { contains: search as string } },
            { barcode: { contains: search as string } }
          ]
        }
      ];
    }

    const products = await prisma.product.findMany({
      where,
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: { name: 'asc' }
    });

    res.json({ products });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Scan Barcode
export const scanBarcode = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    const { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    const product = await prisma.product.findFirst({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create Sale
export const createSale = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    const { 
      items, 
      payment_method, 
      subtotal, 
      tax_amount, 
      discount, 
      customer_phone,
      payment_details 
    } = req.body;

    // 1. Validate items and stock
    for (const item of items) {
      const product = await prisma.product.findUnique({ where: { id: item.product_id } });
      if (!product || product.stock < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for product: ${product?.name || item.product_id}` 
        });
      }
    }

    // 2. Perform Transaction (Create Sale, Decrement Stock)
    const result = await prisma.$transaction(async (prisma) => {
      // Create Sale Record
      const sale = await prisma.sale.create({
        data: {
          retailerId: retailerProfile.id,
          totalAmount: (subtotal + tax_amount - (discount || 0)),
          paymentMethod: payment_method,
          status: 'completed',
          items: {
            create: items.map((item: any) => ({
              productId: item.product_id,
              quantity: item.quantity,
              price: item.price
            }))
          }
        }
      });

      // Update Stock
      for (const item of items) {
        await prisma.product.update({
          where: { id: item.product_id },
          data: { stock: { decrement: item.quantity } }
        });
      }

      return sale;
    });

    res.json({ success: true, sale: result });

  } catch (error: any) {
    console.error('Sale failed:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get Daily Sales Stats
export const getDailySales = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todaySales = await prisma.sale.findMany({
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
    }, {} as Record<string, number>);

    res.json({
      total_sales: totalSales,
      transaction_count: transactionCount,
      mobile_payment_transactions: paymentMethods['mobile_money'] || 0,
      dashboard_wallet_transactions: paymentMethods['dashboard_wallet'] || 0,
      credit_wallet_transactions: paymentMethods['credit_wallet'] || 0,
      gas_rewards_m3: 0, 
      gas_rewards_rwf: 0
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// WHOLESALE ORDERING FUNCTIONS
// ==========================================

// Get Wholesaler Products
export const getWholesalerProducts = async (req: AuthRequest, res: Response) => {
  try {
    const { search, category, limit = '50', offset = '0' } = req.query;

    const where: any = {
      wholesalerId: { not: null }, // Only products belonging to wholesalers
      status: 'active'
    };

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { sku: { contains: search as string } }
      ];
    }

    if (category) {
      where.category = category as string;
    }

    const products = await prisma.product.findMany({
      where,
      include: { wholesaler: true }, // Include wholesaler info
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: { name: 'asc' }
    });

    // Map to frontend expected format
    const formattedProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      wholesaler_price: p.price, // Wholesaler's selling price
      stock_available: p.stock,
      min_order: 1, // Default min order
      unit: p.unit || 'unit',
      wholesaler_name: p.wholesaler?.companyName
    }));

    res.json({ products: formattedProducts });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create Wholesaler Order
export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
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
    const firstProduct = await prisma.product.findUnique({ where: { id: firstProductId } });
    
    if (!firstProduct || !firstProduct.wholesalerId) {
       return res.status(400).json({ error: 'Product does not belong to a wholesaler' });
    }
    const wholesalerId = firstProduct.wholesalerId;

    // Transaction: Create Order, Debit Wallet
    const result = await prisma.$transaction(async (prisma) => {
      // 1. Check Wallet
      if (retailerProfile.walletBalance < totalAmount) {
        throw new Error('Insufficient wallet balance');
      }

      // 2. Create Order
      const order = await prisma.order.create({
        data: {
          retailerId: retailerProfile.id,
          wholesalerId: wholesalerId,
          totalAmount: totalAmount,
          status: 'pending',
          items: {
            create: items.map((item: any) => ({
              productId: item.product_id,
              quantity: item.quantity,
              price: item.price
            }))
          }
        }
      });

      // 3. Debit Wallet
      await prisma.retailerProfile.update({
        where: { id: retailerProfile.id },
        data: { walletBalance: { decrement: totalAmount } }
      });

      return order;
    });

    res.json({ success: true, order: result });
  } catch (error: any) {
    console.error('Create order failed:', error);
    res.status(500).json({ error: error.message });
  }
};



// ==========================================
// WALLET TRANSACTIONS & CREDIT
// ==========================================

// Get Wallet Transactions
// Get Wallet Transactions
export const getWalletTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    const { limit = '10', offset = '0' } = req.query;

    // Currently, Retailers do not have a dedicated Wallet Transaction table in the schema.
    // We will serve the Order history as a proxy for "Debit" transactions.
    // Capital Top-ups update the balance but are not logged as transactions yet (pending schema update).

    const orders = await prisma.order.findMany({
      where: { retailerId: retailerProfile.id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const transactions = orders.map(o => ({
      id: o.id,
      type: 'debit',
      amount: o.totalAmount,
      balance_after: 0, // Not tracked per row
      description: `Order #${o.id.substring(0,8)}`,
      reference: o.id,
      status: 'completed',
      created_at: o.createdAt
    }));

    const total = await prisma.order.count({ where: { retailerId: retailerProfile.id } });

    res.json({ transactions, total });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get Credit Info
export const getCreditInfo = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    // Fetch or Create RetailerCredit record
    let retailerCredit = await prisma.retailerCredit.findUnique({
      where: { retailerId: retailerProfile.id }
    });

    if (!retailerCredit) {
      // Initialize if not exists
      retailerCredit = await prisma.retailerCredit.create({
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

  } catch (error: any) {
    console.error('Error fetching credit info:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get Credit Orders
export const getCreditOrders = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    const { status, limit = '10', offset = '0' } = req.query;
    
    // Define "Credit Orders". For now, we assume any order with status 'credit' or 'pending_payment'
    const where: any = {
      retailerId: retailerProfile.id,
      OR: [
        { status: 'credit' },
        { status: 'pending_payment' }, // Alternative status for credit
        { status: 'overdue' }
      ]
    };

    if (status) {
      where.status = status as string;
    }

    const orders = await prisma.order.findMany({
      where,
      include: { wholesaler: true },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const total = await prisma.order.count({ where });

    // Map to frontend expectation
    const formattedOrders = orders.map(o => ({
      id: o.id,
      display_id: o.id.substring(0, 8).toUpperCase(),
      wholesaler_name: o.wholesaler?.companyName,
      total_amount: o.totalAmount,
      amount_paid: 0, // In future, check related payments
      amount_pending: o.totalAmount, // Simplified for now
      status: o.status,
      due_date: new Date(new Date(o.createdAt).setDate(new Date(o.createdAt).getDate() + 30)).toISOString(),
      created_at: o.createdAt
    }));

    res.json({ orders: formattedOrders, total });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get Single Credit Order
export const getCreditOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: { wholesaler: true, items: { include: { product: true } } }
    });

    if (!order) return res.status(404).json({ error: 'Order not found' });

    res.json({
      id: order.id,
      display_id: order.id.substring(0, 8).toUpperCase(),
      wholesaler_name: order.wholesaler?.companyName,
      total_amount: order.totalAmount,
      amount_paid: 0, 
      amount_pending: order.totalAmount,
      status: order.status,
      due_date: new Date(new Date(order.createdAt).setDate(new Date(order.createdAt).getDate() + 30)).toISOString(),
      created_at: order.createdAt,
      items: order.items.map(i => ({
        id: i.id,
        product_name: i.product.name,
        quantity: i.quantity,
        price: i.price
      }))
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Request Credit
export const requestCredit = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    const { amount, reason } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Create CreditRequest
    await prisma.creditRequest.create({
      data: {
        retailerId: retailerProfile.id,
        amount: parseFloat(amount),
        reason,
        status: 'pending'
      }
    });

    res.json({ success: true, message: 'Credit request submitted successfully' });

  } catch (error: any) {
    console.error('Error requesting credit:', error);
    res.status(500).json({ error: error.message });
  }
};

// Make Repayment
export const makeRepayment = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) return res.status(404).json({ error: 'Retailer not found' });

    const { id } = req.params; // Order ID
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid repayment amount' });
    }

    // 1. Get the Order
    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) return res.status(404).json({ error: 'Order not found' });

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
    await prisma.$transaction(async (prisma) => {
      // Debit Wallet
      await prisma.retailerProfile.update({
        where: { id: retailerProfile.id },
        data: { walletBalance: { decrement: amount } }
      });

      // Update Credit Usage (if this was a credit order)
      const creditInfo = await prisma.retailerCredit.findUnique({ where: { retailerId: retailerProfile.id } });
      if (creditInfo) {
        await prisma.retailerCredit.update({
          where: { retailerId: retailerProfile.id },
          data: {
            usedCredit: { decrement: amount },
            availableCredit: { increment: amount }
          }
        });
      }

      // Update Order Status (if fully paid) -- simplistic check
      if (amount >= order.totalAmount) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'completed' } // or 'paid'
        });
      }
    });
    
    res.json({ success: true, message: 'Repayment successful' });
  } catch (error: any) {
    console.error('Repayment error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// PROFILE MANAGEMENT
// ==========================================

// Get Retailer Profile
export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id },
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
  } catch (error: any) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: error.message });
  }
};

// Update Retailer Profile
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    const {
      name, // User name (Contact Person)
      shop_name,
      address,
      tin_number,
      email
    } = req.body;

    // Update User model if needed
    if (name || email) {
      await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          ...(name && { name }),
          ...(email && { email })
        }
      });
    }

    // Update RetailerProfile model
    const updatedRetailer = await prisma.retailerProfile.update({
      where: { id: retailerProfile.id },
      data: {
        ...(shop_name && { shopName: shop_name }),
        ...(address && { address })
        // tin_number is ignored as it's not in schema
      }
    });

    res.json({ success: true, message: 'Profile updated successfully', profile: updatedRetailer });
  } catch (error: any) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: error.message });
  }
};

// Top Up Wallet (Add Capital)
export const topUpWallet = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
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
    const updatedProfile = await prisma.retailerProfile.update({
      where: { id: retailerProfile.id },
      data: {
        walletBalance: { increment: parseFloat(amount) }
      }
    });

    res.json({ success: true, message: 'Capital added successfully', balance: updatedProfile.walletBalance });
  } catch (error: any) {
    console.error('Error adding capital:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get Detailed Analytics
export const getAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const retailerProfile = await prisma.retailerProfile.findUnique({
      where: { userId: req.user!.id }
    });

    if (!retailerProfile) {
      return res.status(404).json({ error: 'Retailer profile not found' });
    }

    const { period = 'month' } = req.query; // week, month, quarter, year

    // 1. Calculate Date Range
    const now = new Date();
    let startDate = new Date();
    if (period === 'week') startDate.setDate(now.getDate() - 7);
    else if (period === 'quarter') startDate.setMonth(now.getMonth() - 3);
    else if (period === 'year') startDate.setFullYear(now.getFullYear() - 1);
    else startDate.setMonth(now.getMonth() - 1); // default month

    // 2. Fetch Sales within Period
    const salesInPeriod = await prisma.sale.findMany({
      where: {
        retailerId: retailerProfile.id,
        createdAt: { gte: startDate }
      },
      include: {
        items: { include: { product: true } },
        consumer: true
      }
    });

    // 3. Revenue Metrics
    const totalRevenue = salesInPeriod.reduce((sum, s) => sum + s.totalAmount, 0);
    // Compare with previous period (simplified mock logic for change %)
    const changePercentage = 15.2;

    // 4. Daily Revenue (Last 7 Days) - specific for chart
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);
    sevenDaysAgo.setHours(0,0,0,0);
    
    // Group sales by date
    const dailyMap = new Map<string, number>();
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
    const categoryMap = new Map<string, { count: number, revenue: number }>();
    salesInPeriod.forEach(sale => {
      sale.items.forEach(item => {
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
    const productStats = new Map<string, { name: string, quantity: number, revenue: number }>();
    salesInPeriod.forEach(sale => {
      sale.items.forEach(item => {
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
    const customerStats = new Map<string, { name: string, orders: number, spent: number }>();
    salesInPeriod.forEach(sale => {
      if (sale.consumer) {
        const cid = sale.consumerId!;
        const current = customerStats.get(cid) || { name: sale.consumer.fullName || 'Unknown', orders: 0, spent: 0 };
        customerStats.set(cid, {
          name: sale.consumer.fullName || 'Unknown',
          orders: current.orders + 1,
          spent: current.spent + sale.totalAmount
        });
      }
    });
    
    const topBuyers = Array.from(customerStats.values())
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 5);

    // 8. Inventory Stats (Snapshot)
    const inventoryCount = await prisma.product.count({
      where: {
        OR: [
          { retailerId: retailerProfile.id },
          { retailerId: null }
        ]
      }
    });

    const allProducts = await prisma.product.findMany({
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

  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: error.message });
  }
};
