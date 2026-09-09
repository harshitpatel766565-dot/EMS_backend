import { Response } from "express";
import mongoose from "mongoose";

import Task, { ITask, TaskStatus, TaskPriority } from "../models/Task";
import Project from "../models/Project";
import User from "../models/User";
import Sprint from "../models/Sprint";
import LeaveRequest from "../models/LeaveRequest";
import AuditLog from "../models/AuditLog";
import { AuthRequest } from "../middleware/authMiddleware";
import { createAuditLog } from "../services/auditService";
import { createBulkNotifications, createNotification } from "../services/notificationService";
import { sendTaskAssignedEmail } from "../services/emailService";

// Helper function to check if assigned employees are on approved leave
async function checkAssigneeLeaves(
  assigneeIds: mongoose.Types.ObjectId[],
  taskStartDate?: Date,
  taskDueDate?: Date
) {
  if (!assigneeIds || assigneeIds.length === 0) return [];
  const start = taskStartDate || new Date();
  const end = taskDueDate || start;

  const approvedLeaves = await LeaveRequest.find({
    employee: { $in: assigneeIds },
    status: "APPROVED",
    startDate: { $lte: end },
    endDate: { $gte: start },
  }).populate("employee", "name email employeeId");

  return approvedLeaves.map((l: any) => ({
    employeeId: String(l.employee._id),
    employeeName: l.employee.name,
    leaveType: l.leaveType,
    startDate: l.startDate,
    endDate: l.endDate,
    warning: `Employee '${l.employee.name}' is on approved ${l.leaveType} leave from ${new Date(l.startDate).toLocaleDateString()} to ${new Date(l.endDate).toLocaleDateString()}.`,
  }));
}

// Helper function to check circular dependencies in task relationships
async function hasCircularDependency(
  taskId: string,
  proposedDependencies: string[]
): Promise<{ hasCycle: boolean; cyclePath?: string }> {
  const visited = new Set<string>();
  const queue = [...proposedDependencies.map((id) => String(id))];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (currentId === String(taskId)) {
      const cycleTask = await Task.findById(currentId).select("taskCode title");
      return { hasCycle: true, cyclePath: cycleTask ? `${cycleTask.taskCode} - ${cycleTask.title}` : currentId };
    }

    if (!visited.has(currentId)) {
      visited.add(currentId);
      const depDoc = await Task.findById(currentId).select("dependencies taskCode title");
      if (depDoc && Array.isArray(depDoc.dependencies)) {
        for (const nextDep of depDoc.dependencies) {
          queue.push(String(nextDep));
        }
      }
    }
  }

  return { hasCycle: false };
}

// =====================================================
// CREATE TASK
// SUPER ADMIN + PROJECT MANAGER
// =====================================================

export const createTask = async (
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
        message: "Employees are not allowed to create tasks",
      });
      return;
    }

    const {
      title,
      description = "",
      project,
      projectId,
      sprint,
      sprintId,
      assignedTo = [],
      assigneeIds,
      priority = "MEDIUM",
      status = "TODO",
      dueDate,
      startDate,
      estimatedHours = 0,
      storyPoints = 0,
      progress = 0,
      blockers = [],
      dependencies = [],
      parentTask,
      subtasks = [],
    } = req.body;

    const targetProjectId = project || projectId;
    const targetSprintId = sprint || sprintId;
    const targetAssignees = assigneeIds || assignedTo;

    // -------------------------------------------------
    // VALIDATE REQUIRED FIELDS
    // -------------------------------------------------

    if (!title || !targetProjectId) {
      res.status(400).json({
        success: false,
        message: "Title and project are required",
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

    // -------------------------------------------------
    // VERIFY PROJECT & PERMISSIONS
    // -------------------------------------------------

    const projectDoc = await Project.findById(targetProjectId).populate("department");

    if (!projectDoc) {
      res.status(404).json({
        success: false,
        message: "Project not found",
      });
      return;
    }

    const projectDeptId =
      projectDoc.department &&
      typeof projectDoc.department === "object" &&
      "_id" in projectDoc.department
        ? String(projectDoc.department._id)
        : String(projectDoc.department);

    if (
      req.user.role === "PROJECT_MANAGER" &&
      req.user.department !== projectDeptId
    ) {
      res.status(403).json({
        success: false,
        message: "You can only create tasks for projects in your department",
      });
      return;
    }

    // -------------------------------------------------
    // VALIDATE ASSIGNED EMPLOYEES
    // -------------------------------------------------

    let validatedAssigneeIds: mongoose.Types.ObjectId[] = [];
    let assigneeUsers: any[] = [];

    const rawAssigneeList = Array.isArray(targetAssignees)
      ? targetAssignees
      : targetAssignees
      ? [targetAssignees]
      : [];

    if (rawAssigneeList.length > 0) {
      const uniqueIds = [
        ...new Set(rawAssigneeList.map((id: unknown) => String(id))),
      ];

      for (const empId of uniqueIds) {
        if (!mongoose.Types.ObjectId.isValid(empId)) {
          res.status(400).json({
            success: false,
            message: `Invalid employee ID: ${empId}`,
          });
          return;
        }
      }

      assigneeUsers = await User.find({
        _id: { $in: uniqueIds },
        role: "EMPLOYEE",
        isActive: true,
      });

      if (assigneeUsers.length !== uniqueIds.length) {
        res.status(400).json({
          success: false,
          message: "One or more assigned employees are invalid or inactive",
        });
        return;
      }

      // Validate all assignees belong to the project department
      const wrongDept = assigneeUsers.some(
        (emp) => !emp.department || String(emp.department) !== projectDeptId
      );

      if (wrongDept) {
        res.status(400).json({
          success: false,
          message: "Assigned employees must belong to the project department",
        });
        return;
      }

      validatedAssigneeIds = assigneeUsers.map((u) => u._id);
    }

    // -------------------------------------------------
    // VALIDATE SPRINT IF PROVIDED
    // -------------------------------------------------

    let validSprintId: mongoose.Types.ObjectId | undefined = undefined;

    if (targetSprintId && mongoose.Types.ObjectId.isValid(String(targetSprintId))) {
      const sprintDoc = await Sprint.findById(targetSprintId);
      if (sprintDoc) {
        validSprintId = sprintDoc._id as mongoose.Types.ObjectId;
      }
    }

    // -------------------------------------------------
    // GENERATE UNIQUE TASK CODE (TSK-101, etc.)
    // -------------------------------------------------

    const taskCount = await Task.countDocuments();
    const taskCode = `TSK-${taskCount + 101}`;

    // -------------------------------------------------
    // FORMAT SUBTASKS
    // -------------------------------------------------

    const formattedSubtasks = (subtasks || []).map(
      (st: any, index: number) => ({
        id: st.id || `sub-${Date.now()}-${index}`,
        title: typeof st === "string" ? st : st.title || `Subtask ${index + 1}`,
        completed: typeof st === "object" ? Boolean(st.completed) : false,
      })
    );

    // -------------------------------------------------
    // CREATE TASK
    // -------------------------------------------------

    const depIds = Array.isArray(dependencies)
      ? dependencies
          .map((id: any) => String(id))
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
      : [];

    const taskData: any = {
      taskCode,
      title: String(title).trim(),
      description: String(description).trim(),
      project: targetProjectId,
      sprint: validSprintId,
      assignedTo: validatedAssigneeIds,
      priority: (String(priority).toUpperCase() as TaskPriority) || "MEDIUM",
      status: (String(status).toUpperCase() as TaskStatus) || "TODO",
      dueDate: dueDate ? new Date(dueDate) : undefined,
      startDate: startDate ? new Date(startDate) : new Date(),
      estimatedHours: Number(estimatedHours) || 0,
      storyPoints: Number(storyPoints) || 0,
      progress: Math.min(Math.max(Number(progress) || 0, 0), 100),
      blockers: Array.isArray(blockers) ? blockers : [],
      dependencies: depIds.map((id) => new mongoose.Types.ObjectId(id)),
      parentTask:
        parentTask && mongoose.Types.ObjectId.isValid(String(parentTask))
          ? new mongoose.Types.ObjectId(String(parentTask))
          : undefined,
      subtasks: formattedSubtasks,
      comments: [],
      createdBy: req.user.userId,
    };

    const task = (await Task.create(taskData)) as unknown as ITask;

    // If sprint attached, add task to sprint's taskIds
    if (validSprintId) {
      await Sprint.findByIdAndUpdate(validSprintId, {
        $addToSet: { taskIds: task._id },
        $inc: { totalStoryPoints: Number(storyPoints) || 0 },
      });
    }

    // -------------------------------------------------
    // NOTIFICATIONS & AUDIT LOGS
    // -------------------------------------------------

    if (validatedAssigneeIds.length > 0) {
      await createBulkNotifications(validatedAssigneeIds, {
        title: "New Task Assigned",
        message: `You have been assigned task ${taskCode}: "${task.title}" in project "${projectDoc.name}".`,
        type: "TASK",
        link: `/tasks`,
      });

      // Send email notifications to assignees
      for (const assignee of assigneeUsers) {
        if (assignee.email) {
          sendTaskAssignedEmail(
            assignee.email,
            assignee.name,
            taskCode,
            task.title,
            projectDoc.name,
            task.dueDate
          ).catch((e) => console.error("Task email error:", e));
        }
      }
    }

    await createAuditLog({
      actorId: req.user.userId,
      actorName: req.user.role === "SUPER_ADMIN" ? "Super Admin" : "Project Manager",
      action: `Created task ${taskCode}: "${task.title}"`,
      entity: "TASK",
      entityId: String(task._id),
      description: `Task created for project ${projectDoc.name} with priority ${task.priority}`,
      ipAddress: req.ip,
    });

    // -------------------------------------------------
    // POPULATE & RETURN
    // -------------------------------------------------

    const populatedTask = await Task.findById(task._id)
      .populate("project", "name code department")
      .populate("sprint", "name status")
      .populate("assignedTo", "name email employeeId designation avatar department")
      .populate("createdBy", "name email")
      .populate("dependencies", "taskCode title status priority progress");

    // Check leave warnings
    const leaveWarnings = await checkAssigneeLeaves(
      validatedAssigneeIds,
      task.startDate,
      task.dueDate
    );

    res.status(201).json({
      success: true,
      message: leaveWarnings.length > 0
        ? `Task created. Warning: ${leaveWarnings.map((w) => w.warning).join(" ")}`
        : "Task created successfully",
      leaveWarnings,
      data: populatedTask,
    });
  } catch (error: any) {
    console.error("Create Task Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to create task",
    });
  }
};

// =====================================================
// GET TASKS
// ALL ROLES (FILTERED BY RBAC)
// =====================================================

export const getTasks = async (
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

    const {
      search,
      projectId,
      sprintId,
      assigneeId,
      status,
      priority,
      page = "1",
      limit = "100",
    } = req.query;

    const filter: Record<string, any> = {};

    // -------------------------------------------------
    // RBAC PERMISSION FILTERING
    // -------------------------------------------------

    if (req.user.role === "EMPLOYEE") {
      // Employees see tasks assigned to them
      filter.assignedTo = req.user.userId;
    } else if (req.user.role === "PROJECT_MANAGER") {
      // PM sees tasks belonging to projects in their department
      const pmProjects = await Project.find({
        department: req.user.department,
      }).select("_id");

      const pmProjectIds = pmProjects.map((p) => p._id);
      filter.project = { $in: pmProjectIds };
    }

    // -------------------------------------------------
    // QUERY PARAMETER FILTERS (Strip "all")
    // -------------------------------------------------

    if (projectId && projectId !== "all" && mongoose.Types.ObjectId.isValid(String(projectId))) {
      filter.project = projectId;
    }

    if (sprintId && sprintId !== "all" && mongoose.Types.ObjectId.isValid(String(sprintId))) {
      filter.sprint = sprintId;
    }

    if (assigneeId && assigneeId !== "all" && mongoose.Types.ObjectId.isValid(String(assigneeId))) {
      filter.assignedTo = assigneeId;
    }

    if (status && status !== "all") {
      filter.status = String(status).toUpperCase();
    }

    if (priority && priority !== "all") {
      filter.priority = String(priority).toUpperCase();
    }

    if (search) {
      const searchText = String(search).trim();
      filter.$or = [
        { title: { $regex: searchText, $options: "i" } },
        { taskCode: { $regex: searchText, $options: "i" } },
        { description: { $regex: searchText, $options: "i" } },
      ];
    }

    // -------------------------------------------------
    // PAGINATION
    // -------------------------------------------------

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const skip = (pageNumber - 1) * limitNumber;

    const [tasks, total] = await Promise.all([
      Task.find(filter)
        .populate("project", "name code department")
        .populate("sprint", "name status")
        .populate("assignedTo", "name email employeeId designation avatar department")
        .populate("createdBy", "name email")
        .populate("dependencies", "taskCode title status priority progress")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),
      Task.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: tasks,
      total,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error: any) {
    console.error("Get Tasks Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch tasks",
    });
  }
};

// =====================================================
// GET TASK BY ID
// =====================================================

export const getTaskById = async (
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
        message: "Invalid task ID",
      });
      return;
    }

    const task = await Task.findById(id)
      .populate("project", "name code department")
      .populate("sprint", "name status")
      .populate("assignedTo", "name email employeeId designation avatar department")
      .populate("createdBy", "name email")
      .populate("dependencies", "taskCode title status priority progress");

    if (!task) {
      res.status(404).json({
        success: false,
        message: "Task not found",
      });
      return;
    }

    const blockedByDocs = await Task.find({ dependencies: task._id })
      .select("taskCode title status priority progress")
      .lean();

    const responseData = {
      ...task.toObject(),
      blockedByTasks: blockedByDocs.map((t: any) => ({
        id: String(t._id),
        taskCode: t.taskCode,
        title: t.title,
        status: t.status,
        priority: t.priority,
        progress: t.progress,
      })),
    };

    res.status(200).json({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    console.error("Get Task By ID Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch task",
    });
  }
};

// =====================================================
// UPDATE TASK
// =====================================================

export const updateTask = async (
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
        message: "Invalid task ID",
      });
      return;
    }

    const task = await Task.findById(id).populate("project");

    if (!task) {
      res.status(404).json({
        success: false,
        message: "Task not found",
      });
      return;
    }

    // -------------------------------------------------
    // EMPLOYEE RESTRICTIONS
    // -------------------------------------------------

    if (req.user.role === "EMPLOYEE") {
      // Employees can update only tasks assigned to themselves.
      const employeeUserId = String(req.user.userId);

      const isAssignedToEmployee = (task.assignedTo || []).some(
        (assignedUserId: mongoose.Types.ObjectId) =>
          String(assignedUserId) === employeeUserId
      );

      if (!isAssignedToEmployee) {
        res.status(403).json({
          success: false,
          message: "You can only update tasks assigned to you",
        });
        return;
      }

      // Employees can update only progress, status, blockers and subtasks.
      const { status, progress, blockers, subtasks } = req.body;

      if (status !== undefined) task.status = String(status).toUpperCase() as any;
      if (progress !== undefined) task.progress = Math.min(Math.max(Number(progress) || 0, 0), 100);
      if (blockers !== undefined && Array.isArray(blockers)) task.blockers = blockers;
      if (subtasks !== undefined && Array.isArray(subtasks)) {
        task.subtasks = subtasks.map((st: any, index: number) => ({
          id: String(st.id || st._id || `sub-${Date.now()}-${index}`),
          title: typeof st === "string" ? st : String(st.title || `Subtask ${index + 1}`).trim(),
          completed: typeof st === "object" ? Boolean(st.completed) : false,
        }));
      }

      await task.save();

      await createAuditLog({
        actorId: req.user.userId,
        actorName: "Team Member",
        action: `Updated task progress to ${task.progress}% (${task.status})`,
        entity: "TASK",
        entityId: String(task._id),
        description: `Employee updated status/progress on task ${task.taskCode}`,
        ipAddress: req.ip,
      });

      const updatedTask = await Task.findById(task._id)
        .populate("project", "name code department")
        .populate("sprint", "name status")
        .populate("assignedTo", "name email employeeId designation avatar department")
        .populate("createdBy", "name email");

      res.status(200).json({
        success: true,
        message: "Task updated successfully",
        data: updatedTask,
      });
      return;
    }

    // -------------------------------------------------
    // PM / ADMIN FULL UPDATE
    // -------------------------------------------------

    const {
      title,
      description,
      priority,
      status,
      dueDate,
      startDate,
      estimatedHours,
      loggedHours,
      storyPoints,
      progress,
      blockers,
      dependencies,
      subtasks,
      assignedTo,
      assigneeIds,
      sprint,
      sprintId,
    } = req.body;

    if (title !== undefined) task.title = String(title).trim();
    if (description !== undefined) task.description = String(description).trim();
    if (priority !== undefined) task.priority = String(priority).toUpperCase() as any;
    if (status !== undefined) task.status = String(status).toUpperCase() as any;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : undefined;
    if (startDate !== undefined) task.startDate = startDate ? new Date(startDate) : undefined;
    if (estimatedHours !== undefined) task.estimatedHours = Number(estimatedHours) || 0;
    if (loggedHours !== undefined) task.loggedHours = Number(loggedHours) || 0;
    if (storyPoints !== undefined) task.storyPoints = Number(storyPoints) || 0;
    if (progress !== undefined) task.progress = Math.min(Math.max(Number(progress) || 0, 0), 100);
    if (blockers !== undefined && Array.isArray(blockers)) task.blockers = blockers;
    if (dependencies !== undefined && Array.isArray(dependencies)) {
      const depIds = dependencies
        .map((id: any) => String(id))
        .filter((id) => mongoose.Types.ObjectId.isValid(id));

      // 1. Self dependency check
      if (depIds.includes(String(task._id))) {
        res.status(400).json({
          success: false,
          message: "A task cannot depend on itself.",
        });
        return;
      }

      // 2. Circular dependency check
      const cycleCheck = await hasCircularDependency(String(task._id), depIds);
      if (cycleCheck.hasCycle) {
        res.status(400).json({
          success: false,
          message: `Circular dependency detected: Task '${cycleCheck.cyclePath}' already depends on this task.`,
        });
        return;
      }

      task.dependencies = depIds.map((id) => new mongoose.Types.ObjectId(id)) as any;
    }

    const targetAssignees = assigneeIds !== undefined ? assigneeIds : assignedTo;
    if (targetAssignees !== undefined && Array.isArray(targetAssignees)) {
      task.assignedTo = targetAssignees
        .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
        .map((id) => new mongoose.Types.ObjectId(String(id)));
    }

    const targetSprint = sprintId !== undefined ? sprintId : sprint;
    if (targetSprint !== undefined) {
      task.sprint =
        targetSprint && mongoose.Types.ObjectId.isValid(String(targetSprint))
          ? new mongoose.Types.ObjectId(String(targetSprint))
          : undefined;
    }

    if (subtasks !== undefined && Array.isArray(subtasks)) {
      task.subtasks = subtasks.map((st: any, index: number) => ({
        id: String(st.id || st._id || `sub-${Date.now()}-${index}`),
        title: typeof st === "string" ? st : String(st.title || `Subtask ${index + 1}`).trim(),
        completed: typeof st === "object" ? Boolean(st.completed) : false,
      }));
    }

    await task.save();

    await createAuditLog({
      actorId: req.user.userId,
      actorName: req.user.role === "SUPER_ADMIN" ? "Super Admin" : "Project Manager",
      action: `Updated task ${task.taskCode}: "${task.title}"`,
      entity: "TASK",
      entityId: String(task._id),
      description: `Task updated with status ${task.status}, priority ${task.priority}`,
      ipAddress: req.ip,
    });

    const updatedTask = await Task.findById(task._id)
      .populate("project", "name code department")
      .populate("sprint", "name status")
      .populate("assignedTo", "name email employeeId designation avatar department")
      .populate("createdBy", "name email")
      .populate("dependencies", "taskCode title status priority progress");

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: updatedTask,
    });
  } catch (error: any) {
    console.error("Update Task Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to update task",
    });
  }
};

// =====================================================
// UPDATE TASK STATUS (Kanban / Quick Action)
// =====================================================

export const updateTaskStatus = async (
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
    const { status } = req.body;

    if (!status) {
      res.status(400).json({
        success: false,
        message: "Status is required",
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid task ID",
      });
      return;
    }

    const task = await Task.findById(id);

    if (!task) {
      res.status(404).json({
        success: false,
        message: "Task not found",
      });
      return;
    }

    // Employees can change status only on tasks assigned to them.
    if (req.user.role === "EMPLOYEE") {
      const employeeUserId = String(req.user.userId);

      const isAssignedToEmployee = (task.assignedTo || []).some(
        (assignedUserId: mongoose.Types.ObjectId) =>
          String(assignedUserId) === employeeUserId
      );

      if (!isAssignedToEmployee) {
        res.status(403).json({
          success: false,
          message: "You can only update the status of tasks assigned to you",
        });
        return;
      }
    }

    const formattedStatus = String(status).toUpperCase();
    task.status = formattedStatus as any;

    if (formattedStatus === "DONE") {
      task.progress = 100;
    } else if (formattedStatus === "TODO" && task.progress === 100) {
      task.progress = 0;
    }

    await task.save();

    await createAuditLog({
      actorId: req.user.userId,
      actorName: req.user.role === "SUPER_ADMIN" ? "Super Admin" : "Team Member",
      action: `Moved task ${task.taskCode} to ${formattedStatus}`,
      entity: "TASK",
      entityId: String(task._id),
      description: `Task status updated to ${formattedStatus}`,
      ipAddress: req.ip,
    });

    const updatedTask = await Task.findById(task._id)
      .populate("project", "name code department")
      .populate("sprint", "name status")
      .populate("assignedTo", "name email employeeId designation avatar department")
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      message: "Task status updated successfully",
      data: updatedTask,
    });
  } catch (error: any) {
    console.error("Update Task Status Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to update task status",
    });
  }
};

// =====================================================
// ADD COMMENT TO TASK
// =====================================================

export const addTaskComment = async (
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
    const { content } = req.body;

    if (!content || !String(content).trim()) {
      res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid task ID",
      });
      return;
    }

    const user = await User.findById(req.user.userId);
    const task = await Task.findById(id);

    if (!task) {
      res.status(404).json({
        success: false,
        message: "Task not found",
      });
      return;
    }

    task.comments.push({
      id: `comment-${Date.now()}`,
      author: new mongoose.Types.ObjectId(req.user.userId),
      authorName: user?.name || "User",
      authorAvatar: user?.avatar || undefined,
      content: String(content).trim(),
      createdAt: new Date(),
    });

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate("project", "name code department")
      .populate("sprint", "name status")
      .populate("assignedTo", "name email employeeId designation avatar department")
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      data: updatedTask,
    });
  } catch (error: any) {
    console.error("Add Comment Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to add comment",
    });
  }
};

// =====================================================
// DELETE TASK
// SUPER ADMIN + PROJECT MANAGER
// =====================================================

export const deleteTask = async (
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
        message: "Employees cannot delete tasks",
      });
      return;
    }

    const id = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid task ID",
      });
      return;
    }

    const task = await Task.findById(id).populate("project");

    if (!task) {
      res.status(404).json({
        success: false,
        message: "Task not found",
      });
      return;
    }

    await Task.findByIdAndDelete(id);

    await createAuditLog({
      actorId: req.user.userId,
      actorName: req.user.role === "SUPER_ADMIN" ? "Super Admin" : "Project Manager",
      action: `Deleted task ${task.taskCode}: "${task.title}"`,
      entity: "TASK",
      entityId: id,
      description: `Task was deleted from the system`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete Task Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to delete task",
    });
  }
};

// =====================================================
// GET TASK AUDIT LOGS
// =====================================================

export const getTaskAuditLogs = async (
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
        message: "Invalid task ID",
      });
      return;
    }

    const logs = await AuditLog.find({ entity: "TASK", entityId: id })
      .populate("actor", "name email avatar designation")
      .sort({ createdAt: -1 });

    const formattedLogs = logs.map((log: any) => ({
      id: String(log._id),
      _id: String(log._id),
      actorName: log.actorName || log.actor?.name || "System",
      actorAvatar: log.actor?.avatar || undefined,
      action: log.action,
      description: log.description,
      ipAddress: log.ipAddress,
      timestamp: log.createdAt,
      createdAt: log.createdAt,
    }));

    res.status(200).json({
      success: true,
      data: formattedLogs,
    });
  } catch (error: any) {
    console.error("Get Task Audit Logs Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to fetch task audit logs",
    });
  }
};

