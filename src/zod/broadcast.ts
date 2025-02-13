import { z } from 'zod';

export const createBroadcastSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  expiresAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' })
});

export const updateBroadcastSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  expiresAt: z
    .union([
      z
        .string()
        .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
      z.undefined()
    ])
    .optional()
});

export const updateJoinRequestSchema = z.object({
  status: z.enum(['accepted', 'rejected'])
});

export const searchBroadcastSchema = z.object({
  keyword: z.string().optional(),
  status: z.enum(['active', 'expired']).optional(),
  startDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid start date'
    }),
  endDate: z
    .string()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid end date'
    }),
  page: z.number().optional().default(1),
  limit: z.number().optional().default(20)
});
