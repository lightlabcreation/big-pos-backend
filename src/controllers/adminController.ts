import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../utils/prisma';
import { hashPassword } from '../utils/auth';

// Get dashboard
export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const totalCustomers = await prisma.consumerProfile.count();
    const totalRetailers = await prisma.retailerProfile.count();
    const totalWholesalers = await prisma.wholesalerProfile.count();
    const totalLoans = await prisma.loan.count();
    const totalSales = await prisma.sale.count();

    const totalRevenue = (await prisma.sale.findMany()).reduce((sum, s) => sum + s.totalAmount, 0);

    res.json({
      success: true,
      totalCustomers,
      totalRetailers,
      totalWholesalers,
      totalLoans,
      totalSales,
      totalRevenue
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get customers
export const getCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const customers = await prisma.consumerProfile.findMany({
      include: { user: true }
    });
    res.json({ customers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

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

// Create retailer
export const createRetailer = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, business_name, phone, address, credit_limit } = req.body;

    const existingEmail = await prisma.user.findFirst({ where: { email } });
    if (existingEmail) return res.status(400).json({ error: `User with email ${email} already exists` });

    const existingPhone = await prisma.user.findFirst({ where: { phone } });
    if (existingPhone) return res.status(400).json({ error: `User with phone ${phone} already exists` });

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
    res.json({ wholesalers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create wholesaler
export const createWholesaler = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, company_name, phone, address } = req.body;

    const existingEmail = await prisma.user.findFirst({ where: { email } });
    if (existingEmail) return res.status(400).json({ error: `User with email ${email} already exists` });

    const existingPhone = await prisma.user.findFirst({ where: { phone } });
    if (existingPhone) return res.status(400).json({ error: `User with phone ${phone} already exists` });

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
      include: { consumer: { include: { user: true } } }
    });
    res.json({ loans });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Get NFC cards
export const getNFCCards = async (req: AuthRequest, res: Response) => {
  try {
    const cards = await prisma.nfcCard.findMany({
      include: { consumer: { include: { user: true } } }
    });
    res.json({ cards });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
    res.json({ categories });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, code } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // Check if code exists
    if (code) {
      const existing = await prisma.category.findUnique({ where: { code } });
      if (existing) return res.status(400).json({ error: 'Category code already exists' });
    }

    const category = await prisma.category.create({
      data: {
        name,
        code: code || name.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
        description,
        isActive: true
      }
    });
    res.status(201).json({ success: true, category });
  } catch (error: any) {
    console.error('Create Category Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;
    const category = await prisma.category.update({
      where: { id },
      data: { name, description, isActive }
    });
    res.json({ success: true, category });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCategory = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.category.delete({ where: { id } });
    res.json({ success: true, message: 'Category deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// RETAILER MANAGEMENT (Extra CRUD)
// ==========================================

export const updateRetailer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params; // RetailerProfile ID
    const { business_name, phone, address, credit_limit, status } = req.body;

    const retailer = await prisma.retailerProfile.findUnique({ where: { id } });
    if (!retailer) return res.status(404).json({ error: 'Retailer not found' });

    // Check for duplicate phone on OTHER users
    if (phone) {
      const existingUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: retailer.userId } },
            { phone }
          ]
        }
      });
      if (existingUser) {
        return res.status(400).json({ error: `Phone ${phone} is already in use` });
      }
    }

    await prisma.retailerProfile.update({
      where: { id },
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
    const retailer = await prisma.retailerProfile.findUnique({ where: { id } });
    if (retailer) {
      // Delete profile first to satisfy FK
      await prisma.retailerProfile.delete({ where: { id } });
      // Then delete user
      await prisma.user.delete({ where: { id: retailer.userId } });
    }
    res.json({ success: true, message: 'Retailer deleted' });
  } catch (error: any) {
    console.error('Delete Retailer Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// WHOLESALER MANAGEMENT (Extra CRUD)
// ==========================================

export const updateWholesaler = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { company_name, phone, address, status } = req.body;

    const wholesaler = await prisma.wholesalerProfile.findUnique({ where: { id } });
    if (!wholesaler) return res.status(404).json({ error: 'Wholesaler not found' });

    // Check for duplicate phone on OTHER users
    if (phone) {
      const existingUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: wholesaler.userId } },
            { phone }
          ]
        }
      });
      if (existingUser) {
        return res.status(400).json({ error: `Phone ${phone} is already in use` });
      }
    }

    await prisma.wholesalerProfile.update({
      where: { id },
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
    const wholesaler = await prisma.wholesalerProfile.findUnique({ where: { id } });
    if (wholesaler) {
      // Delete profile first to satisfy FK
      await prisma.wholesalerProfile.delete({ where: { id } });
      // Then delete user
      await prisma.user.delete({ where: { id: wholesaler.userId } });
    }
    res.json({ success: true, message: 'Wholesaler deleted' });
  } catch (error: any) {
    console.error('Delete Wholesaler Error:', error);
    res.status(500).json({ error: error.message });
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

    const existingEmail = await prisma.user.findFirst({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ error: `User with email ${email} already exists` });
    }

    const existingPhone = await prisma.user.findFirst({ where: { phone } });
    if (existingPhone) {
      return res.status(400).json({ error: `User with phone ${phone} already exists` });
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

    const profile = await prisma.consumerProfile.findUnique({ where: { id } });
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
      where: { id },
      data: { fullName: `${firstName} ${lastName}` }
    });

    res.json({ success: true, message: 'Customer updated' });
  } catch (error: any) {
    console.error('Update Customer Error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const profile = await prisma.consumerProfile.findUnique({ where: { id } });

    if (profile) {
      // Must delete the profile (child) first because it references the user (parent)
      await prisma.consumerProfile.delete({ where: { id } });

      // Now safe to delete the user
      await prisma.user.delete({ where: { id: profile.userId } });
    }

    res.json({ success: true, message: 'Customer deleted' });
  } catch (error: any) {
    console.error('Delete Customer Error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get all products
export const getProducts = async (req: AuthRequest, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        retailer: {
          select: { shopName: true }
        },
        wholesaler: {
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
      where: { id },
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
        where: { id },
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
      where: { id }
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
