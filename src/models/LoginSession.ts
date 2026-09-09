import mongoose, { Schema, Document } from "mongoose";

export interface ILoginSession extends Document {
  employee: mongoose.Types.ObjectId;
  employeeName: string;
  loginAt: Date;
  logoutAt?: Date;
  durationMinutes?: number;
  ipAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

const loginSessionSchema = new Schema<ILoginSession>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    employeeName: {
      type: String,
      required: true,
      trim: true,
    },
    loginAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    logoutAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const LoginSession = mongoose.model<ILoginSession>(
  "LoginSession",
  loginSessionSchema
);

export default LoginSession;
