import { Router } from "express";

import {
  login,
  logout,
  getMe,
  changePassword,
  forgotPassword,
  resetPassword,
} from "../controllers/authController";

import authMiddleware from "../middleware/authMiddleware";

const router = Router();

// Login
router.post("/login", login);

// Logout
router.post("/logout", authMiddleware, logout);

// Forgot password request
router.post("/forgot-password", forgotPassword);

// Reset password submit
router.post("/reset-password", resetPassword);

// Get current logged-in user
router.get("/me", authMiddleware, getMe);

// Change password
router.post(
  "/change-password",
  authMiddleware,
  changePassword
);

export default router;