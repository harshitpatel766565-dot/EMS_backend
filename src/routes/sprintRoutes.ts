import express from "express";

import {
  createSprint,
  getSprints,
  getSprintById,
  updateSprint,
  deleteSprint,
} from "../controllers/sprintController";

import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

router.post("/", authMiddleware, createSprint);
router.get("/", authMiddleware, getSprints);
router.get("/:id", authMiddleware, getSprintById);
router.put("/:id", authMiddleware, updateSprint);
router.delete("/:id", authMiddleware, deleteSprint);

export default router;
