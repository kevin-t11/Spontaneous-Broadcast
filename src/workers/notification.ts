import { broadcastNotificationQueue } from '../utils/queue';
import Broadcast from '../models/broadcast';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/spontaneous-broadcast';

mongoose
  .connect(mongoURI)
  .then(() => console.log('NotificationWorker connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error in notificationWorker', err));

broadcastNotificationQueue.process(async (job) => {
  const { broadcastId } = job.data;
  // Fetch broadcast details and perform notification logic here.
  const broadcast = await Broadcast.findById(broadcastId);
  if (broadcast) {
    console.log(`Sending notifications for broadcast: ${broadcastId}`);
    // Implement your notification logic (e.g., send push notifications, emails, etc.)
  }
});
