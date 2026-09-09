import express from "express";

import {
  createTask,
  getTasks,
  getTaskById,
  getTaskAuditLogs,
  updateTask,
  updateTaskStatus,
  addTaskComment,
  deleteTask,
} from "../controllers/taskController";

import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// =====================================================
// TASK ROUTES
// =====================================================

router.post("/", authMiddleware, createTask);
router.get("/", authMiddleware, getTasks);
router.get("/:id", authMiddleware, getTaskById);
router.get("/:id/audit-logs", authMiddleware, getTaskAuditLogs);
router.put("/:id", authMiddleware, updateTask);
router.patch("/:id/status", authMiddleware, updateTaskStatus);
router.post("/:id/comments", authMiddleware, addTaskComment);
router.delete("/:id", authMiddleware, deleteTask);

export default router;
