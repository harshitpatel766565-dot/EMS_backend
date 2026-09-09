import { Response } from "express";
import mongoose from "mongoose";

import Sprint from "../models/Sprint";
import Project from "../models/Project";
import Task from "../models/Task";
import { AuthRequest } from "../middleware/authMiddleware";
import { createAuditLog } from "../services/auditService";

// =====================================================
// CREATE SPRINT
// =====================================================

export const createSprint = async (
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
        message: "Employees are not permitted to create sprints",
      });
      return;
    }

    const {
      project,
      projectId,
      name,
      goal = "",
      startDate,
      endDate,
      status = "PLANNED",
      taskIds = [],
      totalStoryPoints = 0,
    } = req.body;

    const targetProjectId = project || projectId;

    if (!targetProjectId || !name || !startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: "Project, name, start date, and end date are required",
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(String(targetProjectId))) {
      res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
      return;
    }

    const projectDoc = await Project.findById(targetProjectId);

    if (!projectDoc) {
      res.status(404).json({
        success: false,
        message: "Project not found",
      });
      return;
    }

    if (
      req.user.role === "PROJECT_MANAGER" &&
      String(projectDoc.department) !== req.user.department
    ) {
      res.status(403).json({
        success: false,
        message: "You can only create sprints for projects in your department",
      });
      return;
    }

    // Validate taskIds
    const validTaskObjectIds: mongoose.Types.ObjectId[] = [];
    let calculatedStoryPoints = Number(totalStoryPoints) || 0;

    if (Array.isArray(taskIds) && taskIds.length > 0) {
      for (const tId of taskIds) {
        if (mongoose.Types.ObjectId.isValid(String(tId))) {
          validTaskObjectIds.push(new mongoose.Types.ObjectId(String(tId)));
        }
      }

      const tasksInSprint = await Task.find({
        _id: { $in: validTaskObjectIds },
      });

      if (calculatedStoryPoints === 0) {
        calculatedStoryPoints = tasksInSprint.reduce(
          (sum, t) => sum + (t.storyPoints || 0),
          0
        );
      }
    }

    const sprint = await Sprint.create({
      project: targetProjectId,
      name: String(name).trim(),
      goal: String(goal).trim(),
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status: String(status).toUpperCase() === "ACTIVE" ? "ACTIVE" : "PLANNED",
      taskIds: validTaskObjectIds,
      totalStoryPoints: calculatedStoryPoints,
      completedStoryPoints: 0,
      createdBy: req.user.userId,
    });

    if (validTaskObjectIds.length > 0) {
      await Task.updateMany(
        { _id: { $in: validTaskObjectIds } },
        { $set: { sprint: sprint._id } }
      );
    }

    await createAuditLog({
      actorId: req.user.userId,
      actorName: req.user.role === "SUPER_ADMIN" ? "Super Admin" : "Project Manager",
      action: `Created sprint "${sprint.name}"`,
      entity: "SPRINT",
      entityId: String(sprint._id),
      description: `Sprint created for project "${projectDoc.name}"`,
      ipAddress: req.ip,
    });

    const populatedSprint = await Sprint.findById(sprint._id)
      .populate("project", "name code department")
      .populate("taskIds", "taskCode title priority status storyPoints progress")
      .populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Sprint created successfully",
      data: populatedSprint,
    });
  } catch (error: any) {
    console.error("Create Sprint Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to create sprint",
    });
  }
};

// =====================================================
// GET SPRINTS
// =====================================================

export const getSprints = async (
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

    const { projectId } = req.query;
    const filter: Record<string, any> = {};

    if (
      projectId &&
      projectId !== "all" &&
      mongoose.Types.ObjectId.isValid(String(projectId))
    ) {
      filter.project = projectId;
    }

    if (req.user.role === "PROJECT_MANAGER") {
      const pmProjects = await Project.find({
        department: req.user.department,
      }).select("_id");
      const pmProjectIds = pmProjects.map((p) => p._id);
      if (!filter.project) {
        filter.project = { $in: pmProjectIds };
      }
    }

    const sprints = await Sprint.find(filter)
      .populate("project", "name code department")
      .populate("taskIds", "taskCode title priority status storyPoints progress assignees")
      .populate("createdBy", "name email")
      .sort({ startDate: -1 });

    // Format burndown data for frontend
    const enrichedSprints = sprints.map((s: any) => {
      const tasks = s.taskIds || [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t: any) => t.status === "DONE").length;
      const totalPoints = s.totalStoryPoints || tasks.reduce((sum: number, t: any) => sum + (t.storyPoints || 0), 0);
      const completedPoints = tasks
        .filter((t: any) => t.status === "DONE")
        .reduce((sum: number, t: any) => sum + (t.storyPoints || 0), 0);

      return {
        id: s._id,
        _id: s._id,
        name: s.name,
        goal: s.goal,
        projectId: s.project?._id || s.project,
        projectName: s.project?.name || "Project",
        projectCode: s.project?.code,
        startDate: s.startDate ? new Date(s.startDate).toISOString().split("T")[0] : "",
        endDate: s.endDate ? new Date(s.endDate).toISOString().split("T")[0] : "",
        status: s.status === "ACTIVE" ? "active" : s.status === "COMPLETED" ? "completed" : "future",
        totalStoryPoints: totalPoints || 25,
        completedStoryPoints: completedPoints,
        totalTasks,
        completedTasks,
        taskIds: tasks.map((t: any) => String(t._id || t)),
        burndown: [
          { day: "Day 1", date: s.startDate, idealRemaining: totalPoints || 25, actualRemaining: totalPoints || 25 },
          { day: "Mid", idealRemaining: Math.round((totalPoints || 25) / 2), actualRemaining: Math.max((totalPoints || 25) - completedPoints, 0) },
          { day: "End", date: s.endDate, idealRemaining: 0, actualRemaining: Math.max((totalPoints || 25) - completedPoints, 0) },
        ],
      };
    });

    res.status(200).json({
      success: true,
      data: enrichedSprints,
      total: enrichedSprints.length,
    });
  } catch (error: any) {
    console.error("Get Sprints Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch sprints",
    });
  }
};

// =====================================================
// GET SPRINT BY ID
// =====================================================

export const getSprintById = async (
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
        message: "Invalid sprint ID",
      });
      return;
    }

    const sprint = await Sprint.findById(id)
      .populate("project", "name code department")
      .populate("taskIds")
      .populate("createdBy", "name email");

    if (!sprint) {
      res.status(404).json({
        success: false,
        message: "Sprint not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: sprint,
    });
  } catch (error: any) {
    console.error("Get Sprint Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch sprint",
    });
  }
};

// =====================================================
// UPDATE SPRINT
// =====================================================

export const updateSprint = async (
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
        message: "Invalid sprint ID",
      });
      return;
    }

    const sprint = await Sprint.findById(id);

    if (!sprint) {
      res.status(404).json({
        success: false,
        message: "Sprint not found",
      });
      return;
    }

    const { name, goal, startDate, endDate, status, taskIds, totalStoryPoints } = req.body;

    if (name !== undefined) sprint.name = String(name).trim();
    if (goal !== undefined) sprint.goal = String(goal).trim();
    if (startDate !== undefined) sprint.startDate = new Date(startDate);
    if (endDate !== undefined) sprint.endDate = new Date(endDate);
    if (status !== undefined) {
      const upperStatus = String(status).toUpperCase();
      sprint.status = (upperStatus === "ACTIVE" ? "ACTIVE" : upperStatus === "COMPLETED" ? "COMPLETED" : "PLANNED") as any;
    }
    if (totalStoryPoints !== undefined) sprint.totalStoryPoints = Number(totalStoryPoints) || 0;

    if (taskIds !== undefined && Array.isArray(taskIds)) {
      sprint.taskIds = taskIds
        .filter((tId) => mongoose.Types.ObjectId.isValid(String(tId)))
        .map((tId) => new mongoose.Types.ObjectId(String(tId)));

      await Task.updateMany(
        { _id: { $in: sprint.taskIds } },
        { $set: { sprint: sprint._id } }
      );
    }

    await sprint.save();

    await createAuditLog({
      actorId: req.user.userId,
      actorName: req.user.role === "SUPER_ADMIN" ? "Super Admin" : "Project Manager",
      action: `Updated sprint "${sprint.name}" (${sprint.status})`,
      entity: "SPRINT",
      entityId: String(sprint._id),
      description: `Sprint updated`,
      ipAddress: req.ip,
    });

    const updatedSprint = await Sprint.findById(sprint._id)
      .populate("project", "name code department")
      .populate("taskIds", "taskCode title priority status storyPoints progress")
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      message: "Sprint updated successfully",
      data: updatedSprint,
    });
  } catch (error: any) {
    console.error("Update Sprint Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to update sprint",
    });
  }
};

// =====================================================
// DELETE SPRINT
// =====================================================

export const deleteSprint = async (
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
        message: "Invalid sprint ID",
      });
      return;
    }

    const sprint = await Sprint.findById(id);

    if (!sprint) {
      res.status(404).json({
        success: false,
        message: "Sprint not found",
      });
      return;
    }

    await Task.updateMany({ sprint: sprint._id }, { $unset: { sprint: 1 } });
    await Sprint.findByIdAndDelete(id);

    await createAuditLog({
      actorId: req.user.userId,
      actorName: req.user.role === "SUPER_ADMIN" ? "Super Admin" : "Project Manager",
      action: `Deleted sprint "${sprint.name}"`,
      entity: "SPRINT",
      entityId: id,
      description: `Sprint deleted`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Sprint deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete Sprint Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to delete sprint",
    });
  }
};
