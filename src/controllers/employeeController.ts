import { Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import User from "../models/User";
import Department from "../models/Department";

import { generateEmployeeId } from "../services/employeeIdService";
import { sendEmployeeCredentials } from "../services/emailService";
import { AuthRequest } from "../middleware/authMiddleware";
import { generateTemporaryPassword } from "../utils/generatePassword";
import { createAuditLog } from "../services/auditService";

// ============================================================
// CREATE PROJECT MANAGER
// SUPER ADMIN ONLY
// ============================================================

export const createProjectManager = async (
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

    if (req.user.role !== "SUPER_ADMIN") {
      res.status(403).json({
        success: false,
        message: "Only Super Admin can create Project Managers",
      });
      return;
    }

    const {
      name,
      email,
      department,
      contact,
      designation,
    } = req.body;

    // --------------------------------------------------------
    // REQUIRED FIELDS
    // --------------------------------------------------------

    if (
      !name?.trim() ||
      !email?.trim() ||
      !department?.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Name, email and department are required",
      });
      return;
    }

    // --------------------------------------------------------
    // EMAIL VALIDATION
    // --------------------------------------------------------

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
      return;
    }

    // --------------------------------------------------------
    // DEPARTMENT VALIDATION
    // --------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(department)) {
      res.status(400).json({
        success: false,
        message: "Invalid department ID",
      });
      return;
    }

    const departmentExists = await Department.findById(department);

    if (!departmentExists) {
      res.status(404).json({
        success: false,
        message: "Department not found",
      });
      return;
    }

    // --------------------------------------------------------
    // CHECK EXISTING USER
    // --------------------------------------------------------

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
      return;
    }

    // --------------------------------------------------------
    // PASSWORD
    // --------------------------------------------------------

    const temporaryPassword = generateTemporaryPassword();

    const hashedPassword = await bcrypt.hash(
      temporaryPassword,
      12
    );

    // --------------------------------------------------------
    // CREATE PROJECT MANAGER
    // --------------------------------------------------------

    const projectManager = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "PROJECT_MANAGER",
      department: departmentExists._id,
      contact: contact?.trim(),
      designation: designation?.trim(),
      mustChangePassword: true,
      isActive: true,
    });

    // --------------------------------------------------------
    // SEND CREDENTIALS
    // --------------------------------------------------------

    try {
      await sendEmployeeCredentials(
        projectManager.email,
        projectManager.name,
        projectManager.email,
        temporaryPassword
      );
    } catch (emailError) {
      console.error(
        "Project Manager email sending failed:",
        emailError
      );
    }

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    res.status(201).json({
      success: true,
      message:
        "Project Manager created successfully. Login credentials have been sent by email.",
      data: {
        user: {
          id: projectManager._id,
          name: projectManager.name,
          email: projectManager.email,
          role: projectManager.role,
          department: projectManager.department,
          contact: projectManager.contact,
          designation: projectManager.designation,
          mustChangePassword:
            projectManager.mustChangePassword,
          isActive: projectManager.isActive,
          createdAt: projectManager.createdAt,
        },
      },
    });
  } catch (error: any) {
    console.error(
      "Create Project Manager Error:",
      error
    );

    if (error?.code === 11000) {
      res.status(409).json({
        success: false,
        message: "Email already exists",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to create Project Manager",
    });
  }
};

// ============================================================
// CREATE EMPLOYEE
// SUPER ADMIN + PROJECT MANAGER
// ============================================================

export const createEmployee = async (
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

    if (
      req.user.role !== "SUPER_ADMIN" &&
      req.user.role !== "PROJECT_MANAGER"
    ) {
      res.status(403).json({
        success: false,
        message:
          "Only Super Admin or Project Manager can create employees",
      });
      return;
    }

    const {
      name,
      email,
      department,
      contact,
      designation,
      reportingManager,
    } = req.body;

    // --------------------------------------------------------
    // REQUIRED FIELDS
    // --------------------------------------------------------

    if (
      !name?.trim() ||
      !email?.trim() ||
      !department?.trim()
    ) {
      res.status(400).json({
        success: false,
        message:
          "Name, email and department are required",
      });
      return;
    }

    // --------------------------------------------------------
    // EMAIL VALIDATION
    // --------------------------------------------------------

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
      return;
    }

    // --------------------------------------------------------
    // DEPARTMENT VALIDATION
    // --------------------------------------------------------

    if (!mongoose.Types.ObjectId.isValid(department)) {
      res.status(400).json({
        success: false,
        message: "Invalid department ID",
      });
      return;
    }

    const departmentExists = await Department.findById(
      department
    );

    if (!departmentExists) {
      res.status(404).json({
        success: false,
        message: "Department not found",
      });
      return;
    }

    // --------------------------------------------------------
    // PM CAN ONLY CREATE EMPLOYEE IN OWN DEPARTMENT
    // --------------------------------------------------------

    if (req.user.role === "PROJECT_MANAGER") {
      if (!req.user.department) {
        res.status(403).json({
          success: false,
          message:
            "Project Manager is not assigned to any department",
        });
        return;
      }

      if (
        String(req.user.department) !==
        String(departmentExists._id)
      ) {
        res.status(403).json({
          success: false,
          message:
            "Project Manager can only create employees in their own department",
        });
        return;
      }
    }

    // --------------------------------------------------------
    // REPORTING MANAGER VALIDATION
    // --------------------------------------------------------

    if (reportingManager) {
      if (
        !mongoose.Types.ObjectId.isValid(
          reportingManager
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid reporting manager",
        });
        return;
      }

      const manager = await User.findOne({
        _id: reportingManager,
        role: "PROJECT_MANAGER",
        isActive: true,
      });

      if (!manager) {
        res.status(400).json({
          success: false,
          message:
            "Reporting manager must be an active Project Manager",
        });
        return;
      }

      if (
        manager.department &&
        String(manager.department) !==
          String(departmentExists._id)
      ) {
        res.status(400).json({
          success: false,
          message:
            "Reporting Manager must belong to the selected department",
        });
        return;
      }
    }

    // --------------------------------------------------------
    // CHECK EXISTING USER
    // --------------------------------------------------------

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message:
          "A user with this email already exists",
      });
      return;
    }

    // --------------------------------------------------------
    // GENERATE EMPLOYEE ID
    // --------------------------------------------------------

    const employeeId = await generateEmployeeId();

    // --------------------------------------------------------
    // TEMPORARY PASSWORD
    // --------------------------------------------------------

    const temporaryPassword =
      generateTemporaryPassword();

    const hashedPassword = await bcrypt.hash(
      temporaryPassword,
      12
    );

    // --------------------------------------------------------
    // CREATE EMPLOYEE
    // --------------------------------------------------------

    const employee = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      employeeId,
      password: hashedPassword,
      role: "EMPLOYEE",
      department: departmentExists._id,
      contact: contact?.trim(),
      designation: designation?.trim(),
      reportingManager:
        reportingManager || undefined,
      mustChangePassword: true,
      isActive: true,
    });

    // --------------------------------------------------------
    // SEND LOGIN CREDENTIALS
    // --------------------------------------------------------

    try {
      await sendEmployeeCredentials(
        employee.email,
        employee.name,
        employee.employeeId || "",
        temporaryPassword
      );
    } catch (emailError) {
      console.error(
        "Employee email sending failed:",
        emailError
      );
    }

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    res.status(201).json({
      success: true,
      message:
        "Employee created successfully. Login credentials have been sent by email.",
      data: {
        employee: {
          id: employee._id,
          employeeId: employee.employeeId,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          department: employee.department,
          contact: employee.contact,
          designation: employee.designation,
          reportingManager:
            employee.reportingManager,
          mustChangePassword:
            employee.mustChangePassword,
          isActive: employee.isActive,
          createdAt: employee.createdAt,
        },
      },
    });
  } catch (error: any) {
    console.error(
      "Create Employee Error:",
      error
    );

    if (error?.code === 11000) {
      res.status(409).json({
        success: false,
        message:
          "Employee ID or email already exists",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Failed to create employee",
    });
  }
};

// ============================================================
// GET EMPLOYEES
// Search + Department + Role + Status + Pagination
// ============================================================

export const getEmployees = async (
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

    const {
      search,
      department,
      role,
      status,
      page = "1",
      limit = "8",
    } = req.query;

    const filter: any = {};

    // --------------------------------------------------------
    // SEARCH
    // --------------------------------------------------------

    const searchText = String(
      search || ""
    ).trim();

    if (searchText) {
      filter.$or = [
        {
          name: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          email: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          employeeId: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          designation: {
            $regex: searchText,
            $options: "i",
          },
        },
      ];
    }

    // --------------------------------------------------------
    // ROLE FILTER
    // --------------------------------------------------------

    const roleValue = String(
      role || ""
    ).trim();

    if (
      roleValue &&
      roleValue !== "all"
    ) {
      const validRoles = [
        "SUPER_ADMIN",
        "PROJECT_MANAGER",
        "EMPLOYEE",
      ];

      if (!validRoles.includes(roleValue)) {
        res.status(400).json({
          success: false,
          message: "Invalid role",
        });
        return;
      }

      filter.role = roleValue;
    }

    // --------------------------------------------------------
    // DEPARTMENT FILTER
    // --------------------------------------------------------

    const departmentValue = String(
      department || ""
    ).trim();

    if (
      departmentValue &&
      departmentValue !== "all"
    ) {
      if (
        !mongoose.Types.ObjectId.isValid(
          departmentValue
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid department ID",
        });
        return;
      }

      filter.department = departmentValue;
    }

    // --------------------------------------------------------
    // STATUS FILTER
    // --------------------------------------------------------

    const statusValue = String(
      status || ""
    ).trim();

    if (statusValue === "active") {
      filter.isActive = true;
    }

    if (statusValue === "inactive") {
      filter.isActive = false;
    }

    if (
      statusValue &&
      statusValue !== "all" &&
      statusValue !== "active" &&
      statusValue !== "inactive"
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid status",
      });
      return;
    }

    // --------------------------------------------------------
    // PROJECT MANAGER RESTRICTION
    // --------------------------------------------------------

    if (req.user.role === "PROJECT_MANAGER") {
      if (!req.user.department) {
        res.status(200).json({
          success: true,
          data: [],
          count: 0,
          total: 0,
          page: Number(page) || 1,
          limit: Number(limit) || 8,
          totalPages: 0,
        });
        return;
      }

      filter.department = req.user.department;
    }

    // --------------------------------------------------------
    // PAGINATION
    // --------------------------------------------------------

    const pageNumber = Math.max(
      1,
      Number(page) || 1
    );

    const limitNumber = Math.min(
      100,
      Math.max(1, Number(limit) || 8)
    );

    const skip =
      (pageNumber - 1) * limitNumber;

    // --------------------------------------------------------
    // TOTAL COUNT
    // --------------------------------------------------------

    const total =
      await User.countDocuments(filter);

    // --------------------------------------------------------
    // FETCH USERS
    // --------------------------------------------------------

    const employees = await User.find(filter)
      .select("-password -refreshToken")
      .populate("department", "name")
      .populate(
        "reportingManager",
        "name email employeeId"
      )
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limitNumber);

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    res.status(200).json({
      success: true,
      data: employees,
      count: employees.length,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(
        total / limitNumber
      ),
    });
  } catch (error) {
    console.error(
      "Get Employees Error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch employees",
    });
  }
};

// ============================================================
// GET EMPLOYEE BY ID
// ============================================================

export const getEmployeeById = async (
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

    const { id } = req.params;

    const employeeId = Array.isArray(id)
      ? id[0]
      : id;

    if (
      !employeeId ||
      !mongoose.Types.ObjectId.isValid(
        employeeId
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
      return;
    }

    const employee = await User.findById(
      employeeId
    )
      .select("-password -refreshToken")
      .populate("department", "name")
      .populate(
        "reportingManager",
        "name email employeeId"
      );

    if (!employee) {
      res.status(404).json({
        success: false,
        message: "Employee not found",
      });
      return;
    }

    // --------------------------------------------------------
    // PM CAN ONLY VIEW OWN DEPARTMENT
    // --------------------------------------------------------

    if (
      req.user.role === "PROJECT_MANAGER"
    ) {
      const employeeDepartmentId =
        employee.department &&
        typeof employee.department === "object" &&
        "_id" in employee.department
          ? String(
              employee.department._id
            )
          : String(employee.department);

      if (
        !req.user.department ||
        String(req.user.department) !==
          employeeDepartmentId
      ) {
        res.status(403).json({
          success: false,
          message:
            "You can only view employees from your own department",
        });
        return;
      }
    }

    res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error(
      "Get Employee Error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch employee",
    });
  }
};

// ============================================================
// UPDATE EMPLOYEE
// SUPER ADMIN → ANY EMPLOYEE
// PM → OWN DEPARTMENT EMPLOYEE
// ============================================================

export const updateEmployee = async (
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

    if (
      req.user.role !== "SUPER_ADMIN" &&
      req.user.role !== "PROJECT_MANAGER"
    ) {
      res.status(403).json({
        success: false,
        message:
          "You are not allowed to update employees",
      });
      return;
    }

    const { id } = req.params;

    const employeeId = Array.isArray(id)
      ? id[0]
      : id;

    if (
      !employeeId ||
      !mongoose.Types.ObjectId.isValid(
        employeeId
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
      return;
    }

    const employee = await User.findById(
      employeeId
    );

    if (!employee) {
      res.status(404).json({
        success: false,
        message: "Employee not found",
      });
      return;
    }

    if (employee.role !== "EMPLOYEE") {
      res.status(400).json({
        success: false,
        message:
          "This endpoint can only update employees",
      });
      return;
    }

    // --------------------------------------------------------
    // PM RESTRICTION
    // --------------------------------------------------------

    if (
      req.user.role === "PROJECT_MANAGER"
    ) {
      if (
        !req.user.department ||
        String(req.user.department) !==
          String(employee.department)
      ) {
        res.status(403).json({
          success: false,
          message:
            "Project Manager can only update employees in their own department",
        });
        return;
      }
    }

    const {
      name,
      email,
      department,
      contact,
      designation,
      reportingManager,
    } = req.body;

    // --------------------------------------------------------
    // NAME
    // --------------------------------------------------------

    if (name !== undefined) {
      const newName =
        String(name).trim();

      if (!newName) {
        res.status(400).json({
          success: false,
          message: "Name cannot be empty",
        });
        return;
      }

      employee.name = newName;
    }

    // --------------------------------------------------------
    // EMAIL
    // --------------------------------------------------------

    if (email !== undefined) {
      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          normalizedEmail
        )
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid email address",
        });
        return;
      }

      const emailExists =
        await User.findOne({
          email: normalizedEmail,
          _id: {
            $ne: employee._id,
          },
        });

      if (emailExists) {
        res.status(409).json({
          success: false,
          message: "Email already exists",
        });
        return;
      }

      employee.email =
        normalizedEmail;
    }

    // --------------------------------------------------------
    // DEPARTMENT
    // --------------------------------------------------------

    if (department !== undefined) {
      const departmentId =
        String(department);

      if (
        !mongoose.Types.ObjectId.isValid(
          departmentId
        )
      ) {
        res.status(400).json({
          success: false,
          message:
            "Invalid department ID",
        });
        return;
      }

      const departmentExists =
        await Department.findById(
          departmentId
        );

      if (!departmentExists) {
        res.status(404).json({
          success: false,
          message:
            "Department not found",
        });
        return;
      }

      // PM cannot move employee outside own department
      if (
        req.user.role === "PROJECT_MANAGER" &&
        String(req.user.department) !==
          String(departmentExists._id)
      ) {
        res.status(403).json({
          success: false,
          message:
            "Project Manager cannot move employee to another department",
        });
        return;
      }

      employee.department =
        departmentExists._id;
    }

    // --------------------------------------------------------
    // CONTACT
    // --------------------------------------------------------

    if (contact !== undefined) {
      employee.contact =
        String(contact).trim();
    }

    // --------------------------------------------------------
    // DESIGNATION
    // --------------------------------------------------------

    if (designation !== undefined) {
      employee.designation =
        String(designation).trim();
    }

    // --------------------------------------------------------
    // REPORTING MANAGER
    // --------------------------------------------------------

    if (
      reportingManager !== undefined
    ) {
      if (
        reportingManager === null ||
        reportingManager === ""
      ) {
        employee.reportingManager =
          undefined;
      } else {
        const managerId =
          String(reportingManager);

        if (
          !mongoose.Types.ObjectId.isValid(
            managerId
          )
        ) {
          res.status(400).json({
            success: false,
            message:
              "Invalid reporting manager",
          });
          return;
        }

        const manager =
          await User.findOne({
            _id: managerId,
            role: "PROJECT_MANAGER",
            isActive: true,
          });

        if (!manager) {
          res.status(400).json({
            success: false,
            message:
              "Reporting manager must be an active Project Manager",
          });
          return;
        }

        if (
          employee.department &&
          manager.department &&
          String(employee.department) !==
            String(manager.department)
        ) {
          res.status(400).json({
            success: false,
            message:
              "Reporting Manager must belong to the employee's department",
          });
          return;
        }

        employee.reportingManager =
          manager._id;
      }
    }

    // --------------------------------------------------------
    // SAVE
    // --------------------------------------------------------

    await employee.save();

    // --------------------------------------------------------
    // GET UPDATED EMPLOYEE
    // --------------------------------------------------------

    const updatedEmployee =
      await User.findById(
        employee._id
      )
        .select("-password -refreshToken")
        .populate(
          "department",
          "name"
        )
        .populate(
          "reportingManager",
          "name email employeeId"
        );

    res.status(200).json({
      success: true,
      message:
        "Employee updated successfully",
      data: updatedEmployee,
    });
  } catch (error: any) {
    console.error(
      "Update Employee Error:",
      error
    );

    if (error?.code === 11000) {
      res.status(409).json({
        success: false,
        message: "Email already exists",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message:
        "Failed to update employee",
    });
  }
};

// ============================================================
// DEACTIVATE USER
//
// SUPER ADMIN → EMPLOYEE + PROJECT MANAGER
// PROJECT MANAGER → OWN DEPARTMENT EMPLOYEE ONLY
// ============================================================

export const deactivateEmployee = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // --------------------------------------------------------
    // AUTH CHECK
    // --------------------------------------------------------

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // --------------------------------------------------------
    // ROLE CHECK
    // --------------------------------------------------------

    if (
      req.user.role !== "SUPER_ADMIN" &&
      req.user.role !== "PROJECT_MANAGER"
    ) {
      res.status(403).json({
        success: false,
        message: "Permission denied",
      });
      return;
    }

    // --------------------------------------------------------
    // USER ID
    // --------------------------------------------------------

    const { id } = req.params;

    const userId = Array.isArray(id)
      ? id[0]
      : id;

    if (
      !userId ||
      !mongoose.Types.ObjectId.isValid(
        userId
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
      return;
    }

    // --------------------------------------------------------
    // FIND USER
    // --------------------------------------------------------

    const user =
      await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // --------------------------------------------------------
    // SUPER ADMIN CANNOT DEACTIVATE HIMSELF
    // --------------------------------------------------------

    if (
      req.user.role === "SUPER_ADMIN" &&
      String((req.user as any)._id) ===
        String(user._id)
    ) {
      res.status(400).json({
        success: false,
        message:
          "You cannot deactivate your own account",
      });
      return;
    }

    // --------------------------------------------------------
    // ONLY EMPLOYEE OR PROJECT MANAGER
    // SUPER ADMIN CANNOT BE DEACTIVATED
    // --------------------------------------------------------

    if (
      user.role !== "EMPLOYEE" &&
      user.role !== "PROJECT_MANAGER"
    ) {
      res.status(400).json({
        success: false,
        message:
          "Super Admin account cannot be deactivated",
      });
      return;
    }

    // --------------------------------------------------------
    // PROJECT MANAGER RESTRICTION
    //
    // PM CAN ONLY DEACTIVATE EMPLOYEES
    // IN THEIR OWN DEPARTMENT
    // --------------------------------------------------------

    if (
      req.user.role === "PROJECT_MANAGER"
    ) {
      if (user.role !== "EMPLOYEE") {
        res.status(403).json({
          success: false,
          message:
            "Project Manager can only deactivate employees",
        });
        return;
      }

      if (
        !req.user.department ||
        String(req.user.department) !==
          String(user.department)
      ) {
        res.status(403).json({
          success: false,
          message:
            "Project Manager can only deactivate employees in their own department",
        });
        return;
      }
    }

    // --------------------------------------------------------
    // DEACTIVATE
    // --------------------------------------------------------

    user.isActive = false;

    // Invalidate refresh token
    user.refreshToken = undefined;

    await user.save();

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    res.status(200).json({
      success: true,
      message: `${
        user.role === "PROJECT_MANAGER"
          ? "Project Manager"
          : "Employee"
      } deactivated successfully`,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error(
      "Deactivate User Error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to deactivate user",
    });
  }
};

// ============================================================
// REACTIVATE USER
//
// SUPER ADMIN → EMPLOYEE + PROJECT MANAGER
// PROJECT MANAGER → OWN DEPARTMENT EMPLOYEE ONLY
// ============================================================

export const reactivateEmployee = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // --------------------------------------------------------
    // AUTH CHECK
    // --------------------------------------------------------

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // --------------------------------------------------------
    // ROLE CHECK
    // --------------------------------------------------------

    if (
      req.user.role !== "SUPER_ADMIN" &&
      req.user.role !== "PROJECT_MANAGER"
    ) {
      res.status(403).json({
        success: false,
        message: "Permission denied",
      });
      return;
    }

    // --------------------------------------------------------
    // USER ID
    // --------------------------------------------------------

    const { id } = req.params;

    const userId = Array.isArray(id)
      ? id[0]
      : id;

    if (
      !userId ||
      !mongoose.Types.ObjectId.isValid(
        userId
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
      return;
    }

    // --------------------------------------------------------
    // FIND USER
    // --------------------------------------------------------

    const user =
      await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // --------------------------------------------------------
    // ONLY EMPLOYEE OR PROJECT MANAGER
    // --------------------------------------------------------

    if (
      user.role !== "EMPLOYEE" &&
      user.role !== "PROJECT_MANAGER"
    ) {
      res.status(400).json({
        success: false,
        message:
          "Super Admin account cannot be reactivated here",
      });
      return;
    }

    // --------------------------------------------------------
    // PROJECT MANAGER RESTRICTION
    //
    // PM CAN ONLY REACTIVATE EMPLOYEES
    // IN THEIR OWN DEPARTMENT
    // --------------------------------------------------------

    if (
      req.user.role === "PROJECT_MANAGER"
    ) {
      if (user.role !== "EMPLOYEE") {
        res.status(403).json({
          success: false,
          message:
            "Project Manager can only reactivate employees",
        });
        return;
      }

      if (
        !req.user.department ||
        String(req.user.department) !==
          String(user.department)
      ) {
        res.status(403).json({
          success: false,
          message:
            "Project Manager can only reactivate employees in their own department",
        });
        return;
      }
    }

    // --------------------------------------------------------
    // REACTIVATE
    // --------------------------------------------------------

    user.isActive = true;

    await user.save();

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    res.status(200).json({
      success: true,
      message: `${
        user.role === "PROJECT_MANAGER"
          ? "Project Manager"
          : "Employee"
      } reactivated successfully`,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error(
      "Reactivate User Error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to reactivate user",
    });
  }
};

// ============================================================
// DELETE EMPLOYEE
//
// SUPER ADMIN → ANY EMPLOYEE
// PROJECT MANAGER → OWN DEPARTMENT EMPLOYEE ONLY
// ============================================================

export const deleteEmployee = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // --------------------------------------------------------
    // AUTH CHECK
    // --------------------------------------------------------

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    // --------------------------------------------------------
    // ROLE CHECK
    // --------------------------------------------------------

    if (
      req.user.role !== "SUPER_ADMIN" &&
      req.user.role !== "PROJECT_MANAGER"
    ) {
      res.status(403).json({
        success: false,
        message:
          "Only Super Admin or Project Manager can delete employees",
      });
      return;
    }

    // --------------------------------------------------------
    // EMPLOYEE ID
    // --------------------------------------------------------

    const { id } = req.params;

    const employeeId = Array.isArray(id)
      ? id[0]
      : id;

    if (
      !employeeId ||
      !mongoose.Types.ObjectId.isValid(
        employeeId
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid employee ID",
      });
      return;
    }

    // --------------------------------------------------------
    // FIND EMPLOYEE
    // --------------------------------------------------------

    const employee =
      await User.findById(employeeId);

    if (!employee) {
      res.status(404).json({
        success: false,
        message: "Employee not found",
      });
      return;
    }

    // --------------------------------------------------------
    // ONLY EMPLOYEE ACCOUNT CAN BE DELETED
    // --------------------------------------------------------

    if (employee.role !== "EMPLOYEE") {
      res.status(400).json({
        success: false,
        message:
          "Only employee accounts can be deleted",
      });
      return;
    }

    // --------------------------------------------------------
    // PM OWN DEPARTMENT ONLY
    // --------------------------------------------------------

    if (
      req.user.role === "PROJECT_MANAGER"
    ) {
      if (
        !req.user.department ||
        String(req.user.department) !==
          String(employee.department)
      ) {
        res.status(403).json({
          success: false,
          message:
            "Project Manager can only delete employees in their own department",
        });
        return;
      }
    }

    // --------------------------------------------------------
    // DELETE EMPLOYEE
    // --------------------------------------------------------

    await User.findByIdAndDelete(
      employee._id
    );

    // --------------------------------------------------------
    // RESPONSE
    // --------------------------------------------------------

    res.status(200).json({
      success: true,
      message:
        "Employee deleted successfully",
      data: {
        id: employee._id,
        employeeId:
          employee.employeeId,
        name: employee.name,
        email: employee.email,
      },
    });
  } catch (error) {
    console.error(
      "Delete Employee Error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to delete employee",
    });
  }
};

// ============================================================
// BULK IMPORT EMPLOYEES
// SUPER ADMIN + PROJECT MANAGER
// ============================================================

export const bulkImportEmployees = async (
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

    const { employees } = req.body;

    if (!Array.isArray(employees) || employees.length === 0) {
      res.status(400).json({
        success: false,
        message: "An array of employee records is required for bulk import",
      });
      return;
    }

    const results: {
      row: number;
      name?: string;
      email?: string;
      employeeId?: string;
      success: boolean;
      error?: string;
    }[] = [];

    let successCount = 0;
    let failureCount = 0;

    // Cache departments for fast lookup
    const allDepartments = await Department.find({ isActive: true });

    for (let index = 0; index < employees.length; index++) {
      const rowNum = index + 1;
      const item = employees[index];

      const name = String(item.name || "").trim();
      const email = String(item.email || "").trim().toLowerCase();
      const roleInput = String(item.role || "EMPLOYEE").trim().toUpperCase();
      const deptInput = String(item.department || "").trim();
      const designation = String(item.designation || "Employee").trim();
      const contact = String(item.contact || "").trim();

      // Validation
      if (!name || !email) {
        results.push({
          row: rowNum,
          name,
          email,
          success: false,
          error: "Name and email are required",
        });
        failureCount++;
        continue;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.push({
          row: rowNum,
          name,
          email,
          success: false,
          error: "Invalid email format",
        });
        failureCount++;
        continue;
      }

      // Check role
      const role = roleInput === "PROJECT_MANAGER" ? "PROJECT_MANAGER" : "EMPLOYEE";

      if (req.user.role === "PROJECT_MANAGER" && role === "PROJECT_MANAGER") {
        results.push({
          row: rowNum,
          name,
          email,
          success: false,
          error: "Project Managers can only import regular Employees",
        });
        failureCount++;
        continue;
      }

      // Fail-safe Department lookup with auto-creation
      let targetDept: any = null;

      if (deptInput) {
        if (mongoose.Types.ObjectId.isValid(deptInput)) {
          targetDept = allDepartments.find((d) => String(d._id) === deptInput);
        }
        if (!targetDept) {
          // Exact name match (case-insensitive)
          targetDept = allDepartments.find(
            (d) => d.name.trim().toLowerCase() === deptInput.toLowerCase()
          );
        }
        if (!targetDept) {
          // Partial/substring match
          targetDept = allDepartments.find(
            (d) =>
              d.name.toLowerCase().includes(deptInput.toLowerCase()) ||
              deptInput.toLowerCase().includes(d.name.toLowerCase())
          );
        }
      }

      // Fallback for PM if department unspecified
      if (!targetDept && req.user.role === "PROJECT_MANAGER" && req.user.department) {
        targetDept = allDepartments.find(
          (d) => String(d._id) === String(req.user?.department)
        );
      }

      // If department is still not found, find or auto-create in MongoDB
      if (!targetDept) {
        const deptName = deptInput ? deptInput.trim() : "IT";
        try {
          // Check DB directly (case-insensitive)
          targetDept = await Department.findOne({
            name: { $regex: new RegExp(`^${deptName}$`, "i") },
          });

          if (!targetDept) {
            // Create department with valid schema { name, isActive }
            targetDept = await Department.create({
              name: deptName,
              isActive: true,
            });
          }

          if (targetDept) {
            allDepartments.push(targetDept);
          }
        } catch (deptErr) {
          targetDept = allDepartments[0] || null;
        }
      }

      // Absolute safety fallback: use first available department or create "General"
      if (!targetDept) {
        try {
          targetDept = (await Department.findOne()) || (await Department.create({ name: "General", isActive: true }));
        } catch (e) {
          // ignore
        }
      }

      if (!targetDept) {
        results.push({
          row: rowNum,
          name,
          email,
          success: false,
          error: `Department '${deptInput || "unspecified"}' could not be provisioned`,
        });
        failureCount++;
        continue;
      }

      // Check PM department match
      if (
        req.user.role === "PROJECT_MANAGER" &&
        String(targetDept._id) !== req.user.department
      ) {
        results.push({
          row: rowNum,
          name,
          email,
          success: false,
          error: "Project Managers can only import employees for their department",
        });
        failureCount++;
        continue;
      }

      // Check existing email
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        results.push({
          row: rowNum,
          name,
          email,
          success: false,
          error: `Email '${email}' already exists`,
        });
        failureCount++;
        continue;
      }

      // Create employee
      try {
        const empId = await generateEmployeeId();
        const tempPass = generateTemporaryPassword();
        const hashedPass = await bcrypt.hash(tempPass, 12);

        const newEmp = await User.create({
          name,
          email,
          employeeId: empId,
          password: hashedPass,
          role,
          department: targetDept._id,
          designation,
          contact,
          mustChangePassword: true,
          isActive: true,
        });

        // Try sending email
        sendEmployeeCredentials(email, name, empId, tempPass).catch((e) =>
          console.error(`Email send failed for bulk row ${rowNum}:`, e)
        );

        results.push({
          row: rowNum,
          name,
          email,
          employeeId: empId,
          success: true,
        });
        successCount++;
      } catch (err: any) {
        results.push({
          row: rowNum,
          name,
          email,
          success: false,
          error: err?.message || "Failed to create user record",
        });
        failureCount++;
      }
    }

    await createAuditLog({
      actorId: req.user.userId,
      actorName: req.user.role === "SUPER_ADMIN" ? "Super Admin" : "Project Manager",
      action: "BULK_EMPLOYEE_IMPORT",
      entity: "USER",
      description: `Bulk imported ${successCount} employee(s) successfully with ${failureCount} failure(s)`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: `Bulk import completed: ${successCount} created, ${failureCount} failed`,
      data: {
        totalRows: employees.length,
        importedCount: successCount,
        failedCount: failureCount,
        details: results,
      },
    });
  } catch (error: any) {
    console.error("Bulk Import Employees Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Bulk import failed",
    });
  }
};