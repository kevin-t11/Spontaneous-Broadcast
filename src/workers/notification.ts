import { Job } from 'bull';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Broadcast, { IBroadcast } from '../models/broadcast';
import { broadcastNotificationQueue } from '../utils/queue';

dotenv.config();

const mongoURI: string =
  process.env.MONGO_URI || 'mongodb://localhost:27017/spontaneous-broadcast';

// Connect to MongoDB
mongoose
  .connect(mongoURI)
  .then(() => console.log('Notification Worker connected to MongoDB'))
  .catch((err: unknown) => {
    console.error('MongoDB connection error in Notification Worker:', err);
    process.exit(1);
  });

interface NotificationJobData {
  broadcastId: string;
  requesterId: string;
}

/**
 * Processes each notification job.
 * For each job:
 *  - Fetch the broadcast details (and populate the creator field if necessary).
 *  - Simulate sending a notification to the broadcast creator about the join request.
 */
broadcastNotificationQueue.process(async (job: Job<NotificationJobData>) => {
  try {
    const { broadcastId, requesterId } = job.data;

    // Fetch the broadcast and populate the 'creator' field.
    const broadcast: IBroadcast | null =
      await Broadcast.findById(broadcastId).populate('creator');
    if (!broadcast) {
      console.error(
        `Notification Worker: Broadcast with ID ${broadcastId} not found.`
      );
      return;
    }

    // For now, log the notification in the console.
    console.log(
      `Notification Worker: Notifying broadcaster (User ID: ${broadcast.creator.toString()}) that user ${requesterId} has requested to join broadcast ${broadcastId}.`
    );

    // TODO: Invoke an email/push notification service here.
  } catch (error) {
    console.error(
      `Notification Worker: Error processing job for broadcast ${job.data.broadcastId}:`,
      error
    );
    // Throw error to let Bull handle retry logic if configured.
    throw error;
  }
});
