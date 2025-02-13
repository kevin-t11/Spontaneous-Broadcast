import express from 'express';
import {
  createBroadcast,
  getActiveBroadcasts,
  joinBroadcast,
  updateJoinRequest,
} from '../controllers/broadcast';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Create a broadcast (requires authentication)
router.post('/', authenticateToken, createBroadcast);

// Get active broadcasts (public)
router.get('/active', getActiveBroadcasts);

// Send a join request (requires authentication)
router.post('/:id/join', authenticateToken, joinBroadcast);

// Accept or reject a join request (requires authentication; only the creator can update)
router.put('/:id/requests/:userId', authenticateToken, updateJoinRequest);

export default router;
