import { Request, RequestHandler, Response } from 'express';
import mongoose from 'mongoose';
import Broadcast, { IBroadcast } from '../models/broadcast';
import redisClient from '../utils/redisClient';
import { broadcastNotificationQueue } from '../utils/queue';
import {
  createBroadcastSchema,
  searchBroadcastSchema,
  updateBroadcastSchema,
  updateJoinRequestSchema
} from '../zod/broadcast';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}

/**
 * POST /api/broadcasts
 * Creates a new broadcast.
 */
export const createBroadcast = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const parsed = createBroadcastSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessage = parsed.error.errors.map((e) => e.message).join(', ');
      res.status(400).json({ message: errorMessage });
      return;
    }

    const { title, description, expiresAt } = parsed.data;
    const expirationDate = new Date(expiresAt);
    if (expirationDate <= new Date()) {
      res.status(400).json({ message: 'expiresAt must be in the future' });
      return;
    }

    // Auth middleware should attach the authenticated user's id to req.user
    const creator = req.user?.id;
    if (!creator) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const broadcast: IBroadcast = new Broadcast({
      title,
      description,
      creator: new mongoose.Types.ObjectId(creator), // convert string to ObjectId
      expiresAt: expirationDate,
      status: 'active',
      joinRequests: []
    });
    await broadcast.save();

    // Invalidate active broadcasts cache
    await redisClient.del('activeBroadcasts');

    res.status(201).json(broadcast);
  } catch (error) {
    console.error('Error in createBroadcast:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * GET /api/broadcasts/active
 * Retrieves all active broadcasts.
 */
export const getActiveBroadcasts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const cached = await redisClient.get('activeBroadcasts');
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }
    const now = new Date();
    const broadcasts = await Broadcast.find({
      expiresAt: { $gt: now },
      status: 'active'
    });
    await redisClient.set('activeBroadcasts', JSON.stringify(broadcasts), {
      EX: 30
    });
    res.json(broadcasts);
  } catch (error) {
    console.error('Error in getActiveBroadcasts:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * POST /api/broadcasts/:id/join
 * Sends a join request to a specific broadcast.
 */
export const joinBroadcast = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const broadcastId = req.params.id;
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      res.status(404).json({ message: 'Broadcast not found' });
      return;
    }

    if (broadcast.expiresAt <= new Date() || broadcast.status === 'expired') {
      res.status(400).json({ message: 'Broadcast has expired' });
      return;
    }

    // Check if the user has already sent a join request
    const existingRequest = broadcast.joinRequests.find(
      (r) => r.user.toString() === userId
    );
    if (existingRequest) {
      res.status(400).json({ message: 'Join request already sent' });
      return;
    }

    // Add join request with status "pending" converting the userId to ObjectId
    broadcast.joinRequests.push({
      user: new mongoose.Types.ObjectId(userId),
      status: 'pending'
    });
    await broadcast.save();

    // Enqueue a notification job for the broadcast creator
    broadcastNotificationQueue.add({ broadcastId, requesterId: userId });

    res.json({ message: 'Join request sent successfully' });
  } catch (error) {
    console.error('Error in joinBroadcast:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * PUT /api/broadcasts/:id/join/:userId
 * Updates the status of a join request for a specific broadcast.
 */
export const updateJoinRequest = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const broadcastId = req.params.id;
    const requesterId = req.params.userId;
    const parsed = updateJoinRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessage = parsed.error.errors.map((e) => e.message).join(', ');
      res.status(400).json({ message: errorMessage });
      return;
    }
    const { status } = parsed.data;

    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      res.status(404).json({ message: 'Broadcast not found' });
      return;
    }

    // Only the broadcast creator can update join requests
    if (broadcast.creator.toString() !== req.user?.id) {
      res.status(403).json({ message: 'Not authorized' });
      return;
    }

    // Find the join request for the specified user
    const joinRequest = broadcast.joinRequests.find(
      (r) => r.user.toString() === requesterId
    );
    if (!joinRequest) {
      res.status(404).json({ message: 'Join request not found' });
      return;
    }

    joinRequest.status = status;
    await broadcast.save();

    res.json({ message: `Join request ${status}` });
  } catch (error) {
    console.error('Error in updateJoinRequest:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * DELETE /api/broadcasts/:id
 * Deletes a specific broadcast. Only the creator may delete their broadcast.
 */
export const deleteBroadcast: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const broadcastId = req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      res.status(404).json({ message: 'Broadcast not found' });
      return;
    }

    // Only the creator is allowed to delete/cancel the broadcast
    if (broadcast.creator.toString() !== userId) {
      res
        .status(403)
        .json({ message: 'Not authorized to delete this broadcast' });
      return;
    }

    // Delete the broadcast
    await Broadcast.findByIdAndDelete(broadcastId);

    res.json({ message: 'Broadcast successfully deleted/cancelled' });
  } catch (error) {
    console.error('Error deleting broadcast:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * GET /api/broadcasts/:id
 * Retrieves details for a specific broadcast.
 */
export const getBroadcastDetails: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id: broadcastId } = req.params;

    // Validate broadcastId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(broadcastId)) {
      res.status(400).json({ message: 'Invalid broadcast id' });
      return;
    }

    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      res.status(404).json({ message: 'Broadcast not found' });
      return;
    }

    res.json(broadcast);
  } catch (error) {
    console.error('Error in getBroadcastDetails:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * PUT /api/broadcasts/:id
 * Updates broadcast details. Only the creator may update their broadcast.
 */
export const updateBroadcast: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id: broadcastId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(broadcastId)) {
      res.status(400).json({ message: 'Invalid broadcast id' });
      return;
    }

    // Validate the request body using Zod
    const parsed = updateBroadcastSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessage = parsed.error.errors
        .map((err: any) => err.message)
        .join(', ');
      res.status(400).json({ message: errorMessage });
      return;
    }
    const updateData = parsed.data;

    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      res.status(404).json({ message: 'Broadcast not found' });
      return;
    }

    // Only allow the creator to update the broadcast
    if (broadcast.creator.toString() !== req.user?.id) {
      res
        .status(403)
        .json({ message: 'Not authorized to update this broadcast' });
      return;
    }

    // Update fields if provided
    if (updateData.title !== undefined) {
      broadcast.title = updateData.title;
    }
    if (updateData.description !== undefined) {
      broadcast.description = updateData.description;
    }
    if (updateData.expiresAt !== undefined) {
      const newExpiresAt = new Date(updateData.expiresAt);
      if (newExpiresAt <= new Date()) {
        res.status(400).json({ message: 'expiresAt must be in the future' });
        return;
      }
      broadcast.expiresAt = newExpiresAt;
    }

    await broadcast.save();
    res.json({ message: 'Broadcast updated successfully', broadcast });
  } catch (error) {
    console.error('Error in updateBroadcast:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

/**
 * GET /api/mybroadcasts
 * Lists broadcasts created by the authenticated user.
 */
export const getMyBroadcasts: RequestHandler = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Find broadcasts where the creator matches the authenticated user's id.
    const broadcasts = await Broadcast.find({
      creator: new mongoose.Types.ObjectId(userId)
    }).sort({
      createdAt: -1
    });
    res.json(broadcasts);
  } catch (error) {
    console.error('Error in getMyBroadcasts:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const searchBroadcasts = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validate incoming search parameters using Zod
    const parsed = searchBroadcastSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessage = parsed.error.errors
        .map((err: any) => err.message)
        .join(', ');
      res.status(400).json({ message: errorMessage });
      return;
    }

    const { keyword, status, startDate, endDate, page, limit } = parsed.data;
    const query: any = {};

    // If keyword is provided, search in title or description (case-insensitive)
    if (keyword) {
      query.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } }
      ];
    }

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    // Filter by creation date range if provided
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Calculate pagination values
    const skip = (page - 1) * limit;
    const broadcasts = await Broadcast.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Optionally, get total count for pagination
    const total = await Broadcast.countDocuments(query);

    res.json({ broadcasts, total, page, limit });
  } catch (error) {
    console.error('Error in searchBroadcasts:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
