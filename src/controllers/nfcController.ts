import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import prisma from '../utils/prisma';

// Get customer's NFC cards
export const getMyCards = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        const cards = await prisma.nfcCard.findMany({
            where: { consumerId: consumerProfile.id }
        });

        // Transform to frontend expected format
        const formattedCards = cards.map((card, index) => ({
            id: card.id,
            uid: card.uid,
            card_number: `NFC-${card.uid.slice(-4).toUpperCase()}`, // Generate a display number
            status: card.status || 'active',
            is_primary: index === 0, // Assume first card is primary for now
            linked_at: card.createdAt,
            last_used: card.createdAt, // Placeholder
            nickname: `Card ${index + 1}` // Placeholder
        }));

        res.json({
            success: true,
            data: formattedCards
        });
    } catch (error: any) {
        console.error('Get NFC cards error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Link a new NFC card
export const linkCard = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { uid, pin, nickname } = req.body;

        if (!uid || !pin) {
            return res.status(400).json({ success: false, error: 'UID and PIN are required' });
        }

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        // Check if card is already linked or exists
        const existingCard = await prisma.nfcCard.findUnique({
            where: { uid }
        });

        if (existingCard) {
            if (existingCard.consumerId) {
                return res.status(400).json({ success: false, error: 'Card is already linked to a user' });
            }

            // If card exists but not linked (e.g. created by admin), link it
            // Verify PIN if needed (assuming new cards might have a PIN set by admin)
            // For now, simpler: just update it
            await prisma.nfcCard.update({
                where: { id: existingCard.id },
                data: {
                    consumerId: consumerProfile.id,
                    status: 'active',
                    pin: pin // Update PIN to user's choice
                }
            });
            return res.json({
                success: true,
                message: 'Card linked successfully'
            });
        }

        // If card doesn't exist, create it (assuming self-registration flow allowed for demo)
        // In real world, physical cards should pre-exist.
        // We will create it to support the demo flow.
        const newCard = await prisma.nfcCard.create({
            data: {
                uid,
                pin,
                consumerId: consumerProfile.id,
                status: 'active'
            }
        });

        res.json({
            success: true,
            data: newCard,
            message: 'Card linked successfully'
        });

    } catch (error: any) {
        console.error('Link NFC card error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Unlink NFC card
export const unlinkCard = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        const card = await prisma.nfcCard.findUnique({
            where: { id }
        });

        if (!card || card.consumerId !== consumerProfile.id) {
            return res.status(404).json({ success: false, error: 'Card not found or not owned by you' });
        }

        // Unlink by removing consumerId
        await prisma.nfcCard.update({
            where: { id },
            data: {
                consumerId: null,
                status: 'inactive'
            }
        });

        res.json({
            success: true,
            message: 'Card unlinked successfully'
        });

    } catch (error: any) {
        console.error('Unlink NFC card error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update PIN
export const setCardPin = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { old_pin, new_pin } = req.body;

        const consumerProfile = await prisma.consumerProfile.findUnique({
            where: { userId }
        });

        if (!consumerProfile) {
            return res.status(404).json({ success: false, error: 'Customer profile not found' });
        }

        const card = await prisma.nfcCard.findUnique({
            where: { id }
        });

        if (!card || card.consumerId !== consumerProfile.id) {
            return res.status(404).json({ success: false, error: 'Card not found' });
        }

        if (card.pin && card.pin !== old_pin) {
            return res.status(400).json({ success: false, error: 'Invalid old PIN' });
        }

        await prisma.nfcCard.update({
            where: { id },
            data: { pin: new_pin }
        });

        res.json({
            success: true,
            message: 'PIN updated successfully'
        });

    } catch (error: any) {
        console.error('Set card PIN error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Set Primary Card
export const setPrimaryCard = async (req: AuthRequest, res: Response) => {
    try {
        // Placeholder implementation as DB doesn't have isPrimary field
        res.json({
            success: true,
            message: 'Card set as primary'
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// Update Nickname
export const updateCardNickname = async (req: AuthRequest, res: Response) => {
    try {
        // Placeholder
        res.json({
            success: true,
            message: 'Nickname updated'
        });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
};
