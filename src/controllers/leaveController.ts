import { Response } from "express";
import mongoose from "mongoose";

import LeaveRequest from "../models/LeaveRequest";
import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";
import { createAuditLog } from "../services/auditService";
import { createNotification } from "../services/notificationService";
import { sendLeaveStatusEmail } from "../services/emailService";

// =====================================================
// APPLY FOR LEAVE
// =====================================================

export const applyLeave = async (
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

    const { leaveType, startDate, endDate, reason } = req.body;

    if (!leaveType || !startDate || !endDate || !reason) {
      res.status(400).json({
        success: false,
        message: "Leave type, start date, end date, and reason are required",
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({
        success: false,
        message: "Invalid start date or end date format",
      });
      return;
    }

    if (start > end) {
      res.status(400).json({
        success: false,
        message: "Start date cannot be after end date",
      });
      return;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const formattedLeaveType = String(leaveType).toUpperCase();
    const validLeaveTypes = ["CASUAL", "SICK", "EARNED", "OTHER"];

    if (!validLeaveTypes.includes(formattedLeaveType)) {
      res.status(400).json({
        success: false,
        message: "Invalid leave type. Must be CASUAL, SICK, EARNED, or OTHER",
      });
      return;
    }

    const user = await User.findById(req.user.userId);

    const leave = await LeaveRequest.create({
      employee: req.user.userId,
      leaveType: formattedLeaveType as any,
      startDate: start,
      endDate: end,
      days: days > 0 ? days : 1,
      reason: String(reason).trim(),
      status: "PENDING",
    });

    // Notify Department PMs and Admins
    if (user?.department) {
      const pmUsers = await User.find({
        department: user.department,
        role: "PROJECT_MANAGER",
        isActive: true,
      });

      for (const pm of pmUsers) {
        await createNotification({
          userId: pm._id,
          title: "New Leave Application",
          message: `${user.name} applied for ${leave.days} day(s) ${formattedLeaveType} leave from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}.`,
          type: "LEAVE",
          link: "/leave",
        });
      }
    }

    await createAuditLog({
      actorId: req.user.userId,
      actorName: user?.name || "Employee",
      action: `Applied for ${leave.days} day(s) ${formattedLeaveType} leave`,
      entity: "LEAVE",
      entityId: String(leave._id),
      description: `Leave request from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
      ipAddress: req.ip,
    });

    const populatedLeave = await LeaveRequest.findById(leave._id).populate(
      "employee",
      "name email employeeId avatar designation department"
    );

    res.status(201).json({
      success: true,
      message: "Leave application submitted successfully",
      data: formatLeaveResponse(populatedLeave),
    });
  } catch (error: any) {
    console.error("Apply Leave Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to submit leave application",
    });
  }
};

// =====================================================
// GET LEAVES
// =====================================================

export const getLeaves = async (
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

    const { employeeId, status, department } = req.query;
    const filter: Record<string, any> = {};

    if (req.user.role === "EMPLOYEE") {
      filter.employee = req.user.userId;
    } else if (req.user.role === "PROJECT_MANAGER") {
      const deptUsers = await User.find({
        department: req.user.department,
      }).select("_id");
      filter.employee = { $in: deptUsers.map((u) => u._id) };
    } else if (req.user.role === "SUPER_ADMIN") {
      if (
        department &&
        department !== "all" &&
        mongoose.Types.ObjectId.isValid(String(department))
      ) {
        const deptUsers = await User.find({
          department: new mongoose.Types.ObjectId(String(department)),
        }).select("_id");
        filter.employee = { $in: deptUsers.map((u) => u._id) };
      }
    }

    if (
      employeeId &&
      employeeId !== "all" &&
      mongoose.Types.ObjectId.isValid(String(employeeId))
    ) {
      filter.employee = employeeId;
    }

    if (status && status !== "all") {
      filter.status = String(status).toUpperCase();
    }

    const leaves = await LeaveRequest.find(filter)
      .populate({
        path: "employee",
        select: "name email employeeId avatar designation department",
        populate: { path: "department", select: "name" },
      })
      .populate("approvedBy", "name email")
      .sort({ createdAt: -1 });

    const formatted = leaves.map(formatLeaveResponse);

    res.status(200).json({
      success: true,
      data: formatted,
      total: formatted.length,
    });
  } catch (error: any) {
    console.error("Get Leaves Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch leaves",
    });
  }
};

// =====================================================
// GET LEAVE BY ID
// =====================================================

export const getLeaveById = async (
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

    const id = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid leave ID",
      });
      return;
    }

    const leave = await LeaveRequest.findById(id)
      .populate("employee", "name email employeeId avatar designation department")
      .populate("approvedBy", "name email");

    if (!leave) {
      res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: formatLeaveResponse(leave),
    });
  } catch (error: any) {
    console.error("Get Leave By ID Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch leave request",
    });
  }
};

// =====================================================
// APPROVE LEAVE
// SUPER ADMIN + PM
// =====================================================

export const approveLeave = async (
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
        message: "Employees cannot approve leave requests",
      });
      return;
    }

    const id = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid leave ID",
      });
      return;
    }

    const leave = await LeaveRequest.findById(id).populate("employee");

    if (!leave) {
      res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
      return;
    }

    if (leave.status === "APPROVED") {
      res.status(400).json({
        success: false,
        message: "Leave request is already approved",
      });
      return;
    }

    const employeeUser = (await User.findById(leave.employee)) as any;

    if (
      req.user.role === "PROJECT_MANAGER" &&
      String(employeeUser?.department) !== req.user.department
    ) {
      res.status(403).json({
        success: false,
        message: "You can only approve leaves for employees in your department",
      });
      return;
    }

    // Deduct leave balance if employee exists
    if (employeeUser && employeeUser.leaveBalance) {
      const leaveTypeLower = String(leave.leaveType).toLowerCase();
      if (leaveTypeLower === "casual") {
        employeeUser.leaveBalance.casual = Math.max(
          (employeeUser.leaveBalance.casual || 12) - leave.days,
          0
        );
      } else if (leaveTypeLower === "sick") {
        employeeUser.leaveBalance.sick = Math.max(
          (employeeUser.leaveBalance.sick || 10) - leave.days,
          0
        );
      } else if (leaveTypeLower === "earned") {
        employeeUser.leaveBalance.earned = Math.max(
          (employeeUser.leaveBalance.earned || 15) - leave.days,
          0
        );
      }
      await employeeUser.save();
    }

    leave.status = "APPROVED";
    leave.approvedBy = new mongoose.Types.ObjectId(req.user.userId);
    leave.rejectionReason = "";
    await leave.save();

    // In-app notification
    await createNotification({
      userId: employeeUser._id,
      title: "Leave Request Approved ✅",
      message: `Your ${leave.leaveType} leave request for ${leave.days} day(s) has been approved.`,
      type: "LEAVE",
      link: "/leave",
    });

    // Email notification
    if (employeeUser?.email) {
      sendLeaveStatusEmail(
        employeeUser.email,
        employeeUser.name,
        leave.leaveType,
        "APPROVED",
        leave.startDate,
        leave.endDate
      ).catch((e) => console.error("Leave email error:", e));
    }

    const reviewer = await User.findById(req.user.userId);

    await createAuditLog({
      actorId: req.user.userId,
      actorName: reviewer?.name || (req.user.role === "SUPER_ADMIN" ? "Super Admin" : "Project Manager"),
      action: `Approved leave request for ${employeeUser?.name || "Employee"} (${leave.days} days)`,
      entity: "LEAVE",
      entityId: String(leave._id),
      description: `Leave approved from ${new Date(leave.startDate).toLocaleDateString()} to ${new Date(leave.endDate).toLocaleDateString()}`,
      ipAddress: req.ip,
    });

    const populated = await LeaveRequest.findById(leave._id)
      .populate("employee", "name email employeeId avatar designation department")
      .populate("approvedBy", "name email");

    res.status(200).json({
      success: true,
      message: "Leave approved successfully",
      data: formatLeaveResponse(populated),
    });
  } catch (error: any) {
    console.error("Approve Leave Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to approve leave request",
    });
  }
};

// =====================================================
// REJECT LEAVE
// SUPER ADMIN + PM
// =====================================================

export const rejectLeave = async (
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
        message: "Employees cannot reject leave requests",
      });
      return;
    }

    const id = String(req.params.id);
    const { rejectionReason } = req.body;

    if (!rejectionReason || !String(rejectionReason).trim()) {
      res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid leave ID",
      });
      return;
    }

    const leave = await LeaveRequest.findById(id).populate("employee");

    if (!leave) {
      res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
      return;
    }

    const employeeUser = (await User.findById(leave.employee)) as any;

    if (
      req.user.role === "PROJECT_MANAGER" &&
      String(employeeUser?.department) !== req.user.department
    ) {
      res.status(403).json({
        success: false,
        message: "You can only reject leaves for employees in your department",
      });
      return;
    }

    leave.status = "REJECTED";
    leave.approvedBy = new mongoose.Types.ObjectId(req.user.userId);
    leave.rejectionReason = String(rejectionReason).trim();
    await leave.save();

    // In-app notification
    await createNotification({
      userId: employeeUser._id,
      title: "Leave Request Rejected ❌",
      message: `Your ${leave.leaveType} leave request was rejected. Reason: ${leave.rejectionReason}`,
      type: "LEAVE",
      link: "/leave",
    });

    // Email notification
    if (employeeUser?.email) {
      sendLeaveStatusEmail(
        employeeUser.email,
        employeeUser.name,
        leave.leaveType,
        "REJECTED",
        leave.startDate,
        leave.endDate,
        leave.rejectionReason
      ).catch((e) => console.error("Leave email error:", e));
    }

    const reviewer = await User.findById(req.user.userId);

    await createAuditLog({
      actorId: req.user.userId,
      actorName: reviewer?.name || (req.user.role === "SUPER_ADMIN" ? "Super Admin" : "Project Manager"),
      action: `Rejected leave request for ${employeeUser?.name || "Employee"}`,
      entity: "LEAVE",
      entityId: String(leave._id),
      description: `Leave rejected. Reason: ${leave.rejectionReason}`,
      ipAddress: req.ip,
    });

    const populated = await LeaveRequest.findById(leave._id)
      .populate("employee", "name email employeeId avatar designation department")
      .populate("approvedBy", "name email");

    res.status(200).json({
      success: true,
      message: "Leave rejected successfully",
      data: formatLeaveResponse(populated),
    });
  } catch (error: any) {
    console.error("Reject Leave Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to reject leave request",
    });
  }
};

// =====================================================
// GET CURRENT USER LEAVE BALANCES
// =====================================================

export const getMyLeaveBalances = async (
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

    const user = await User.findById(req.user.userId);

    const balances = user?.leaveBalance || {
      casual: 12,
      sick: 10,
      earned: 15,
    };

    res.status(200).json({
      success: true,
      data: balances,
    });
  } catch (error: any) {
    console.error("Get Leave Balances Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch leave balances",
    });
  }
};

// =====================================================
// GET LEAVE STATS FOR EMPLOYEE OR ADMIN
// =====================================================

export const getLeaveStats = async (
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

    const { employeeId } = req.query;
    let targetEmployeeId = req.user.userId;

    if (
      employeeId &&
      (req.user.role === "SUPER_ADMIN" || req.user.role === "PROJECT_MANAGER") &&
      mongoose.Types.ObjectId.isValid(String(employeeId))
    ) {
      targetEmployeeId = String(employeeId);
    }

    const targetUser = await User.findById(targetEmployeeId)
      .select("name email employeeId avatar designation leaveBalance department")
      .populate("department", "name");

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const startOfYear = new Date(currentYear, 0, 1);

    // Fetch all leaves for employee
    const allEmployeeLeaves = await LeaveRequest.find({
      employee: targetEmployeeId,
    }).sort({ createdAt: -1 });

    let totalTakenTillToday = 0;
    let annualUsed = 0;
    let currentMonthUsed = 0;
    const breakdown = {
      casual: 0,
      sick: 0,
      earned: 0,
      other: 0,
    };

    for (const leave of allEmployeeLeaves) {
      if (leave.status !== "APPROVED") continue;

      const days = leave.days || 1;
      const leaveStart = new Date(leave.startDate);
      const leaveEnd = new Date(leave.endDate);

      // Category breakdown
      const typeKey = String(leave.leaveType).toLowerCase();
      if (typeKey === "casual") breakdown.casual += days;
      else if (typeKey === "sick") breakdown.sick += days;
      else if (typeKey === "earned") breakdown.earned += days;
      else breakdown.other += days;

      // Till today
      if (leaveEnd <= now || leaveStart <= now) {
        totalTakenTillToday += days;
      }

      // Annual (current year)
      if (leaveStart >= startOfYear || leaveEnd >= startOfYear) {
        annualUsed += days;
      }

      // Current Month
      if (
        (leaveStart.getFullYear() === currentYear && leaveStart.getMonth() === currentMonth) ||
        (leaveEnd.getFullYear() === currentYear && leaveEnd.getMonth() === currentMonth)
      ) {
        currentMonthUsed += days;
      }
    }

    const balances = targetUser?.leaveBalance || {
      casual: 12,
      sick: 10,
      earned: 15,
    };

    const formattedHistory = allEmployeeLeaves.slice(0, 10).map(formatLeaveResponse);

    res.status(200).json({
      success: true,
      data: {
        employeeId: targetEmployeeId,
        employeeName: targetUser?.name || "Employee",
        employeeCode: targetUser?.employeeId || "",
        employeeAvatar: targetUser?.avatar || undefined,
        designation: targetUser?.designation || "",
        department:
          typeof targetUser?.department === "object" && (targetUser?.department as any)?.name
            ? (targetUser?.department as any).name
            : "",
        totalTakenTillToday,
        annualQuota: (balances.casual || 12) + (balances.sick || 10) + (balances.earned || 15) + annualUsed,
        annualUsed,
        currentMonthUsed,
        balances,
        breakdown,
        history: formattedHistory,
      },
    });
  } catch (error: any) {
    console.error("Get Leave Stats Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch leave statistics",
    });
  }
};

// =====================================================
// HELPER TO FORMAT LEAVE RESPONSE FOR FRONTEND
// =====================================================

function formatLeaveResponse(leaveDoc: any) {
  if (!leaveDoc) return null;
  const emp = leaveDoc.employee || {};
  return {
    id: String(leaveDoc._id),
    _id: String(leaveDoc._id),
    employeeId: String(emp._id || emp.id || ""),
    employeeName: emp.name || "Employee",
    employeeAvatar: emp.avatar || undefined,
    department:
      typeof emp.department === "object" && emp.department?.name
        ? emp.department.name
        : emp.department || "",
    leaveType: String(leaveDoc.leaveType).toLowerCase(),
    startDate: leaveDoc.startDate
      ? new Date(leaveDoc.startDate).toISOString().split("T")[0]
      : "",
    endDate: leaveDoc.endDate
      ? new Date(leaveDoc.endDate).toISOString().split("T")[0]
      : "",
    days: leaveDoc.days || 1,
    reason: leaveDoc.reason || "",
    status: String(leaveDoc.status).toLowerCase(),
    appliedOn: leaveDoc.createdAt
      ? new Date(leaveDoc.createdAt).toISOString().split("T")[0]
      : "",
    reviewedBy: leaveDoc.approvedBy?.name || undefined,
    rejectionReason: leaveDoc.rejectionReason || undefined,
    createdAt: leaveDoc.createdAt,
    updatedAt: leaveDoc.updatedAt,
  };
}
