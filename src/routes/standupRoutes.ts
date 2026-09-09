import express from "express";

import {
  submitStandup,
  getStandups,
} from "../controllers/standupController";

import authMiddleware from "../middleware/authMiddleware";

const router = express.Router();

router.post("/", authMiddleware, submitStandup);
router.get("/", authMiddleware, getStandups);

export default router;
