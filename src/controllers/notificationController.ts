import { Response } from "express";
import mongoose from "mongoose";

import Notification from "../models/Notification";
import { AuthRequest } from "../middleware/authMiddleware";

// ==========================================
// GET ALL NOTIFICATIONS
// ==========================================

export const getNotifications = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Check authentication
    if (!req.user?.userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const userId = req.user.userId;

    // Get notifications
    const notifications = await Notification.find({
      user: userId,
    })
      .sort({
        createdAt: -1,
      })
      .limit(50);

    // Get unread count
    const unreadCount = await Notification.countDocuments({
      user: userId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Get Notifications Error ❌:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
    });
  }
};

// ==========================================
// GET UNREAD COUNT
// ==========================================

export const getUnreadCount = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    const count = await Notification.countDocuments({
      user: req.user.userId,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    console.error("Get Unread Count Error ❌:", error);

    res.status(500).json({
      success: false,
      message: "Failed to get unread count",
    });
  }
};

// ==========================================
// MARK SINGLE NOTIFICATION AS READ
// ==========================================

export const markNotificationAsRead = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Fix TypeScript req.params.id type
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    // Validate MongoDB ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
      return;
    }

    // Update only user's own notification
    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        user: req.user.userId,
      },
      {
        isRead: true,
      },
      {
        new: true,
      }
    );

    if (!notification) {
      res.status(404).json({
        success: false,
        message: "Notification not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    console.error("Mark Notification Read Error ❌:", error);

    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
};

// ==========================================
// MARK ALL NOTIFICATIONS AS READ
// ==========================================

export const markAllNotificationsAsRead = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    await Notification.updateMany(
      {
        user: req.user.userId,
        isRead: false,
      },
      {
        isRead: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Mark All Notifications Read Error ❌:", error);

    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
    });
  }
};

// ==========================================
// DELETE NOTIFICATION
// ==========================================

export const deleteNotification = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
      return;
    }

    // Fix TypeScript req.params.id type
    const id = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;

    // Validate MongoDB ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid notification ID",
      });
      return;
    }

    // Delete only user's own notification
    const notification = await Notification.findOneAndDelete({
      _id: id,
      user: req.user.userId,
    });

    if (!notification) {
      res.status(404).json({
        success: false,
        message: "Notification not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Delete Notification Error ❌:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
};