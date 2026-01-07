"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticate);
// Placeholder NFC endpoints
router.get('/cards', (req, res) => {
    res.json({ cards: [] });
});
exports.default = router;
