import mongoose, { Document, Schema } from "mongoose";

export type SprintStatus = "PLANNED" | "ACTIVE" | "COMPLETED";

export interface ISprint extends Document {
  project: mongoose.Types.ObjectId;
  name: string;
  goal: string;
  startDate: Date;
  endDate: Date;
  status: SprintStatus;
  taskIds: mongoose.Types.ObjectId[];
  totalStoryPoints: number;
  completedStoryPoints: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const sprintSchema = new Schema<ISprint>(
  {
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    goal: {
      type: String,
      trim: true,
      default: "",
    },

    startDate: {
      type: Date,
      required: true,
    },

    endDate: {
      type: Date,
      required: true,
    },

    status: {
      type: String,
      enum: ["PLANNED", "ACTIVE", "COMPLETED"],
      default: "PLANNED",
      index: true,
    },

    taskIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Task",
      },
    ],

    totalStoryPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    completedStoryPoints: {
      type: Number,
      default: 0,
      min: 0,
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

sprintSchema.index({ project: 1, status: 1 });

const Sprint = mongoose.model<ISprint>("Sprint", sprintSchema);

export default Sprint;
