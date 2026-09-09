import { Response } from "express";
import mongoose from "mongoose";

import Standup from "../models/Standup";
import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";
import { createAuditLog } from "../services/auditService";

// =====================================================
// SUBMIT DAILY STANDUP NOTE
// =====================================================

export const submitStandup = async (
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

    const { date, yesterday, today, blockers = "", tasksWorkedOn = [] } = req.body;

    if (!yesterday || !today) {
      res.status(400).json({
        success: false,
        message: "Yesterday and Today fields are required",
      });
      return;
    }

    const standupDate = date || new Date().toISOString().split("T")[0];

    const validTaskIds = (Array.isArray(tasksWorkedOn) ? tasksWorkedOn : [])
      .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
      .map((id) => new mongoose.Types.ObjectId(String(id)));

    const standup = await Standup.create({
      employee: req.user.userId,
      date: standupDate,
      yesterday: String(yesterday).trim(),
      today: String(today).trim(),
      blockers: String(blockers).trim(),
      tasksWorkedOn: validTaskIds,
    });

    const user = await User.findById(req.user.userId);

    await createAuditLog({
      actorId: req.user.userId,
      actorName: user?.name || "Employee",
      action: `Submitted daily standup for ${standupDate}`,
      entity: "USER",
      entityId: String(standup._id),
      description: `Daily standup note recorded`,
      ipAddress: req.ip,
    });

    const populatedStandup = await Standup.findById(standup._id).populate(
      "employee",
      "name email employeeId avatar designation department"
    );

    res.status(201).json({
      success: true,
      message: "Daily standup submitted successfully",
      data: {
        id: populatedStandup?._id,
        _id: populatedStandup?._id,
        employeeId: req.user.userId,
        employeeName: user?.name || "Team Member",
        employeeAvatar: user?.avatar || undefined,
        date: standupDate,
        yesterday,
        today,
        blockers,
        tasksWorkedOn: validTaskIds.map(String),
        createdAt: standup.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Submit Standup Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to submit daily standup",
    });
  }
};

// =====================================================
// GET STANDUP NOTES
// =====================================================

export const getStandups = async (
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

    const { date, employeeId } = req.query;
    const filter: Record<string, any> = {};

    if (date && date !== "all") {
      filter.date = String(date);
    }

    if (req.user.role === "EMPLOYEE") {
      filter.employee = req.user.userId;
    } else if (req.user.role === "PROJECT_MANAGER") {
      const deptEmployees = await User.find({
        department: req.user.department,
      }).select("_id");
      filter.employee = { $in: deptEmployees.map((e) => e._id) };
    }

    if (employeeId && employeeId !== "all" && mongoose.Types.ObjectId.isValid(String(employeeId))) {
      filter.employee = employeeId;
    }

    const standups = await Standup.find(filter)
      .populate("employee", "name email employeeId avatar designation department")
      .populate("tasksWorkedOn", "taskCode title status")
      .sort({ createdAt: -1 });

    const formattedStandups = standups.map((s: any) => ({
      id: s._id,
      _id: s._id,
      employeeId: s.employee?._id,
      employeeName: s.employee?.name || "Employee",
      employeeAvatar: s.employee?.avatar || undefined,
      department: s.employee?.department?.name || s.employee?.department || "",
      date: s.date,
      yesterday: s.yesterday,
      today: s.today,
      blockers: s.blockers,
      tasksWorkedOn: s.tasksWorkedOn || [],
      createdAt: s.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedStandups,
    });
  } catch (error: any) {
    console.error("Get Standups Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch standups",
    });
  }
};
