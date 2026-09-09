import mongoose, { Document, Schema } from "mongoose";

export type LeaveType = "CASUAL" | "SICK" | "EARNED" | "OTHER";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ILeaveRequest extends Document {
  employee: mongoose.Types.ObjectId;
  leaveType: LeaveType;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  status: LeaveStatus;
  approvedBy?: mongoose.Types.ObjectId;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    leaveType: {
      type: String,
      enum: ["CASUAL", "SICK", "EARNED", "OTHER"],
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    days: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

leaveRequestSchema.index({ employee: 1, status: 1 });
leaveRequestSchema.index({ createdAt: -1 });

const LeaveRequest = mongoose.model<ILeaveRequest>(
  "LeaveRequest",
  leaveRequestSchema
);

export default LeaveRequest;
