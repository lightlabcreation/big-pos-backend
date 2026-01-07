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
exports.login = exports.register = void 0;
const prisma_1 = __importDefault(require("../utils/prisma"));
const auth_1 = require("../utils/auth");
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password, phone, pin, role, first_name, last_name, business_name, shop_name, company_name } = req.body;
        // Determine role from URL if not provided
        let targetRole = role;
        if (!targetRole) {
            if (req.baseUrl.includes('store'))
                targetRole = 'consumer';
            else if (req.baseUrl.includes('retailer'))
                targetRole = 'retailer';
            else if (req.baseUrl.includes('wholesaler'))
                targetRole = 'wholesaler';
        }
        // Check existing user
        const existingUser = yield prisma_1.default.user.findFirst({
            where: {
                OR: [
                    { email: email || undefined },
                    { phone: phone || undefined }
                ]
            }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        const hashedPassword = password ? yield (0, auth_1.hashPassword)(password) : undefined;
        const hashedPin = pin ? yield (0, auth_1.hashPassword)(pin) : undefined;
        const user = yield prisma_1.default.user.create({
            data: {
                email,
                phone,
                password: hashedPassword,
                pin: hashedPin, // Store pin (hashed)
                role: targetRole,
                name: first_name ? `${first_name} ${last_name || ''}`.trim() : (business_name || company_name || shop_name),
            }
        });
        // Create Profile
        if (targetRole === 'consumer') {
            yield prisma_1.default.consumerProfile.create({
                data: {
                    userId: user.id
                }
            });
        }
        else if (targetRole === 'retailer') {
            yield prisma_1.default.retailerProfile.create({
                data: {
                    userId: user.id,
                    shopName: shop_name || business_name || 'My Shop',
                    address: req.body.address
                }
            });
        }
        else if (targetRole === 'wholesaler') {
            yield prisma_1.default.wholesalerProfile.create({
                data: {
                    userId: user.id,
                    companyName: company_name || 'My Company',
                    address: req.body.address
                }
            });
        }
        const token = (0, auth_1.generateToken)({ id: user.id, role: user.role });
        res.json({
            success: true,
            access_token: token,
            user_id: user.id,
            message: 'Registration successful'
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const { email, password, phone, pin } = req.body;
        let targetRole = req.body.role;
        if (!targetRole) {
            if (req.baseUrl.includes('store'))
                targetRole = 'consumer';
            else if (req.baseUrl.includes('retailer'))
                targetRole = 'retailer';
            else if (req.baseUrl.includes('wholesaler'))
                targetRole = 'wholesaler';
            else if (req.baseUrl.includes('employee'))
                targetRole = 'employee';
            else if (req.baseUrl.includes('admin'))
                targetRole = 'admin';
        }
        // Find User
        const user = yield prisma_1.default.user.findFirst({
            where: {
                OR: [
                    { email: email || undefined },
                    { phone: phone || undefined }
                ],
                role: targetRole // Ensure role matches
            },
            include: {
                consumerProfile: true,
                retailerProfile: true,
                wholesalerProfile: true,
                employeeProfile: true
            }
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials or role' });
        }
        // Verify Password or PIN
        let valid = false;
        if (targetRole === 'consumer') {
            // Allow plain PIN compare for now if hashed fails, or just assuming hashed. 
            // User might be sending plain PIN. I should hash it.
            // Actually, for "A to Z" I should do it properly.
            if (user.pin && (yield (0, auth_1.comparePassword)(pin, user.pin)))
                valid = true;
        }
        else {
            if (user.password && (yield (0, auth_1.comparePassword)(password, user.password)))
                valid = true;
        }
        if (!valid) {
            // Fallback for "demo" usage - if strict auth fails, check for mocked credentials?
            // No, I'm building a real backend. Validation must pass.
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = (0, auth_1.generateToken)({ id: user.id, role: user.role });
        // Format Response
        const responseData = {
            success: true,
            access_token: token,
        };
        if (targetRole === 'consumer') {
            responseData.customer = Object.assign({ id: user.id, email: user.email, phone: user.phone, first_name: (_a = user.name) === null || _a === void 0 ? void 0 : _a.split(' ')[0], last_name: (_b = user.name) === null || _b === void 0 ? void 0 : _b.split(' ').slice(1).join(' ') }, user.consumerProfile);
        }
        else if (targetRole === 'retailer') {
            responseData.retailer = Object.assign({ id: user.id, email: user.email, phone: user.phone, shop_name: (_c = user.retailerProfile) === null || _c === void 0 ? void 0 : _c.shopName, name: user.name }, user.retailerProfile);
        }
        else if (targetRole === 'wholesaler') {
            responseData.wholesaler = Object.assign({ id: user.id, email: user.email, phone: user.phone, company_name: (_d = user.wholesalerProfile) === null || _d === void 0 ? void 0 : _d.companyName, name: user.name }, user.wholesalerProfile);
        }
        else if (targetRole === 'employee') {
            responseData.employee = Object.assign({ id: user.id, email: user.email, phone: user.phone, name: user.name }, user.employeeProfile);
        }
        else if (targetRole === 'admin') {
            responseData.admin = {
                id: user.id,
                email: user.email,
                name: user.name
            };
        }
        res.json(responseData);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});
exports.login = login;
