import { Response } from "express";
import mongoose from "mongoose";

import Project from "../models/Project";
import User from "../models/User";
import Department from "../models/Department";
import { AuthRequest } from "../middleware/authMiddleware";

// =====================================================
// ENUM NORMALIZERS
// =====================================================

const normalizePriority = (
  priority?: string
): "LOW" | "MEDIUM" | "HIGH" | "URGENT" => {
  if (!priority) return "MEDIUM";
  const p = String(priority).toUpperCase().trim();
  if (p === "LOW") return "LOW";
  if (p === "MEDIUM") return "MEDIUM";
  if (p === "HIGH") return "HIGH";
  if (p === "CRITICAL" || p === "URGENT") return "URGENT";
  return "MEDIUM";
};

const normalizeStatus = (
  status?: string
): "PLANNED" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED" => {
  if (!status) return "PLANNED";
  const s = String(status).toUpperCase().trim();
  if (s === "PLANNING" || s === "PLANNED") return "PLANNED";
  if (s === "IN_PROGRESS" || s === "INPROGRESS") return "IN_PROGRESS";
  if (s === "ON_HOLD" || s === "ONHOLD") return "ON_HOLD";
  if (s === "COMPLETED") return "COMPLETED";
  if (s === "CANCELLED" || s === "CANCELED") return "CANCELLED";
  return "PLANNED";
};

// =====================================================
// CREATE PROJECT
// SUPER ADMIN + PROJECT MANAGER
// =====================================================

export const createProject = async (
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

    if (req.user.role === "EMPLOYEE") {
      res.status(403).json({
        success: false,
        message: "Employees are not authorized to create projects",
      });
      return;
    }

    const {
      name,
      description,
      department,
      projectManager,
      employees = [],
      status,
      priority,
      startDate,
      endDate,
    } = req.body;

    // Development logging (sanitized, non-sensitive)
    console.log("[Create Project] Received payload:", {
      name,
      department,
      projectManager,
      employeesCount: Array.isArray(employees) ? employees.length : 0,
      priority,
      status,
      startDate,
      endDate,
    });

    console.log("[Create Project] Authenticated user:", {
      userId: req.user.userId,
      role: req.user.role,
      department: req.user.department,
    });

    // -------------------------------------------------
    // REQUIRED FIELDS
    // -------------------------------------------------

    if (!name || !String(name).trim()) {
      res.status(400).json({
        success: false,
        message: "Project name is required",
      });
      return;
    }

    if (!department || !String(department).trim()) {
      res.status(400).json({
        success: false,
        message: "Department is required",
      });
      return;
    }

    if (!projectManager || !String(projectManager).trim()) {
      res.status(400).json({
        success: false,
        message: "Project manager is required",
      });
      return;
    }

    let rawDept = department;
    if (typeof rawDept === "object" && rawDept !== null) {
      rawDept = rawDept._id || rawDept.id || "";
    }
    const departmentId = String(rawDept || "").trim();

    let rawManager = projectManager;
    if (typeof rawManager === "object" && rawManager !== null) {
      rawManager = rawManager._id || rawManager.id || "";
    }
    const managerId = String(rawManager || "").trim();

    // -------------------------------------------------
    // CHECK OBJECT IDS
    // -------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      res.status(400).json({
        success: false,
        message: `Invalid department ID format: ${departmentId}`,
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(managerId)) {
      res.status(400).json({
        success: false,
        message: `Invalid project manager ID format: ${managerId}`,
      });
      return;
    }

    // -------------------------------------------------
    // CHECK DEPARTMENT
    // -------------------------------------------------

    const departmentDoc = await Department.findById(departmentId);

    if (!departmentDoc) {
      res.status(400).json({
        success: false,
        message: "Selected department was not found",
      });
      return;
    }

    if (!departmentDoc.isActive) {
      res.status(400).json({
        success: false,
        message: "Selected department is currently inactive",
      });
      return;
    }

    // -------------------------------------------------
    // CHECK PROJECT MANAGER
    // -------------------------------------------------

    const manager = await User.findById(managerId);

    if (!manager) {
      res.status(404).json({
        success: false,
        message: "Selected project manager was not found",
      });
      return;
    }

    if (manager.role !== "PROJECT_MANAGER") {
      res.status(400).json({
        success: false,
        message: "Selected user is not a registered Project Manager",
      });
      return;
    }

    if (!manager.isActive) {
      res.status(400).json({
        success: false,
        message: "Selected project manager account is inactive",
      });
      return;
    }

    // -------------------------------------------------
    // PM MUST BELONG TO PROJECT DEPARTMENT
    // -------------------------------------------------

    const managerDepartmentId =
      manager.department && typeof manager.department === "object" && "_id" in (manager.department as any)
        ? String((manager.department as any)._id)
        : String(manager.department || "");

    if (
      !managerDepartmentId ||
      managerDepartmentId !== departmentId
    ) {
      res.status(400).json({
        success: false,
        message: "Project manager must belong to the selected project department",
      });
      return;
    }

    // -------------------------------------------------
    // PROJECT MANAGER OWN DEPARTMENT RESTRICTION
    // -------------------------------------------------

    if (req.user.role === "PROJECT_MANAGER") {
      let userDepartmentId = req.user.department;
      if (!userDepartmentId) {
        const currentUser = await User.findById(req.user.userId).select("department");
        if (currentUser?.department) {
          userDepartmentId = String(currentUser.department);
        }
      }

      if (
        !userDepartmentId ||
        String(userDepartmentId) !== departmentId
      ) {
        res.status(403).json({
          success: false,
          message: "Project Managers can only create projects in their own department",
        });
        return;
      }
    }

    // -------------------------------------------------
    // VALIDATE EMPLOYEES
    // -------------------------------------------------

    let employeeIds: mongoose.Types.ObjectId[] = [];

    if (Array.isArray(employees) && employees.length > 0) {
      const rawEmployeeIds = employees
        .map((id: unknown) => {
          if (typeof id === "object" && id !== null) {
            return String((id as any)._id || (id as any).id || "").trim();
          }
          return String(id).trim();
        })
        .filter((id: string) => id && id !== "undefined" && id !== "null");

      const uniqueEmployeeIds = [...new Set(rawEmployeeIds)];

      // Check every ID format
      for (const empId of uniqueEmployeeIds) {
        if (!mongoose.Types.ObjectId.isValid(empId)) {
          res.status(400).json({
            success: false,
            message: `Invalid employee ID format: ${empId}`,
          });
          return;
        }
      }

      if (uniqueEmployeeIds.length > 0) {
        const employeeUsers = await User.find({
          _id: { $in: uniqueEmployeeIds },
          role: "EMPLOYEE",
          isActive: true,
        });

        if (employeeUsers.length !== uniqueEmployeeIds.length) {
          res.status(400).json({
            success: false,
            message: "One or more assigned employees are invalid, inactive, or not found",
          });
          return;
        }

        // All employees must belong to same department
        const wrongDepartment = employeeUsers.some(
          (employee) =>
            !employee.department ||
            String(employee.department) !== departmentId
        );

        if (wrongDepartment) {
          res.status(400).json({
            success: false,
            message: "All assigned employees must belong to the selected project department",
          });
          return;
        }

        employeeIds = employeeUsers.map(
          (employee) => employee._id as mongoose.Types.ObjectId
        );
      }
    }

    // -------------------------------------------------
    // VALIDATE DATES
    // -------------------------------------------------

    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;

    if (startDate) {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        res.status(400).json({
          success: false,
          message: "Invalid start date format",
        });
        return;
      }
    }

    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        res.status(400).json({
          success: false,
          message: "Invalid end date format",
        });
        return;
      }
    }

    if (parsedStartDate && parsedEndDate && parsedEndDate < parsedStartDate) {
      res.status(400).json({
        success: false,
        message: "Target end date cannot be prior to start date",
      });
      return;
    }

    // -------------------------------------------------
    // CREATE PROJECT
    // -------------------------------------------------

    const finalStatus = normalizeStatus(status);
    const finalPriority = normalizePriority(priority);
    const projectCode = "PRJ-" + Math.random().toString(36).substring(2, 8).toUpperCase();

    const project = await Project.create({
      code: projectCode,
      name: String(name).trim(),
      description: description ? String(description).trim() : "",
      department: new mongoose.Types.ObjectId(departmentId),
      projectManager: new mongoose.Types.ObjectId(managerId),
      employees: employeeIds,
      status: finalStatus,
      priority: finalPriority,
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      createdBy: new mongoose.Types.ObjectId(req.user.userId),
    });

    // -------------------------------------------------
    // POPULATE PROJECT
    // -------------------------------------------------

    const populatedProject = await Project.findById(project._id)
      .populate("department", "name")
      .populate(
        "projectManager",
        "name email employeeId designation"
      )
      .populate(
        "employees",
        "name email employeeId designation"
      )
      .populate("createdBy", "name email");

    console.log("[Create Project] Successfully created project:", {
      id: project._id,
      code: projectCode,
      name: project.name,
      status: finalStatus,
      priority: finalPriority,
    });

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: populatedProject,
    });
  } catch (error: any) {
    console.error("Create Project Error:", error);

    if (error?.code === 11000) {
      res.status(409).json({
        success: false,
        message: "A project with this name already exists",
      });
      return;
    }

    if (error?.name === "ValidationError") {
      const messages = Object.values(error.errors || {}).map((e: any) => e.message);
      res.status(400).json({
        success: false,
        message: messages.join(", ") || "Project validation failed",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: error?.message || "Failed to create project",
    });
  }
};

// =====================================================
// GET ALL PROJECTS
// =====================================================

export const getProjects = async (
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
      status,
      priority,
      department,
      page = "1",
      limit = "10",
    } = req.query;

    const filter: Record<string, any> = {};

    // -------------------------------------------------
    // EMPLOYEE
    // Only assigned projects
    // -------------------------------------------------

    if (req.user.role === "EMPLOYEE") {
      filter.employees = req.user.userId;
    }

    // -------------------------------------------------
    // PROJECT MANAGER
    // Only own department
    // -------------------------------------------------

    if (req.user.role === "PROJECT_MANAGER") {
      if (!req.user.department) {
        res.status(403).json({
          success: false,
          message: "Project manager department not found",
        });
        return;
      }

      filter.department = req.user.department;
    }

    // -------------------------------------------------
    // SUPER ADMIN DEPARTMENT FILTER
    // -------------------------------------------------

    if (
      department &&
      department !== "all" &&
      req.user.role === "SUPER_ADMIN"
    ) {
      const departmentId = String(department);

      if (!mongoose.Types.ObjectId.isValid(departmentId)) {
        res.status(400).json({
          success: false,
          message: "Invalid department ID format",
        });
        return;
      }

      filter.department = departmentId;
    }

    // -------------------------------------------------
    // STATUS FILTER
    // -------------------------------------------------

    if (status && status !== "all") {
      filter.status = normalizeStatus(String(status));
    }

    // -------------------------------------------------
    // PRIORITY FILTER
    // -------------------------------------------------

    if (priority && priority !== "all") {
      filter.priority = normalizePriority(String(priority));
    }

    // -------------------------------------------------
    // SEARCH
    // -------------------------------------------------

    if (search) {
      const searchText = String(search);

      filter.$or = [
        {
          name: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          description: {
            $regex: searchText,
            $options: "i",
          },
        },
      ];
    }

    // -------------------------------------------------
    // PAGINATION
    // -------------------------------------------------

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const limitNumber = Math.min(
      Math.max(Number(limit) || 10, 1),
      100
    );

    const skip = (pageNumber - 1) * limitNumber;

    // -------------------------------------------------
    // FETCH PROJECTS
    // -------------------------------------------------

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .populate("department", "name")
        .populate(
          "projectManager",
          "name email employeeId designation"
        )
        .populate(
          "employees",
          "name email employeeId designation"
        )
        .populate("createdBy", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber),

      Project.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: projects,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(
          total / limitNumber
        ),
      },
    });
  } catch (error) {
    console.error("Get Projects Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
    });
  }
};

// =====================================================
// GET PROJECT BY ID
// =====================================================

export const getProjectById = async (
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

    // IMPORTANT:
    // Convert params.id to string
    // to avoid TypeScript string | string[] error
    const id = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
      return;
    }

    const project = await Project.findById(id)
      .populate("department", "name")
      .populate(
        "projectManager",
        "name email employeeId designation"
      )
      .populate(
        "employees",
        "name email employeeId designation"
      )
      .populate("createdBy", "name email");

    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found",
      });
      return;
    }

    // -------------------------------------------------
    // PM ACCESS
    // -------------------------------------------------

    const projectDepartment =
      project.department &&
      typeof project.department === "object" &&
      "_id" in project.department
        ? String(project.department._id)
        : String(project.department);

    if (
      req.user.role === "PROJECT_MANAGER" &&
      projectDepartment !== req.user.department
    ) {
      res.status(403).json({
        success: false,
        message: "You cannot access this project",
      });
      return;
    }

    // -------------------------------------------------
    // EMPLOYEE ACCESS
    // -------------------------------------------------

    if (req.user.role === "EMPLOYEE") {
      const isAssigned = project.employees.some(
        (employee: any) =>
          String(employee._id) === req.user?.userId
      );

      if (!isAssigned) {
        res.status(403).json({
          success: false,
          message: "You are not assigned to this project",
        });
        return;
      }
    }

    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error("Get Project Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch project",
    });
  }
};

// =====================================================
// UPDATE PROJECT
// =====================================================

export const updateProject = async (
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

    // IMPORTANT:
    // Convert params.id to string
    const id = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
      return;
    }

    const project = await Project.findById(id);

    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found",
      });
      return;
    }

    // -------------------------------------------------
    // EMPLOYEE CANNOT UPDATE
    // -------------------------------------------------

    if (req.user.role === "EMPLOYEE") {
      res.status(403).json({
        success: false,
        message: "Employees cannot update projects",
      });
      return;
    }

    // -------------------------------------------------
    // PM OWN DEPARTMENT ONLY
    // -------------------------------------------------

    if (
      req.user.role === "PROJECT_MANAGER" &&
      String(project.department) !== req.user.department
    ) {
      res.status(403).json({
        success: false,
        message: "You can only update projects in your department",
      });
      return;
    }

    const {
      name,
      description,
      department,
      projectManager,
      employees,
      status,
      priority,
      startDate,
      endDate,
    } = req.body;

    // -------------------------------------------------
    // NEW DEPARTMENT / MANAGER
    // -------------------------------------------------

    const newDepartment =
      department || project.department;

    const newManager =
      projectManager || project.projectManager;

    // -------------------------------------------------
    // VALIDATE DEPARTMENT
    // -------------------------------------------------

    if (department) {
      const departmentId = String(department);

      if (
        !mongoose.Types.ObjectId.isValid(
          departmentId
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid department ID",
        });
        return;
      }

      const departmentDoc =
        await Department.findById(departmentId);

      if (
        !departmentDoc ||
        !departmentDoc.isActive
      ) {
        res.status(400).json({
          success: false,
          message: "Department not found or inactive",
        });
        return;
      }

      // PM cannot move project
      if (
        req.user.role === "PROJECT_MANAGER" &&
        departmentId !== req.user.department
      ) {
        res.status(403).json({
          success: false,
          message: "You cannot move project to another department",
        });
        return;
      }
    }

    // -------------------------------------------------
    // VALIDATE PROJECT MANAGER
    // -------------------------------------------------

    const managerId = String(newManager);

    if (
      !mongoose.Types.ObjectId.isValid(managerId)
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid project manager ID",
      });
      return;
    }

    const manager =
      await User.findById(managerId);

    if (
      !manager ||
      manager.role !== "PROJECT_MANAGER"
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid project manager",
      });
      return;
    }

    if (!manager.isActive) {
      res.status(400).json({
        success: false,
        message: "Project manager is inactive",
      });
      return;
    }

    if (
      !manager.department ||
      String(manager.department) !==
        String(newDepartment)
    ) {
      res.status(400).json({
        success: false,
        message:
          "Project manager must belong to project department",
      });
      return;
    }

    // -------------------------------------------------
    // VALIDATE EMPLOYEES
    // -------------------------------------------------

    let employeeIds =
      project.employees;

    if (Array.isArray(employees)) {
      const uniqueEmployeeIds = [
        ...new Set(
          employees.map(
            (employeeId: unknown) =>
              String(employeeId)
          )
        ),
      ];

      // Validate ObjectIds
      for (const employeeId of uniqueEmployeeIds) {
        if (
          !mongoose.Types.ObjectId.isValid(
            employeeId
          )
        ) {
          res.status(400).json({
            success: false,
            message: `Invalid employee ID: ${employeeId}`,
          });
          return;
        }
      }

      const employeeUsers =
        await User.find({
          _id: {
            $in: uniqueEmployeeIds,
          },
          role: "EMPLOYEE",
          isActive: true,
        });

      if (
        employeeUsers.length !==
        uniqueEmployeeIds.length
      ) {
        res.status(400).json({
          success: false,
          message:
            "One or more employees are invalid or inactive",
        });
        return;
      }

      // Check department
      const wrongDepartment =
        employeeUsers.some(
          (employee) =>
            !employee.department ||
            String(employee.department) !==
              String(newDepartment)
        );

      if (wrongDepartment) {
        res.status(400).json({
          success: false,
          message:
            "All employees must belong to project department",
        });
        return;
      }

      employeeIds =
        employeeUsers.map(
          (employee) =>
            employee._id as mongoose.Types.ObjectId
        );
    }

    // -------------------------------------------------
    // UPDATE FIELDS
    // -------------------------------------------------

    if (name !== undefined) {
      const projectName = String(name).trim();

      if (!projectName) {
        res.status(400).json({
          success: false,
          message: "Project name cannot be empty",
        });
        return;
      }

      project.name = projectName;
    }

    if (description !== undefined) {
      project.description =
        String(description).trim();
    }

    project.department =
      newDepartment;

    project.projectManager =
      newManager;

    project.employees =
      employeeIds;

    if (status !== undefined) {
      project.status = normalizeStatus(status);
    }

    if (priority !== undefined) {
      project.priority = normalizePriority(priority);
    }

    let finalStartDate = project.startDate;
    let finalEndDate = project.endDate;

    if (startDate !== undefined) {
      if (startDate) {
        const d = new Date(startDate);
        if (isNaN(d.getTime())) {
          res.status(400).json({
            success: false,
            message: "Invalid start date format",
          });
          return;
        }
        finalStartDate = d;
      } else {
        finalStartDate = undefined;
      }
      project.startDate = finalStartDate;
    }

    if (endDate !== undefined) {
      if (endDate) {
        const d = new Date(endDate);
        if (isNaN(d.getTime())) {
          res.status(400).json({
            success: false,
            message: "Invalid end date format",
          });
          return;
        }
        finalEndDate = d;
      } else {
        finalEndDate = undefined;
      }
      project.endDate = finalEndDate;
    }

    if (finalStartDate && finalEndDate && finalEndDate < finalStartDate) {
      res.status(400).json({
        success: false,
        message: "Target end date cannot be prior to start date",
      });
      return;
    }

    // -------------------------------------------------
    // SAVE
    // -------------------------------------------------

    await project.save();

    // -------------------------------------------------
    // POPULATE UPDATED PROJECT
    // -------------------------------------------------

    const updatedProject =
      await Project.findById(project._id)
        .populate("department", "name")
        .populate(
          "projectManager",
          "name email employeeId designation"
        )
        .populate(
          "employees",
          "name email employeeId designation"
        )
        .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: updatedProject,
    });
  } catch (error) {
    console.error("Update Project Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update project",
    });
  }
};

// =====================================================
// DELETE PROJECT
// SUPER ADMIN + PROJECT MANAGER
// =====================================================

export const deleteProject = async (
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

    // -------------------------------------------------
    // EMPLOYEE CANNOT DELETE
    // -------------------------------------------------

    if (req.user.role === "EMPLOYEE") {
      res.status(403).json({
        success: false,
        message: "Employees cannot delete projects",
      });
      return;
    }

    // IMPORTANT:
    // Convert params.id to string
    const id = String(req.params.id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
      return;
    }

    const project =
      await Project.findById(id);

    if (!project) {
      res.status(404).json({
        success: false,
        message: "Project not found",
      });
      return;
    }

    // -------------------------------------------------
    // PM OWN DEPARTMENT ONLY
    // -------------------------------------------------

    if (
      req.user.role === "PROJECT_MANAGER" &&
      String(project.department) !==
        req.user.department
    ) {
      res.status(403).json({
        success: false,
        message:
          "You can only delete projects in your department",
      });
      return;
    }

    // -------------------------------------------------
    // DELETE
    // -------------------------------------------------

    await Project.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error("Delete Project Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete project",
    });
  }
};