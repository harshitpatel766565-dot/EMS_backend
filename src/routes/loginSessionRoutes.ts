import { Router } from "express";
import { getLoginSessions } from "../controllers/loginSessionController";
import authMiddleware from "../middleware/authMiddleware";
import roleMiddleware from "../middleware/roleMiddleware";

const router = Router();

// GET /api/v1/login-sessions
router.get(
  "/",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN", "PROJECT_MANAGER"),
  getLoginSessions
);

export default router;
