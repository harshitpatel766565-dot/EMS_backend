import mongoose, { Document, Schema } from "mongoose";

export type AuditEntity =
  | "USER"
  | "PROJECT"
  | "TASK"
  | "SPRINT"
  | "LEAVE"
  | "AUTH"
  | "DEPARTMENT"
  | "SYSTEM";

export interface IAuditLog extends Document {
  actor?: mongoose.Types.ObjectId;
  actorName: string;
  action: string;
  entity: AuditEntity;
  entityId?: string;
  description: string;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    actorName: {
      type: String,
      required: true,
      trim: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
    },

    entity: {
      type: String,
      enum: [
        "USER",
        "PROJECT",
        "TASK",
        "SPRINT",
        "LEAVE",
        "AUTH",
        "DEPARTMENT",
        "SYSTEM",
      ],
      required: true,
    },

    entityId: {
      type: String,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    ipAddress: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1 });

const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);

export default AuditLog;
