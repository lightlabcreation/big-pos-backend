import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';

// Helper interface for AuthRequest
interface AuthRequest extends Request {
    user?: any;
}

// Get all suppliers
export const getSuppliers = async (req: AuthRequest, res: Response) => {
    try {
        const suppliers = await prisma.supplier.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { products: true }
                }
            }
        });

        res.json({ success: true, suppliers });
    } catch (error: any) {
        console.error('Get Suppliers Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Create supplier
export const createSupplier = async (req: AuthRequest, res: Response) => {
    try {
        const { name, contactPerson, phone, email, address } = req.body;

        // Get wholesaler ID from authenticated user
        if (!req.user?.wholesalerProfile?.id) {
            return res.status(403).json({ error: 'Only wholesalers can create suppliers' });
        }

        const wholesalerId = req.user.wholesalerProfile.id;

        // Check existing
        const existing = await prisma.supplier.findFirst({
            where: {
                OR: [
                    { name },
                    { email: email || undefined } // Only check email if provided
                ]
            }
        });

        if (existing) {
            return res.status(400).json({ error: 'Supplier with this name or email already exists' });
        }

        const supplierData: Prisma.SupplierUncheckedCreateInput = {
            name,
            contactPerson,
            phone,
            email,
            address,
            status: 'active',
            wholesalerId
        };

        const supplier = await prisma.supplier.create({
            data: supplierData as any
        });

        res.status(201).json({ success: true, message: 'Supplier created successfully', supplier });
    } catch (error: any) {
        console.error('Create Supplier Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update supplier
export const updateSupplier = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { name, contactPerson, phone, email, address, status } = req.body;

        const supplier = await prisma.supplier.update({
            where: { id },
            data: {
                name,
                contactPerson,
                phone,
                email,
                address,
                status
            }
        });

        res.json({ success: true, message: 'Supplier updated successfully', supplier });
    } catch (error: any) {
        console.error('Update Supplier Error:', error);
        res.status(500).json({ error: error.message });
    }
};

// Delete supplier
export const deleteSupplier = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;

        // Check if supplier has products linked
        const supplier = await prisma.supplier.findUnique({
            where: { id },
            include: { _count: { select: { products: true } } }
        });

        if (supplier && supplier._count.products > 0) {
            return res.status(400).json({ error: 'Cannot delete supplier with linked products. Deactivate instead.' });
        }

        await prisma.supplier.delete({
            where: { id }
        });

        res.json({ success: true, message: 'Supplier deleted successfully' });
    } catch (error: any) {
        console.error('Delete Supplier Error:', error);
        res.status(500).json({ error: error.message });
    }
};
