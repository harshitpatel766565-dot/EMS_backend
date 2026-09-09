import mongoose from "mongoose";
import AuditLog, { AuditEntity } from "../models/AuditLog";

export interface CreateAuditLogParams {
  actorId?: string | mongoose.Types.ObjectId;
  actorName: string;
  action: string;
  entity: AuditEntity;
  entityId?: string;
  description: string;
  ipAddress?: string;
}

/**
 * Record a system/user event in Audit Logs
 */
export const createAuditLog = async ({
  actorId,
  actorName,
  action,
  entity,
  entityId,
  description,
  ipAddress,
}: CreateAuditLogParams): Promise<void> => {
  try {
    await AuditLog.create({
      actor:
        actorId && mongoose.Types.ObjectId.isValid(actorId.toString())
          ? actorId
          : undefined,
      actorName: actorName || "System",
      action,
      entity,
      entityId: entityId ? String(entityId) : undefined,
      description,
      ipAddress,
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
    // Don't throw error to prevent breaking the main transaction
  }
};
