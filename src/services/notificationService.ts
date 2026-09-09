import mongoose from "mongoose";
import Notification, {
  NotificationType,
} from "../models/Notification";

interface CreateNotificationParams {
  userId: string | mongoose.Types.ObjectId;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}

/**
 * Create a notification for a single user
 */
export const createNotification = async ({
  userId,
  title,
  message,
  type = "GENERAL",
  link,
}: CreateNotificationParams) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId.toString())) {
      throw new Error("Invalid user ID");
    }

    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type,
      link,
      isRead: false,
    });

    return notification;
  } catch (error) {
    console.error("Create Notification Error ❌:", error);
    throw error;
  }
};

/**
 * Create notifications for multiple users
 */
export const createBulkNotifications = async (
  userIds: (string | mongoose.Types.ObjectId)[],
  data: {
    title: string;
    message: string;
    type?: NotificationType;
    link?: string;
  }
) => {
  try {
    const validUserIds = userIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id.toString())
    );

    if (validUserIds.length === 0) {
      return [];
    }

    const notifications = validUserIds.map((userId) => ({
      user: userId,
      title: data.title,
      message: data.message,
      type: data.type || "GENERAL",
      link: data.link,
      isRead: false,
    }));

    return await Notification.insertMany(notifications);
  } catch (error) {
    console.error("Bulk Notification Error ❌:", error);
    throw error;
  }
};

/**
 * Mark a user's notification as read
 */
export const markNotificationRead = async (
  notificationId: string,
  userId: string
) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      throw new Error("Invalid notification ID");
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        user: userId,
      },
      {
        $set: {
          isRead: true,
        },
      },
      {
        new: true,
      }
    );

    return notification;
  } catch (error) {
    console.error("Mark Notification Read Error ❌:", error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsRead = async (userId: string) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    const result = await Notification.updateMany(
      {
        user: userId,
        isRead: false,
      },
      {
        $set: {
          isRead: true,
        },
      }
    );

    return result;
  } catch (error) {
    console.error("Mark All Notifications Read Error ❌:", error);
    throw error;
  }
};

/**
 * Delete a notification belonging to a user
 */
export const deleteUserNotification = async (
  notificationId: string,
  userId: string
) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      throw new Error("Invalid notification ID");
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("Invalid user ID");
    }

    return await Notification.findOneAndDelete({
      _id: notificationId,
      user: userId,
    });
  } catch (error) {
    console.error("Delete Notification Error ❌:", error);
    throw error;
  }
};