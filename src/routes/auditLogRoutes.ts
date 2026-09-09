import express from "express";

import { getAuditLogs } from "../controllers/auditLogController";
import authMiddleware from "../middleware/authMiddleware";
import roleMiddleware from "../middleware/roleMiddleware";

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN", "PROJECT_MANAGER"),
  getAuditLogs
);

export default router;
