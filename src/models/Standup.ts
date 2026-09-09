import mongoose, { Document, Schema } from "mongoose";

export interface IStandup extends Document {
  employee: mongoose.Types.ObjectId;
  date: string;
  yesterday: string;
  today: string;
  blockers?: string;
  tasksWorkedOn: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const standupSchema = new Schema<IStandup>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    date: {
      type: String,
      required: true,
      trim: true,
    },

    yesterday: {
      type: String,
      required: true,
      trim: true,
    },

    today: {
      type: String,
      required: true,
      trim: true,
    },

    blockers: {
      type: String,
      trim: true,
      default: "",
    },

    tasksWorkedOn: [
      {
        type: Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
  },
  {
    timestamps: true,
  }
);

standupSchema.index({ employee: 1, date: -1 });

const Standup = mongoose.model<IStandup>("Standup", standupSchema);

export default Standup;
