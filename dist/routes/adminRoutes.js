"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const supplierController_1 = require("../controllers/supplierController");
const recruitmentController_1 = require("../controllers/recruitmentController");
const dealsController_1 = require("../controllers/dealsController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticate);
router.get('/dashboard', adminController_1.getDashboard);
// Customer Routes
router.get('/customers', adminController_1.getCustomers);
router.post('/customers', adminController_1.createCustomer);
router.put('/customers/:id', adminController_1.updateCustomer);
router.delete('/customers/:id', adminController_1.deleteCustomer);
// Retailer Routes
router.get('/retailers', adminController_1.getRetailers);
router.post('/retailers', adminController_1.createRetailer);
router.put('/retailers/:id', adminController_1.updateRetailer);
router.delete('/retailers/:id', adminController_1.deleteRetailer);
router.post('/retailers/:id/verify', adminController_1.verifyRetailer);
// Wholesaler Routes
router.get('/wholesalers', adminController_1.getWholesalers);
router.post('/wholesalers', adminController_1.createWholesaler);
router.put('/wholesalers/:id', adminController_1.updateWholesaler);
router.delete('/wholesalers/:id', adminController_1.deleteWholesaler);
router.post('/wholesalers/:id/status', adminController_1.updateWholesalerStatus);
router.get('/loans', adminController_1.getLoans);
router.get('/nfc-cards', adminController_1.getNFCCards);
// Product Routes
router.get('/products', adminController_1.getProducts);
// Category Routes
router.get('/categories', adminController_1.getCategories);
router.post('/categories', adminController_1.createCategory);
router.put('/categories/:id', adminController_1.updateCategory);
router.delete('/categories/:id', adminController_1.deleteCategory);
// Supplier Routes
router.get('/suppliers', supplierController_1.getSuppliers);
router.post('/suppliers', supplierController_1.createSupplier);
router.put('/suppliers/:id', supplierController_1.updateSupplier);
router.delete('/suppliers/:id', supplierController_1.deleteSupplier);
// Recruitment Routes
router.get('/jobs', recruitmentController_1.getJobs);
router.post('/jobs', recruitmentController_1.createJob);
router.put('/jobs/:id', recruitmentController_1.updateJob);
router.delete('/jobs/:id', recruitmentController_1.deleteJob);
router.get('/applications', recruitmentController_1.getApplications);
router.post('/applications', recruitmentController_1.createApplication);
router.put('/applications/:id/status', recruitmentController_1.updateApplicationStatus);
// Deals Routes
router.get('/deals', dealsController_1.getDeals);
router.post('/deals', dealsController_1.createDeal);
router.put('/deals/:id', dealsController_1.updateDeal);
router.delete('/deals/:id', dealsController_1.deleteDeal);
// Employee Routes
router.get('/employees', adminController_1.getEmployees);
router.post('/employees', adminController_1.createEmployee);
router.put('/employees/:id', adminController_1.updateEmployee);
router.delete('/employees/:id', adminController_1.deleteEmployee);
exports.default = router;
