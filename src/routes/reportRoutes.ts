import express from "express";

import {
  getEmployeeReport,
  getProjectReport,
  getTaskReport,
  getWorkloadReport,
  exportReport,
} from "../controllers/reportController";

import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

router.get("/employees", authMiddleware, getEmployeeReport);
router.get("/projects", authMiddleware, getProjectReport);
router.get("/tasks", authMiddleware, getTaskReport);
router.get("/workload", authMiddleware, getWorkloadReport);
router.post("/export", authMiddleware, exportReport);

export default router;
