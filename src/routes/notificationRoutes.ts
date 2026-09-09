import { Router } from "express";

import authMiddleware from "../middleware/authMiddleware";

import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from "../controllers/notificationController";

const router = Router();

// ==========================================
// GET ALL NOTIFICATIONS
// GET /api/v1/notifications
// ==========================================

router.get(
  "/",
  authMiddleware,
  getNotifications
);

// ==========================================
// GET UNREAD COUNT
// GET /api/v1/notifications/unread-count
// ==========================================

router.get(
  "/unread-count",
  authMiddleware,
  getUnreadCount
);

// ==========================================
// MARK ALL AS READ
// PATCH /api/v1/notifications/read-all
// ==========================================

router.patch(
  "/read-all",
  authMiddleware,
  markAllNotificationsAsRead
);

// ==========================================
// MARK SINGLE AS READ
// PATCH /api/v1/notifications/:id/read
// ==========================================

router.patch(
  "/:id/read",
  authMiddleware,
  markNotificationAsRead
);

// ==========================================
// DELETE
// DELETE /api/v1/notifications/:id
// ==========================================

router.delete(
  "/:id",
  authMiddleware,
  deleteNotification
);

export default router;