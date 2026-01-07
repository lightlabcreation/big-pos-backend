import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../utils/prisma';

export const getWholesalerProfile = async (req: AuthRequest, res: Response) => {
    try {
        console.log('👤 Fetching wholesaler profile for user:', req.user?.id);

        const profile = await prisma.wholesalerProfile.findUnique({
            where: { userId: req.user!.id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        phone: true,
                        name: true,
                        role: true
                    }
                },
                settings: true
            } as any
        });

        if (!profile) {
            return res.status(404).json({ error: 'Wholesaler profile not found' });
        }

        // If settings don't exist yet, create them with defaults
        if (!(profile as any).settings) {
            const defaultSettings = await (prisma as any).wholesalerSettings.create({
                data: {
                    wholesalerId: profile.id
                }
            });
            (profile as any).settings = defaultSettings;
        }

        res.json({ success: true, profile });
    } catch (error: any) {
        console.error('❌ Error fetching profile:', error);
        res.status(500).json({ error: error.message });
    }
};

export const updateWholesalerProfile = async (req: AuthRequest, res: Response) => {
    try {
        const { name, company_name, contact_person, email, address, tin_number } = req.body;
        console.log('✏️ Updating wholesaler profile:', req.user?.id);

        const profile = await prisma.wholesalerProfile.findUnique({
            where: { userId: req.user!.id }
        });

        if (!profile) {
            return res.status(404).json({ error: 'Wholesaler profile not found' });
        }

        // Update User's name if provided
        if (name) {
            await prisma.user.update({
                where: { id: req.user!.id },
                data: { name }
            });
        }

        // Update WholesalerProfile
        const updatedProfile = await prisma.wholesalerProfile.update({
            where: { id: profile.id },
            data: {
                ...(company_name && { companyName: company_name }),
                ...(contact_person && { contactPerson: contact_person }),
                ...(address && { address }),
                ...(tin_number && { tinNumber: tin_number })
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        phone: true,
                        name: true,
                        role: true
                    }
                },
                settings: true
            } as any
        });

        res.json({ success: true, profile: updatedProfile });
    } catch (error: any) {
        console.error('❌ Error updating profile:', error);
        res.status(500).json({ error: error.message });
    }
};

export const updateWholesalerSettings = async (req: AuthRequest, res: Response) => {
    try {
        const settingsData = req.body;
        console.log('⚙️ Updating wholesaler settings:', req.user?.id);

        const profile = await prisma.wholesalerProfile.findUnique({
            where: { userId: req.user!.id },
            include: { settings: true }
        } as any);

        if (!profile) {
            return res.status(404).json({ error: 'Wholesaler profile not found' });
        }

        let updatedSettings;
        if (!(profile as any).settings) {
            // Create new settings
            updatedSettings = await (prisma as any).wholesalerSettings.create({
                data: {
                    wholesalerId: profile.id,
                    ...settingsData
                }
            });
        } else {
            // Update existing settings
            updatedSettings = await (prisma as any).wholesalerSettings.update({
                where: { id: (profile as any).settings.id },
                data: settingsData
            });
        }

        res.json({ success: true, settings: updatedSettings });
    } catch (error: any) {
        console.error('❌ Error updating settings:', error);
        res.status(500).json({ error: error.message });
    }
};
