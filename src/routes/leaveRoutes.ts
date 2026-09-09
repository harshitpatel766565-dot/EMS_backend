import express from "express";

import {
  applyLeave,
  getLeaves,
  getLeaveById,
  approveLeave,
  rejectLeave,
  getMyLeaveBalances,
} from "../controllers/leaveController";

import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

router.post("/", authMiddleware, applyLeave);
router.get("/", authMiddleware, getLeaves);
router.get("/balances/me", authMiddleware, getMyLeaveBalances);
router.get("/:id", authMiddleware, getLeaveById);
router.patch("/:id/approve", authMiddleware, approveLeave);
router.patch("/:id/reject", authMiddleware, rejectLeave);

export default router;
