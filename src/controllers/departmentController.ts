
import { Request, Response } from "express";
import mongoose from "mongoose";
import Department from "../models/Department";

// =====================================================
// GET ALL DEPARTMENTS
// =====================================================

export const getDepartments = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  try {
    const departments = await Department.find()
      .sort({ name: 1 });

    return res.status(200).json({
      success: true,
      data: {
        departments,
      },
    });
  } catch (error) {
    console.error(
      "Get Departments Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch departments",
    });
  }
};

// =====================================================
// CREATE DEPARTMENT
// =====================================================

export const createDepartment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { name } = req.body;

    if (
      typeof name !== "string" ||
      name.trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Department name is required",
      });
    }

    const departmentName = name.trim();

    // Check duplicate department
    const existingDepartment =
      await Department.findOne({
        name: {
          $regex: `^${departmentName}$`,
          $options: "i",
        },
      });

    if (existingDepartment) {
      return res.status(400).json({
        success: false,
        message: "Department already exists",
      });
    }

    const department =
      await Department.create({
        name: departmentName,
      });

    return res.status(201).json({
      success: true,
      message:
        "Department created successfully",
      data: {
        department,
      },
    });
  } catch (error) {
    console.error(
      "Create Department Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create department",
    });
  }
};

// =====================================================
// UPDATE DEPARTMENT
// =====================================================

export const updateDepartment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const rawId = req.params.id;

    // Fix Express params typing
    const id = Array.isArray(rawId)
      ? rawId[0]
      : rawId;

    const { name } = req.body;

    // Validate ID
    if (
      !id ||
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid department ID",
      });
    }

    // Validate name
    if (
      typeof name !== "string" ||
      name.trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Department name is required",
      });
    }

    const departmentName = name.trim();

    // Check duplicate name
    const existingDepartment =
      await Department.findOne({
        name: {
          $regex: `^${departmentName}$`,
          $options: "i",
        },
        _id: {
          $ne: id,
        },
      });

    if (existingDepartment) {
      return res.status(400).json({
        success: false,
        message: "Department already exists",
      });
    }

    // Update department
    const department =
      await Department.findByIdAndUpdate(
        id,
        {
          name: departmentName,
        },
        {
          new: true,
          runValidators: true,
        }
      );

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Department updated successfully",
      data: {
        department,
      },
    });
  } catch (error) {
    console.error(
      "Update Department Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update department",
    });
  }
};

// =====================================================
// DELETE DEPARTMENT
// =====================================================

export const deleteDepartment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const rawId = req.params.id;

    // Fix Express params typing
    const id = Array.isArray(rawId)
      ? rawId[0]
      : rawId;

    // Validate ID
    if (
      !id ||
      !mongoose.Types.ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid department ID",
      });
    }

    // Find department
    const department =
      await Department.findById(id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department not found",
      });
    }

    // Delete department
    await Department.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message:
        "Department deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete Department Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete department",
    });
  }
};

