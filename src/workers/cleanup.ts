import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cron from 'node-cron';
import Broadcast from '../models/broadcast';

dotenv.config();

const mongoURI: string =
  process.env.MONGO_URI || 'mongodb://localhost:27017/spontaneous-broadcast';

// Connect to MongoDB
mongoose
  .connect(mongoURI)
  .then(() => {
    console.log('Cleanup Worker connected to MongoDB');
    scheduleCleanup();
  })
  .catch((err: unknown) => {
    console.error('MongoDB connection error in Cleanup Worker:', err);
    process.exit(1);
  });

/**
 * Updates all broadcasts that have expired and are still marked as "active"
 * by setting their status to "expired".
 */
const cleanupExpiredBroadcasts = async (): Promise<void> => {
  try {
    const now = new Date();
    const result = await Broadcast.updateMany(
      { expiresAt: { $lte: now }, status: 'active' },
      { $set: { status: 'expired' } }
    );
    if (result.modifiedCount > 0) {
      console.log(
        `Cleanup Worker: Marked ${result.modifiedCount} broadcasts as expired.`
      );
    } else {
      console.log('Cleanup Worker: No broadcasts to update.');
    }
  } catch (error) {
    console.error('Error in cleanupExpiredBroadcasts:', error);
  }
};

/**
 * Schedules the cleanup job using node-cron.
 * This cron expression "* * * * *" means the job runs at the start of every minute.
 */
const scheduleCleanup = (): void => {
  cron.schedule('* * * * *', async () => {
    console.log('Running scheduled cleanup job...');
    await cleanupExpiredBroadcasts();
  });
};
