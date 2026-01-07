import { Router } from 'express';
import {
  getDashboard,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getRetailers,
  createRetailer,
  updateRetailer,
  deleteRetailer,
  getWholesalers,
  createWholesaler,
  updateWholesaler,
  deleteWholesaler,
  getLoans,
  getNFCCards,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  getProducts
} from '../controllers/adminController';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../controllers/supplierController';
import { getJobs, createJob, updateJob, deleteJob, getApplications, createApplication, updateApplicationStatus } from '../controllers/recruitmentController';
import { getDeals, createDeal, updateDeal, deleteDeal } from '../controllers/dealsController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/dashboard', getDashboard);

// Customer Routes
router.get('/customers', getCustomers);
router.post('/customers', createCustomer);
router.put('/customers/:id', updateCustomer);
router.delete('/customers/:id', deleteCustomer);

// Retailer Routes
router.get('/retailers', getRetailers);
router.post('/retailers', createRetailer);
router.put('/retailers/:id', updateRetailer);
router.delete('/retailers/:id', deleteRetailer);

// Wholesaler Routes
router.get('/wholesalers', getWholesalers);
router.post('/wholesalers', createWholesaler);
router.put('/wholesalers/:id', updateWholesaler);
router.delete('/wholesalers/:id', deleteWholesaler);

router.get('/loans', getLoans);
router.get('/nfc-cards', getNFCCards);

// Product Routes
router.get('/products', getProducts);

// Category Routes
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Supplier Routes
router.get('/suppliers', getSuppliers);
router.post('/suppliers', createSupplier);
router.put('/suppliers/:id', updateSupplier);
router.delete('/suppliers/:id', deleteSupplier);

// Recruitment Routes
router.get('/jobs', getJobs);
router.post('/jobs', createJob);
router.put('/jobs/:id', updateJob);
router.delete('/jobs/:id', deleteJob);
router.get('/applications', getApplications);
router.post('/applications', createApplication);
router.put('/applications/:id/status', updateApplicationStatus);

// Deals Routes
router.get('/deals', getDeals);
router.post('/deals', createDeal);
router.put('/deals/:id', updateDeal);
router.delete('/deals/:id', deleteDeal);

// Employee Routes
router.get('/employees', getEmployees);
router.post('/employees', createEmployee);
router.put('/employees/:id', updateEmployee);
router.delete('/employees/:id', deleteEmployee);

export default router;
