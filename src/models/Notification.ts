import mongoose, { Document, Schema } from "mongoose";

export type NotificationType =
  | "TASK"
  | "PROJECT"
  | "LEAVE"
  | "SYSTEM"
  | "GENERAL";

export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  link?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["TASK", "PROJECT", "LEAVE", "SYSTEM", "GENERAL"],
      default: "GENERAL",
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    link: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);

export default Notification;