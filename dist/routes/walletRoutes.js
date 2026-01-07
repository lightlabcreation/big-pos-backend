"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticate);
// Placeholder wallet endpoints
router.get('/balance', (req, res) => {
    res.json({ balance: 0, currency: 'RWF' });
});
router.get('/transactions', (req, res) => {
    res.json({ transactions: [] });
});
exports.default = router;
