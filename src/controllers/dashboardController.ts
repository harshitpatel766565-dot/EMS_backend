import { Response } from "express";
import mongoose from "mongoose";

import User from "../models/User";
import Project from "../models/Project";
import Task from "../models/Task";
import Sprint from "../models/Sprint";
import LeaveRequest from "../models/LeaveRequest";
import Department from "../models/Department";
import AuditLog from "../models/AuditLog";
import Notification from "../models/Notification";
import { AuthRequest } from "../middleware/authMiddleware";

// =====================================================
// SUPER ADMIN DASHBOARD
// =====================================================

export const getSuperAdminDashboard = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user || req.user.role !== "SUPER_ADMIN") {
      res.status(403).json({
        success: false,
        message: "Only Super Admin can access executive telemetry",
      });
      return;
    }

    const [
      allUsers,
      allProjects,
      allTasks,
      allLeaves,
      allDepartments,
      recentAuditLogs,
    ] = await Promise.all([
      User.find().populate("department", "name"),
      Project.find().populate("projectManager", "name").populate("department", "name"),
      Task.find().populate("project", "name code"),
      LeaveRequest.find({ status: "PENDING" }),
      Department.find({ isActive: true }),
      AuditLog.find().sort({ createdAt: -1 }).limit(10),
    ]);

    const totalEmployees = allUsers.length;
    const activeEmployees = allUsers.filter((u) => u.isActive).length;
    const totalProjectManagers = allUsers.filter((u) => u.role === "PROJECT_MANAGER").length;

    const totalProjects = allProjects.length;
    const activeProjects = allProjects.filter((p) => p.status === "IN_PROGRESS").length;

    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter((t) => t.status === "DONE").length;
    const now = new Date();
    const overdueTasks = allTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "DONE"
    ).length;

    const pendingLeaves = allLeaves.length;

    // Department Headcount
    const deptMap: Record<string, number> = {};
    allDepartments.forEach((d) => {
      deptMap[d.name] = 0;
    });

    allUsers.forEach((u: any) => {
      const dName = u.department?.name || "Unassigned";
      deptMap[dName] = (deptMap[dName] || 0) + 1;
    });

    const deptHeadcount = Object.keys(deptMap).map((name) => ({
      name,
      count: deptMap[name],
    }));

    // Department Workload
    const deptWorkload = allDepartments.map((d) => {
      const deptTasks = allTasks.filter((t: any) => {
        const p = allProjects.find((prj) => String(prj._id) === String(t.project?._id || t.project));
        return p && String(p.department?._id || p.department) === String(d._id);
      });
      const deptEmps = allUsers.filter(
        (u: any) => String(u.department?._id || u.department) === String(d._id)
      );

      const workloadHours = deptTasks.reduce((sum, t) => sum + (t.estimatedHours || 8), 0);
      const capacityHours = Math.max(deptEmps.length * 40, 40);

      return {
        department: d.name,
        workload: workloadHours,
        capacity: capacityHours,
      };
    });

    // Project Status Distribution
    const prjStatusMap: Record<string, number> = {
      "PLANNED": 0,
      "IN PROGRESS": 0,
      "ON HOLD": 0,
      "COMPLETED": 0,
      "CANCELLED": 0,
    };
    allProjects.forEach((p) => {
      const statusKey = p.status.replace("_", " ");
      prjStatusMap[statusKey] = (prjStatusMap[statusKey] || 0) + 1;
    });
    const prjStatusData = Object.keys(prjStatusMap).map((name) => ({
      name,
      value: prjStatusMap[name],
    }));

    // Task Status Distribution
    const tskStatusData = [
      {
        name: "Done",
        value: allTasks.filter((t) => t.status === "DONE").length,
        color: "#10b981",
      },
      {
        name: "In Progress",
        value: allTasks.filter((t) => t.status === "IN_PROGRESS").length,
        color: "#f59e0b",
      },
      {
        name: "Review",
        value: allTasks.filter((t) => t.status === "IN_REVIEW").length,
        color: "#8b5cf6",
      },
      {
        name: "To Do",
        value: allTasks.filter((t) => t.status === "TODO").length,
        color: "#06b6d4",
      },
    ];

    // Key Projects
    const keyProjects = allProjects.slice(0, 5).map((p: any) => {
      const prjTasks = allTasks.filter(
        (t: any) => String(t.project?._id || t.project) === String(p._id)
      );
      const doneTasks = prjTasks.filter((t) => t.status === "DONE").length;
      const progress = prjTasks.length > 0 ? Math.round((doneTasks / prjTasks.length) * 100) : 0;

      return {
        id: String(p._id),
        code: p.name.substring(0, 3).toUpperCase() + "-" + String(p._id).slice(-3),
        name: p.name,
        priority: String(p.priority).toLowerCase(),
        projectManagerName: p.projectManager?.name || "Unassigned",
        progress,
        status: String(p.status).toLowerCase(),
      };
    });

    // Recent Activities
    const recentActivities = recentAuditLogs.map((log: any) => ({
      id: String(log._id),
      actorName: log.actorName,
      action: log.action,
      entityTitle: log.entity,
      description: log.description,
      timestamp: new Date(log.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    res.status(200).json({
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        totalProjectManagers,
        totalProjects,
        activeProjects,
        totalTasks,
        completedTasks,
        overdueTasks,
        pendingLeaves,
        deptHeadcount,
        deptWorkload,
        prjStatusData,
        tskStatusData,
        projects: keyProjects,
        activities: recentActivities,
      },
    });
  } catch (error: any) {
    console.error("Super Admin Dashboard Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch dashboard data",
    });
  }
};

// =====================================================
// PROJECT MANAGER DASHBOARD
// =====================================================

export const getProjectManagerDashboard = async (
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

    const deptId = req.user.department;

    const [pmProjects, pmSprints, allTasks, pendingLeaves] = await Promise.all([
      Project.find(deptId ? { department: deptId } : {}).populate("department", "name"),
      Sprint.find(deptId ? {} : {}).populate("project").populate("taskIds").sort({ startDate: -1 }),
      Task.find().populate("project").populate("assignedTo", "name avatar"),
      LeaveRequest.find({ status: "PENDING" }).populate("employee", "name avatar department"),
    ]);

    const pmProjectIds = pmProjects.map((p) => String(p._id));
    const deptTasks = allTasks.filter((t: any) =>
      pmProjectIds.includes(String(t.project?._id || t.project))
    );

    const activeProjectsCount = pmProjects.filter((p) => p.status === "IN_PROGRESS").length;
    const myProjectsCount = pmProjects.length;

    const totalTasksCount = deptTasks.length;
    const completedTasksCount = deptTasks.filter((t) => t.status === "DONE").length;
    const now = new Date();
    const overdueTasksCount = deptTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "DONE"
    ).length;

    // Active sprint
    const activeSprintDoc =
      pmSprints.find((s: any) => s.status === "ACTIVE") || pmSprints[0];

    let activeSprint = null;
    if (activeSprintDoc) {
      const sTasks = (activeSprintDoc as any).taskIds || [];
      const completedPts = sTasks
        .filter((t: any) => t.status === "DONE")
        .reduce((sum: number, t: any) => sum + (t.storyPoints || 0), 0);
      const totalPts =
        (activeSprintDoc as any).totalStoryPoints ||
        sTasks.reduce((sum: number, t: any) => sum + (t.storyPoints || 0), 0) ||
        25;

      activeSprint = {
        id: String(activeSprintDoc._id),
        name: activeSprintDoc.name,
        goal: (activeSprintDoc as any).goal,
        status: String((activeSprintDoc as any).status).toLowerCase(),
        completedStoryPoints: completedPts,
        totalStoryPoints: totalPts,
        completedTasks: sTasks.filter((t: any) => t.status === "DONE").length,
        totalTasks: sTasks.length,
      };
    }

    // Pending Leaves for PM department
    const deptPendingLeaves = pendingLeaves
      .filter((l: any) => {
        if (!deptId) return true;
        const empDept = l.employee?.department;
        return empDept && String(empDept._id || empDept) === String(deptId);
      })
      .map((l: any) => ({
        id: String(l._id),
        employeeName: l.employee?.name || "Employee",
        employeeAvatar: l.employee?.avatar || undefined,
        leaveType: String(l.leaveType).toLowerCase(),
        startDate: new Date(l.startDate).toISOString().split("T")[0],
        endDate: new Date(l.endDate).toISOString().split("T")[0],
        days: l.days,
        reason: l.reason,
      }));

    // Sprint tasks priority preview
    const sprintBacklogTasks = deptTasks.slice(0, 5).map((t: any) => ({
      id: String(t._id),
      taskCode: t.taskCode,
      title: t.title,
      priority: String(t.priority).toLowerCase(),
      status: String(t.status).toLowerCase(),
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "",
    }));

    res.status(200).json({
      success: true,
      data: {
        activeProjectsCount,
        myProjectsCount,
        totalTasksCount,
        completedTasksCount,
        overdueTasksCount,
        activeSprint,
        pendingLeaves: deptPendingLeaves,
        tasks: sprintBacklogTasks,
        projects: pmProjects.map((p) => ({
          id: String(p._id),
          name: p.name,
          status: String(p.status).toLowerCase(),
          priority: String(p.priority).toLowerCase(),
        })),
      },
    });
  } catch (error: any) {
    console.error("PM Dashboard Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch PM dashboard",
    });
  }
};

// =====================================================
// EMPLOYEE DASHBOARD
// =====================================================

export const getEmployeeDashboard = async (
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

    const userId = req.user.userId;

    const [user, myTasks, myNotifications] = await Promise.all([
      User.findById(userId).populate("department", "name"),
      Task.find({ assignedTo: userId })
        .populate("project", "name code")
        .sort({ dueDate: 1 }),
      Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(5),
    ]);

    const totalMyTasks = myTasks.length;
    const inProgressTasks = myTasks.filter((t) => t.status === "IN_PROGRESS");
    const completedTasks = myTasks.filter((t) => t.status === "DONE");
    const todoTasks = myTasks.filter((t) => t.status === "TODO");
    const now = new Date();
    const overdueTasks = myTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "DONE"
    );

    const formattedTasks = myTasks.map((t: any) => ({
      id: String(t._id),
      taskCode: t.taskCode,
      title: t.title,
      description: t.description,
      projectName: t.project?.name || "Project",
      projectCode: t.project?.code,
      priority: String(t.priority).toLowerCase(),
      status: String(t.status).toLowerCase(),
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split("T")[0] : "",
      progress: t.progress || 0,
      subtasks: t.subtasks || [],
      blockers: t.blockers || [],
    }));

    const leaveBalance = user?.leaveBalance || {
      casual: 12,
      sick: 10,
      earned: 15,
    };

    res.status(200).json({
      success: true,
      data: {
        totalMyTasks,
        inProgressCount: inProgressTasks.length,
        completedCount: completedTasks.length,
        todoCount: todoTasks.length,
        overdueCount: overdueTasks.length,
        tasks: formattedTasks,
        leaveBalance,
        notifications: myNotifications.map((n: any) => ({
          _id: String(n._id),
          title: n.title,
          message: n.message,
          type: n.type,
          isRead: n.isRead,
          createdAt: n.createdAt,
        })),
      },
    });
  } catch (error: any) {
    console.error("Employee Dashboard Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch employee dashboard",
    });
  }
};
