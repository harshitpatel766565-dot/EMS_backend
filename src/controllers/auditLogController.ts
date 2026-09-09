import { Response } from "express";

import AuditLog from "../models/AuditLog";
import { AuthRequest } from "../middleware/authMiddleware";

// =====================================================
// GET AUDIT LOGS
// SUPER ADMIN ONLY (PM optional restricted)
// =====================================================

export const getAuditLogs = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    if (req.user.role === "EMPLOYEE") {
      res.status(403).json({
        success: false,
        message: "Employees are not authorized to view audit logs",
      });
      return;
    }

    const { page = "1", limit = "50", entity, action } = req.query;
    const filter: Record<string, any> = {};

    if (entity && entity !== "all") {
      filter.entity = String(entity).toUpperCase();
    }
    if (action) {
      filter.action = { $regex: String(action), $options: "i" };
    }

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const skip = (pageNumber - 1) * limitNumber;

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate("actor", "name email employeeId avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      AuditLog.countDocuments(filter),
    ]);

    const formattedLogs = logs.map((log: any) => ({
      id: String(log._id),
      _id: String(log._id),
      actorId: log.actor?._id ? String(log.actor._id) : undefined,
      actorName: log.actorName || log.actor?.name || "System",
      actorAvatar: log.actor?.avatar || undefined,
      action: log.action,
      entity: log.entity,
      entityTitle: log.entity,
      entityId: log.entityId,
      description: log.description,
      ipAddress: log.ipAddress,
      timestamp: log.createdAt,
      createdAt: log.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedLogs,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error: any) {
    console.error("Get Audit Logs Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch audit logs",
    });
  }
};
