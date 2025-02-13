import rateLimit from 'express-rate-limit';

// Rate limiter for API requests : 1 minute window, 100 requests per minute
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.'
});
