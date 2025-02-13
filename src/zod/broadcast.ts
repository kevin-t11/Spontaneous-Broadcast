import { z } from 'zod';

export const createBroadcastSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  expiresAt: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' })
});

export const updateJoinRequestSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
});
