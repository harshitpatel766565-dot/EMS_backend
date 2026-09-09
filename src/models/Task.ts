import mongoose, { Document, Schema } from "mongoose";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface ISubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface ITaskComment {
  id: string;
  author: mongoose.Types.ObjectId;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: Date;
}

export interface ITask extends Document {
  taskCode: string;
  title: string;
  description: string;

  project: mongoose.Types.ObjectId;
  sprint?: mongoose.Types.ObjectId;
  assignedTo: mongoose.Types.ObjectId[];

  priority: TaskPriority;
  status: TaskStatus;

  dueDate?: Date;
  startDate?: Date;

  estimatedHours: number;
  loggedHours: number;
  storyPoints: number;
  progress: number;

  blockers: string[];

  // ✅ FIXED: MongoDB stores ObjectId references
  dependencies: mongoose.Types.ObjectId[];

  parentTask?: mongoose.Types.ObjectId;

  subtasks: ISubtask[];
  comments: ITaskComment[];

  createdBy: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    taskCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    sprint: {
      type: Schema.Types.ObjectId,
      ref: "Sprint",
      index: true,
    },

    assignedTo: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
      default: "MEDIUM",
    },

    status: {
      type: String,
      enum: ["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"],
      default: "TODO",
      index: true,
    },

    dueDate: {
      type: Date,
    },

    startDate: {
      type: Date,
    },

    estimatedHours: {
      type: Number,
      default: 0,
      min: 0,
    },

    loggedHours: {
      type: Number,
      default: 0,
      min: 0,
    },

    storyPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    blockers: {
      type: [String],
      default: [],
    },

    dependencies: [
      {
        type: Schema.Types.ObjectId,
        ref: "Task",
      },
    ],

    parentTask: {
      type: Schema.Types.ObjectId,
      ref: "Task",
    },

    subtasks: [
      {
        id: { type: String, required: true },
        title: { type: String, required: true, trim: true },
        completed: { type: Boolean, default: false },
      },
    ],

    comments: [
      {
        id: { type: String, required: true },
        author: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        authorName: {
          type: String,
          required: true,
        },
        authorAvatar: {
          type: String,
          default: null,
        },
        content: {
          type: String,
          required: true,
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

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

taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignedTo: 1, status: 1 });

const Task = mongoose.model<ITask>("Task", taskSchema);

export default Task;