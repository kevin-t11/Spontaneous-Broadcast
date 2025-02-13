import express from 'express';
import {
  createBroadcast,
  getActiveBroadcasts,
  joinBroadcast,
  updateJoinRequest,
  deleteBroadcast,
  getBroadcastDetails,
  getMyBroadcasts,
  updateBroadcast
} from '../controllers/broadcast';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// public routes
router.get('/active', getActiveBroadcasts);
router.get('/:id', getBroadcastDetails);

// authenticated routes
router.post('/', authenticateToken, createBroadcast);
router.post('/:id/join', authenticateToken, joinBroadcast);
router.put('/:id/requests/:userId', authenticateToken, updateJoinRequest);
router.delete('/:id', authenticateToken, deleteBroadcast);
router.put('/:id', authenticateToken, updateBroadcast);
router.get('/mybroadcasts', authenticateToken, getMyBroadcasts);

export default router;
