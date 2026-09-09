
import express from "express";

import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../controllers/departmentController";

// IMPORTANT:
// These are DEFAULT exports in your middleware files
import authMiddleware from "../middleware/authMiddleware";
import roleMiddleware from "../middleware/roleMiddleware";

const router = express.Router();

// =====================================================
// GET ALL DEPARTMENTS
// Any logged-in user can view departments
// =====================================================

router.get(
  "/",
  authMiddleware,
  getDepartments
);

// =====================================================
// CREATE DEPARTMENT
// SUPER ADMIN ONLY
// =====================================================

router.post(
  "/",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  createDepartment
);

// =====================================================
// UPDATE DEPARTMENT
// SUPER ADMIN ONLY
// =====================================================

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  updateDepartment
);

// =====================================================
// DELETE DEPARTMENT
// SUPER ADMIN ONLY
// =====================================================

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  deleteDepartment
);

// =====================================================
// EXPORT ROUTER
// =====================================================

export default router;

