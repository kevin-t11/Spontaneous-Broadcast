import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IJoinRequest {
  user: Types.ObjectId;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface IBroadcast extends Document {
  title: string;
  description: string;
  creator: Types.ObjectId;
  createdAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired';
  joinRequests: IJoinRequest[];
}

const JoinRequestSchema = new Schema<IJoinRequest>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  }
});

const BroadcastSchema: Schema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  creator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['active', 'expired'], default: 'active' },
  joinRequests: [JoinRequestSchema]
});

// TTL index: MongoDB will remove the document once expiresAt is reached
BroadcastSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IBroadcast>('Broadcast', BroadcastSchema);
