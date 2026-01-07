import { Router } from 'express';
// import { } from '../controllers/nfcController'; // Controller missing
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticate);

router.get('/', (req, res) => {
    res.json({ message: 'NFC routes working' });
});

export default router;
