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
exports.deleteEmployee = exports.updateEmployee = exports.createEmployee = exports.getEmployees = exports.getProducts = exports.deleteCustomer = exports.updateCustomer = exports.createCustomer = exports.updateWholesalerStatus = exports.deleteWholesaler = exports.updateWholesaler = exports.verifyRetailer = exports.deleteRetailer = exports.updateRetailer = exports.deleteCategory = exports.updateCategory = exports.createCategory = exports.getCategories = exports.getNFCCards = exports.getLoans = exports.createWholesaler = exports.getWholesalers = exports.createRetailer = exports.getRetailers = exports.getCustomers = exports.getDashboard = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const auth_1 = require("../utils/auth");
// Get dashboard
const getDashboard = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const totalCustomers = yield prisma_1.default.consumerProfile.count();
        const totalRetailers = yield prisma_1.default.retailerProfile.count();
        const totalWholesalers = yield prisma_1.default.wholesalerProfile.count();
        const totalLoans = yield prisma_1.default.loan.count();
        const totalSales = yield prisma_1.default.sale.count();
        const totalRevenue = (yield prisma_1.default.sale.findMany()).reduce((sum, s) => sum + s.totalAmount, 0);
        res.json({
            success: true,
            totalCustomers,
            totalRetailers,
            totalWholesalers,
            totalLoans,
            totalSales,
            totalRevenue
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getDashboard = getDashboard;
// Get customers
const getCustomers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const customers = yield prisma_1.default.consumerProfile.findMany({
            include: { user: true }
        });
        res.json({ customers });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getCustomers = getCustomers;
// Get retailers
const getRetailers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const retailers = yield prisma_1.default.retailerProfile.findMany({
            include: { user: true }
        });
        res.json({ retailers });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getRetailers = getRetailers;
// Create retailer
const createRetailer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, business_name, phone, address, credit_limit } = req.body;
        const existingEmail = yield prisma_1.default.user.findFirst({ where: { email } });
        if (existingEmail)
            return res.status(400).json({ error: `User with email ${email} already exists` });
        const existingPhone = yield prisma_1.default.user.findFirst({ where: { phone } });
        if (existingPhone)
            return res.status(400).json({ error: `User with phone ${phone} already exists` });
        const hashedPassword = yield (0, auth_1.hashPassword)(password);
        const user = yield prisma_1.default.user.create({
            data: {
                email,
                phone,
                password: hashedPassword,
                role: 'retailer',
                name: business_name,
                isActive: true // Default to active?
            }
        });
        yield prisma_1.default.retailerProfile.create({
            data: {
                userId: user.id,
                shopName: business_name,
                address,
                creditLimit: credit_limit || 0
            }
        });
        res.json({ success: true, message: 'Retailer created successfully' });
    }
    catch (error) {
        console.error('Create Retailer Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.createRetailer = createRetailer;
// Get wholesalers
const getWholesalers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const wholesalers = yield prisma_1.default.wholesalerProfile.findMany({
            include: { user: true }
        });
        res.json({ wholesalers });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getWholesalers = getWholesalers;
// Create wholesaler
const createWholesaler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, company_name, phone, address } = req.body;
        const existingEmail = yield prisma_1.default.user.findFirst({ where: { email } });
        if (existingEmail)
            return res.status(400).json({ error: `User with email ${email} already exists` });
        const existingPhone = yield prisma_1.default.user.findFirst({ where: { phone } });
        if (existingPhone)
            return res.status(400).json({ error: `User with phone ${phone} already exists` });
        const hashedPassword = yield (0, auth_1.hashPassword)(password);
        const user = yield prisma_1.default.user.create({
            data: {
                email,
                phone,
                password: hashedPassword,
                role: 'wholesaler',
                name: company_name,
                isActive: true
            }
        });
        yield prisma_1.default.wholesalerProfile.create({
            data: {
                userId: user.id,
                companyName: company_name,
                address
            }
        });
        res.json({ success: true, message: 'Wholesaler created successfully' });
    }
    catch (error) {
        console.error('Create Wholesaler Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.createWholesaler = createWholesaler;
// Get loans
const getLoans = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const loans = yield prisma_1.default.loan.findMany({
            include: { consumerProfile: { include: { user: true } } }
        });
        res.json({ loans });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getLoans = getLoans;
// Get NFC cards
const getNFCCards = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cards = yield prisma_1.default.nfcCard.findMany({
            include: { consumerProfile: { include: { user: true } } }
        });
        res.json({ cards });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getNFCCards = getNFCCards;
// ==========================================
// CATEGORY MANAGEMENT
// ==========================================
const getCategories = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const categories = yield prisma_1.default.category.findMany({
            orderBy: { name: 'asc' }
        });
        res.json({ categories });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getCategories = getCategories;
const createCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, description, code } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Name is required' });
        }
        // Check if code exists
        if (code) {
            const existing = yield prisma_1.default.category.findUnique({ where: { code } });
            if (existing)
                return res.status(400).json({ error: 'Category code already exists' });
        }
        const category = yield prisma_1.default.category.create({
            data: {
                name,
                code: code || name.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
                description,
                isActive: true
            }
        });
        res.status(201).json({ success: true, category });
    }
    catch (error) {
        console.error('Create Category Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.createCategory = createCategory;
const updateCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, description, isActive } = req.body;
        const category = yield prisma_1.default.category.update({
            where: { id },
            data: { name, description, isActive }
        });
        res.json({ success: true, category });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.updateCategory = updateCategory;
const deleteCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield prisma_1.default.category.delete({ where: { id } });
        res.json({ success: true, message: 'Category deleted' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.deleteCategory = deleteCategory;
// ==========================================
// RETAILER MANAGEMENT (Extra CRUD)
// ==========================================
const updateRetailer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params; // RetailerProfile ID
        const { business_name, phone, address, credit_limit, status } = req.body;
        const retailer = yield prisma_1.default.retailerProfile.findUnique({ where: { id } });
        if (!retailer)
            return res.status(404).json({ error: 'Retailer not found' });
        // Check for duplicate phone on OTHER users
        if (phone) {
            const existingUser = yield prisma_1.default.user.findFirst({
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
        yield prisma_1.default.retailerProfile.update({
            where: { id },
            data: {
                shopName: business_name,
                address,
                creditLimit: Number(credit_limit),
            }
        });
        if (phone || business_name || status) {
            yield prisma_1.default.user.update({
                where: { id: retailer.userId },
                data: {
                    phone,
                    name: business_name,
                    isActive: status === 'active'
                }
            });
        }
        res.json({ success: true, message: 'Retailer updated' });
    }
    catch (error) {
        console.error('Update Retailer Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.updateRetailer = updateRetailer;
const deleteRetailer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const retailer = yield prisma_1.default.retailerProfile.findUnique({ where: { id } });
        if (retailer) {
            // Delete profile first to satisfy FK
            yield prisma_1.default.retailerProfile.delete({ where: { id } });
            // Then delete user
            yield prisma_1.default.user.delete({ where: { id: retailer.userId } });
        }
        res.json({ success: true, message: 'Retailer deleted' });
    }
    catch (error) {
        console.error('Delete Retailer Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.deleteRetailer = deleteRetailer;
const verifyRetailer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        // Check if retailer exists
        const retailer = yield prisma_1.default.retailerProfile.findUnique({ where: { id } });
        if (!retailer)
            return res.status(404).json({ error: 'Retailer not found' });
        // Update isVerified status
        yield prisma_1.default.retailerProfile.update({
            where: { id },
            data: { isVerified: true }
        });
        res.json({ success: true, message: 'Retailer verified successfully' });
    }
    catch (error) {
        console.error('Verify Retailer Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.verifyRetailer = verifyRetailer;
// ==========================================
// WHOLESALER MANAGEMENT (Extra CRUD)
// ==========================================
const updateWholesaler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { company_name, phone, address, status } = req.body;
        const wholesaler = yield prisma_1.default.wholesalerProfile.findUnique({ where: { id } });
        if (!wholesaler)
            return res.status(404).json({ error: 'Wholesaler not found' });
        // Check for duplicate phone on OTHER users
        if (phone) {
            const existingUser = yield prisma_1.default.user.findFirst({
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
        yield prisma_1.default.wholesalerProfile.update({
            where: { id },
            data: {
                companyName: company_name,
                address
            }
        });
        if (phone || company_name || status) {
            yield prisma_1.default.user.update({
                where: { id: wholesaler.userId },
                data: {
                    phone,
                    name: company_name,
                    isActive: status === 'active'
                }
            });
        }
        res.json({ success: true, message: 'Wholesaler updated' });
    }
    catch (error) {
        console.error('Update Wholesaler Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.updateWholesaler = updateWholesaler;
const deleteWholesaler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const wholesaler = yield prisma_1.default.wholesalerProfile.findUnique({ where: { id } });
        if (wholesaler) {
            // Delete profile first to satisfy FK
            yield prisma_1.default.wholesalerProfile.delete({ where: { id } });
            // Then delete user
            yield prisma_1.default.user.delete({ where: { id: wholesaler.userId } });
        }
        res.json({ success: true, message: 'Wholesaler deleted' });
    }
    catch (error) {
        console.error('Delete Wholesaler Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.deleteWholesaler = deleteWholesaler;
const updateWholesalerStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { isActive, status } = req.body;
        const wholesaler = yield prisma_1.default.wholesalerProfile.findUnique({ where: { id } });
        if (!wholesaler)
            return res.status(404).json({ error: 'Wholesaler not found' });
        // Determine new status (support both formats for backward compatibility/safety)
        let newStatus = false;
        if (typeof isActive === 'boolean') {
            newStatus = isActive;
        }
        else if (status === 'active') {
            newStatus = true;
        }
        // Update User status (since login depends on User.isActive)
        yield prisma_1.default.user.update({
            where: { id: wholesaler.userId },
            data: {
                isActive: newStatus
            }
        });
        res.json({ success: true, message: `Wholesaler status updated to ${newStatus ? 'active' : 'inactive'}` });
    }
    catch (error) {
        console.error('Update Wholesaler Status Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.updateWholesalerStatus = updateWholesalerStatus;
// ==========================================
// CUSTOMER MANAGEMENT (Extra CRUD)
// ==========================================
const createCustomer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { firstName, lastName, email, phone, password } = req.body;
        if (!email || !phone) {
            return res.status(400).json({ error: 'Email and Phone are required' });
        }
        const existingEmail = yield prisma_1.default.user.findFirst({ where: { email } });
        if (existingEmail) {
            return res.status(400).json({ error: `User with email ${email} already exists` });
        }
        const existingPhone = yield prisma_1.default.user.findFirst({ where: { phone } });
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
        const hashedPassword = yield (0, auth_1.hashPassword)(password || '123456'); // Default pin/pass
        const user = yield prisma_1.default.user.create({
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
    }
    catch (error) {
        console.error('Create Customer Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.createCustomer = createCustomer;
const updateCustomer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params; // ConsumerProfile ID
        const { firstName, lastName, email, phone, status } = req.body;
        const profile = yield prisma_1.default.consumerProfile.findUnique({ where: { id } });
        if (!profile)
            return res.status(404).json({ error: 'Customer not found' });
        // Check if email/phone is taken by ANOTHER user
        if (email || phone) {
            const existingUser = yield prisma_1.default.user.findFirst({
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
        yield prisma_1.default.user.update({
            where: { id: profile.userId },
            data: {
                name: `${firstName} ${lastName}`,
                email,
                phone,
                isActive: status === 'active'
            }
        });
        yield prisma_1.default.consumerProfile.update({
            where: { id },
            data: { fullName: `${firstName} ${lastName}` }
        });
        res.json({ success: true, message: 'Customer updated' });
    }
    catch (error) {
        console.error('Update Customer Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.updateCustomer = updateCustomer;
const deleteCustomer = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const profile = yield prisma_1.default.consumerProfile.findUnique({ where: { id } });
        if (profile) {
            // Must delete the profile (child) first because it references the user (parent)
            yield prisma_1.default.consumerProfile.delete({ where: { id } });
            // Now safe to delete the user
            yield prisma_1.default.user.delete({ where: { id: profile.userId } });
        }
        res.json({ success: true, message: 'Customer deleted' });
    }
    catch (error) {
        console.error('Delete Customer Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.deleteCustomer = deleteCustomer;
// Get all products
const getProducts = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const products = yield prisma_1.default.product.findMany({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getProducts = getProducts;
// ==========================================
// EMPLOYEE MANAGEMENT
// ==========================================
// Get All Employees
const getEmployees = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const employees = yield prisma_1.default.employeeProfile.findMany({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getEmployees = getEmployees;
// Create Employee
const createEmployee = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { firstName, lastName, email, phone, department, position, salary, dateOfJoining, bankAccount, password // Get password from request
         } = req.body;
        const fullName = `${firstName} ${lastName}`;
        // check existing
        const existingUser = yield prisma_1.default.user.findFirst({
            where: { OR: [{ email }, { phone }] }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email or phone already exists' });
        }
        // Generate random password or use default
        const finalPassword = password || 'employee123';
        const hashedPassword = yield (0, auth_1.hashPassword)(finalPassword);
        // Generate Employee Number (simple auto-increment logic or random)
        const count = yield prisma_1.default.employeeProfile.count();
        const employeeNumber = `EMP${(count + 1).toString().padStart(3, '0')}`;
        // Transaction to create User and Profile
        const result = yield prisma_1.default.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
            const user = yield prisma.user.create({
                data: {
                    email,
                    phone,
                    name: fullName,
                    password: hashedPassword,
                    role: 'employee',
                    isActive: true
                }
            });
            const profile = yield prisma.employeeProfile.create({
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
        }));
        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            employee: result
        });
    }
    catch (error) {
        console.error('Create Employee Error:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.createEmployee = createEmployee;
// Update Employee
const updateEmployee = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params; // This is the EmployeeProfile ID
        const { firstName, lastName, email, phone, department, position, salary, status, dateOfJoining, bankAccount } = req.body;
        const fullName = `${firstName} ${lastName}`;
        // Find profile first
        const profile = yield prisma_1.default.employeeProfile.findUnique({
            where: { id },
            include: { user: true }
        });
        if (!profile) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        // Update User and Profile
        yield prisma_1.default.$transaction([
            prisma_1.default.user.update({
                where: { id: profile.userId },
                data: {
                    name: fullName,
                    email,
                    phone,
                    isActive: status === 'active'
                }
            }),
            prisma_1.default.employeeProfile.update({
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.updateEmployee = updateEmployee;
// Delete Employee
const deleteEmployee = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params; // EmployeeProfile ID
        const profile = yield prisma_1.default.employeeProfile.findUnique({
            where: { id }
        });
        if (!profile) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        // Delete User (Cascade will handle profile deletion if configured, but let's be explicit or rely on schema)
        // In our updated schema we added onDelete: Cascade to the relation.
        // So deleting the User deletes the Profile.
        yield prisma_1.default.user.delete({
            where: { id: profile.userId }
        });
        res.json({ success: true, message: 'Employee deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.deleteEmployee = deleteEmployee;
