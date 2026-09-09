import { Router } from "express";

import upload from "../middleware/upload";

import {
  createProjectManager,
  createEmployee,
  bulkImportEmployees,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deactivateEmployee,
  reactivateEmployee,
  deleteEmployee,
} from "../controllers/employeeController";

import {
  getMyProfile,
  updateMyProfile,
  uploadMyProfilePhoto,
} from "../controllers/profileController";

import authMiddleware from "../middleware/authMiddleware";
import roleMiddleware from "../middleware/roleMiddleware";

const router = Router();

// ============================================================
// MY PROFILE
// ALL LOGGED-IN USERS
// ============================================================

// GET MY PROFILE
router.get(
  "/me/profile",
  authMiddleware,
  getMyProfile
);

// UPDATE MY PROFILE
router.put(
  "/me/profile",
  authMiddleware,
  updateMyProfile
);

// ============================================================
// UPLOAD / CHANGE MY PROFILE PHOTO
// ============================================================

// IMPORTANT:
// upload.single("photo") MUST come before controller

router.post(
  "/me/profile/photo",
  authMiddleware,
  upload.single("photo"),
  uploadMyProfilePhoto
);

// ============================================================
// GET EMPLOYEE LIST
// SUPER ADMIN + PROJECT MANAGER
// ============================================================

router.get(
  "/",
  authMiddleware,
  roleMiddleware(
    "SUPER_ADMIN",
    "PROJECT_MANAGER"
  ),
  getEmployees
);

// ============================================================
// GET EMPLOYEE BY ID
// SUPER ADMIN + PROJECT MANAGER
// ============================================================

router.get(
  "/:id",
  authMiddleware,
  roleMiddleware(
    "SUPER_ADMIN",
    "PROJECT_MANAGER"
  ),
  getEmployeeById
);

// ============================================================
// CREATE PROJECT MANAGER
// SUPER ADMIN ONLY
// ============================================================

router.post(
  "/project-manager",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  createProjectManager
);

// ============================================================
// BULK IMPORT EMPLOYEES
// SUPER ADMIN + PROJECT MANAGER
// ============================================================

router.post(
  "/bulk-import",
  authMiddleware,
  roleMiddleware(
    "SUPER_ADMIN",
    "PROJECT_MANAGER"
  ),
  bulkImportEmployees
);

// ============================================================
// CREATE EMPLOYEE
// SUPER ADMIN + PROJECT MANAGER
// ============================================================

router.post(
  "/",
  authMiddleware,
  roleMiddleware(
    "SUPER_ADMIN",
    "PROJECT_MANAGER"
  ),
  createEmployee
);

// ============================================================
// UPDATE EMPLOYEE
// SUPER ADMIN + PROJECT MANAGER
// ============================================================

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(
    "SUPER_ADMIN",
    "PROJECT_MANAGER"
  ),
  updateEmployee
);

// ============================================================
// DEACTIVATE EMPLOYEE
// SUPER ADMIN + PROJECT MANAGER
// ============================================================

router.patch(
  "/:id/deactivate",
  authMiddleware,
  roleMiddleware(
    "SUPER_ADMIN",
    "PROJECT_MANAGER"
  ),
  deactivateEmployee
);

// ============================================================
// REACTIVATE EMPLOYEE
// SUPER ADMIN + PROJECT MANAGER
// ============================================================

router.patch(
  "/:id/reactivate",
  authMiddleware,
  roleMiddleware(
    "SUPER_ADMIN",
    "PROJECT_MANAGER"
  ),
  reactivateEmployee
);

// ============================================================
// DELETE EMPLOYEE
// SUPER ADMIN + PROJECT MANAGER
// ============================================================

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(
    "SUPER_ADMIN",
    "PROJECT_MANAGER"
  ),
  deleteEmployee
);

export default router;