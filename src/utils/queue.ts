import Bull from 'bull';

export const broadcastNotificationQueue = new Bull('broadcastNotification', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379
  }
});
