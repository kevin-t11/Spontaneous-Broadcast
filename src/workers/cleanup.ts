import mongoose from 'mongoose';
import Broadcast from '../models/broadcast';
import dotenv from 'dotenv';

dotenv.config();

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/spontaneous-broadcast';

mongoose
  .connect(mongoURI)
  .then(() => console.log('CleanupWorker connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error in cleanupWorker', err));

const cleanExpiredBroadcasts = async () => {
  try {
    const now = new Date();
    const result = await Broadcast.updateMany(
      { expiresAt: { $lte: now }, status: 'active' },
      { $set: { status: 'expired' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`Marked ${result.modifiedCount} broadcasts as expired`);
    }
  } catch (error) {
    console.error('Error cleaning expired broadcasts:', error);
  }
};

// Run cleanup every minute.
setInterval(cleanExpiredBroadcasts, 60 * 1000);
