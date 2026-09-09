import express from "express";

import {
  getSuperAdminDashboard,
  getProjectManagerDashboard,
  getEmployeeDashboard,
} from "../controllers/dashboardController";

import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

router.get("/super-admin", authMiddleware, getSuperAdminDashboard);
router.get("/project-manager", authMiddleware, getProjectManagerDashboard);
router.get("/employee", authMiddleware, getEmployeeDashboard);

export default router;
