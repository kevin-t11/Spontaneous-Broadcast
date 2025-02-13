import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import broadcastRoutes from './routes/broadcast';
import { apiLimiter } from './middleware/rateLimiter';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(apiLimiter);

// Routes
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/auth', authRoutes);

// Connect to MongoDB
const mongoURI =
  process.env.MONGO_URI || 'mongodb://localhost:27017/spontaneous-broadcast';
mongoose
  .connect(mongoURI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
  });
