import mongoose, { Document, Schema } from "mongoose";

export type ProjectStatus =
  | "PLANNED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";

export type ProjectPriority =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "URGENT";

export interface IProject extends Document {
  code?: string;
  name: string;
  description?: string;

  department: mongoose.Types.ObjectId;
  projectManager: mongoose.Types.ObjectId;
  employees: mongoose.Types.ObjectId[];

  status: ProjectStatus;
  priority: ProjectPriority;

  startDate?: Date;
  endDate?: Date;

  createdBy: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    code: {
      type: String,
      trim: true,
      sparse: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },

    projectManager: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    employees: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    status: {
      type: String,
      enum: [
        "PLANNED",
        "IN_PROGRESS",
        "ON_HOLD",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "PLANNED",
    },

    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
    },

    startDate: {
      type: Date,
    },

    endDate: {
      type: Date,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IProject>("Project", projectSchema);