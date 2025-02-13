import { Request, Response } from 'express';
import { z } from 'zod';
import Broadcast, { IBroadcast } from '../models/broadcast';
import redisClient from '../utils/redisClient';
import { broadcastNotificationQueue } from '../utils/queue';
import { createBroadcastSchema, updateJoinRequestSchema } from '../zod/broadcast';

export const createBroadcast = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = createBroadcastSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessage = parsed.error.errors.map(e => e.message).join(', ');
      res.status(400).json({ message: errorMessage });
      return;
    }

    const { title, description, expiresAt } = parsed.data;
    const expirationDate = new Date(expiresAt);
    if (expirationDate <= new Date()) {
      res.status(400).json({ message: "expiresAt must be in the future" });
      return;
    }

    // Auth middleware should attach the authenticated user's id to req.user
    const creator = (req as any).user?.id;
    if (!creator) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const broadcast: IBroadcast = new Broadcast({
      title,
      description,
      creator,
      expiresAt: expirationDate,
      status: 'active',
      joinRequests: [],
    });
    await broadcast.save();

    // Invalidate active broadcasts cache
    await redisClient.del("activeBroadcasts");

    res.status(201).json(broadcast);
  } catch (error) {
    console.error("Error in createBroadcast:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getActiveBroadcasts = async (req: Request, res: Response): Promise<void> => {
  try {
    const cached = await redisClient.get("activeBroadcasts");
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }
    const now = new Date();
    const broadcasts = await Broadcast.find({ expiresAt: { $gt: now }, status: 'active' });
    await redisClient.set("activeBroadcasts", JSON.stringify(broadcasts), { EX: 30 });
    res.json(broadcasts);
  } catch (error) {
    console.error("Error in getActiveBroadcasts:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const joinBroadcast = async (req: Request, res: Response): Promise<void> => {
  try {
    const broadcastId = req.params.id;
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      res.status(404).json({ message: "Broadcast not found" });
      return;
    }

    if (broadcast.expiresAt <= new Date() || broadcast.status === 'expired') {
      res.status(400).json({ message: "Broadcast has expired" });
      return;
    }

    // Check if the user has already sent a join request
    const existingRequest = broadcast.joinRequests.find(r => r.user.toString() === userId);
    if (existingRequest) {
      res.status(400).json({ message: "Join request already sent" });
      return;
    }

    // Add join request with status "pending"
    broadcast.joinRequests.push({ user: userId, status: 'pending' });
    await broadcast.save();

    // Enqueue a notification job for the broadcast creator
    broadcastNotificationQueue.add({ broadcastId, requesterId: userId });

    res.json({ message: "Join request sent successfully" });
  } catch (error) {
    console.error("Error in joinBroadcast:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateJoinRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const broadcastId = req.params.id;
    const requesterId = req.params.userId;
    const parsed = updateJoinRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessage = parsed.error.errors.map(e => e.message).join(', ');
      res.status(400).json({ message: errorMessage });
      return;
    }
    const { status } = parsed.data;

    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      res.status(404).json({ message: "Broadcast not found" });
      return;
    }

    // Only the broadcast creator can update join requests
    if (broadcast.creator.toString() !== (req as any).user.id) {
      res.status(403).json({ message: "Not authorized" });
      return;
    }

    // Find the join request for the specified user
    const joinRequest = broadcast.joinRequests.find(r => r.user.toString() === requesterId);
    if (!joinRequest) {
      res.status(404).json({ message: "Join request not found" });
      return;
    }

    joinRequest.status = status;
    await broadcast.save();

    res.json({ message: `Join request ${status}` });
  } catch (error) {
    console.error("Error in updateJoinRequest:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
