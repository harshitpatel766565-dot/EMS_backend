import { Response } from "express";
import { AuthRequest } from "../middleware/authMiddleware";
import LoginSession from "../models/LoginSession";
import User from "../models/User";

// =====================================================
// GET LOGIN SESSIONS
// =====================================================

export const getLoginSessions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const { role, department } = req.user;

    let query: any = {};

    if (role === "SUPER_ADMIN") {
      // Super admin can see all login records
      query = {};
    } else if (role === "PROJECT_MANAGER") {
      // Project manager can see only employees in their department
      if (!department) {
        res.status(200).json({
          success: true,
          data: [],
        });
        return;
      }

      // Find all users belonging to PM's department
      const departmentUsers = await User.find({ department }).select("_id");
      const userIds = departmentUsers.map((u) => u._id);

      query = { employee: { $in: userIds } };
    } else {
      res.status(403).json({
        success: false,
        message: "You do not have permission to view login activity",
      });
      return;
    }

    const sessions = await LoginSession.find(query)
      .sort({ loginAt: -1 })
      .populate({
        path: "employee",
        select: "name employeeId department",
        populate: {
          path: "department",
          select: "name",
        },
      });

    const formattedSessions = sessions.map((s) => {
      const empObj = s.employee as any;
      const deptName = empObj?.department?.name || "--";
      const empIdStr = empObj?.employeeId || "--";
      const empName = s.employeeName || empObj?.name || "Unknown";

      return {
        id: s._id,
        employeeId: empObj?._id || s.employee,
        employeeName: empName,
        employeeCode: empIdStr,
        departmentName: deptName,
        loginAt: s.loginAt,
        logoutAt: s.logoutAt || null,
        durationMinutes: s.durationMinutes ?? null,
        ipAddress: s.ipAddress || "::1",
        status: s.logoutAt ? "Logged Out" : "Active",
        createdAt: s.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      data: formattedSessions,
    });
  } catch (error: any) {
    console.error("❌ Get Login Sessions Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Internal server error",
    });
  }
};
