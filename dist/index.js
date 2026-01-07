"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const storeRoutes_1 = __importDefault(require("./routes/storeRoutes"));
const retailerRoutes_1 = __importDefault(require("./routes/retailerRoutes"));
const wholesalerRoutes_1 = __importDefault(require("./routes/wholesalerRoutes"));
const employeeRoutes_1 = __importDefault(require("./routes/employeeRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const nfcRoutes_1 = __importDefault(require("./routes/nfcRoutes"));
const walletRoutes_1 = __importDefault(require("./routes/walletRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 9000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Routes
app.use('/store/auth', authRoutes_1.default); // Consumer uses /store/auth
app.use('/retailer/auth', authRoutes_1.default);
app.use('/wholesaler/auth', authRoutes_1.default);
app.use('/admin/auth', authRoutes_1.default);
app.use('/employee/auth', authRoutes_1.default);
app.use('/store', storeRoutes_1.default);
app.use('/retailer', retailerRoutes_1.default);
app.use('/wholesaler', wholesalerRoutes_1.default);
app.use('/employee', employeeRoutes_1.default);
app.use('/admin', adminRoutes_1.default);
app.use('/nfc', nfcRoutes_1.default);
app.use('/wallet', walletRoutes_1.default);
app.get('/', (req, res) => {
    res.send('Big Company API is running');
});
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
