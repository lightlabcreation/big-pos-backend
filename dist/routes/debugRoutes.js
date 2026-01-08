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
const express_1 = require("express");
const prisma_1 = __importDefault(require("../utils/prisma"));
const router = (0, express_1.Router)();
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. Check Date
        const now = new Date();
        // 2. Check DB Connection
        let dbStatus = 'Unknown';
        let userCount = -1;
        let errorDetail = null;
        try {
            userCount = yield prisma_1.default.user.count();
            dbStatus = 'Connected';
        }
        catch (e) {
            dbStatus = 'Failed';
            errorDetail = e.message;
        }
        // 3. Check Env Vars (Masked)
        const dbUrl = process.env.DATABASE_URL || 'Not Set';
        const maskedDbUrl = dbUrl.length > 20
            ? `${dbUrl.substring(0, 10)}...${dbUrl.substring(dbUrl.length - 10)}`
            : dbUrl;
        res.json({
            status: 'Debug Info',
            timestamp: now.toISOString(),
            environment: {
                NODE_ENV: process.env.NODE_ENV,
                PORT: process.env.PORT,
                DATABASE_URL: maskedDbUrl,
            },
            database: {
                status: dbStatus,
                userCount: userCount,
                error: errorDetail
            }
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Debug endpoint failed',
            message: error.message,
            stack: error.stack
        });
    }
}));
exports.default = router;
