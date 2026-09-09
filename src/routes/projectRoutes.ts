import express from "express";

import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from "../controllers/projectController";

import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

// =====================================================
// PROJECT ROUTES
// =====================================================

router.post(
  "/",
  authMiddleware,
  createProject
);

router.get(
  "/",
  authMiddleware,
  getProjects
);

router.get(
  "/:id",
  authMiddleware,
  getProjectById
);

router.put(
  "/:id",
  authMiddleware,
  updateProject
);

router.delete(
  "/:id",
  authMiddleware,
  deleteProject
);

export default router;