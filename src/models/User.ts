import mongoose, { Document, Schema } from "mongoose";

export type UserRole =
  | "SUPER_ADMIN"
  | "PROJECT_MANAGER"
  | "EMPLOYEE";

export interface IUser extends Document {
  name: string;
  email: string;
  employeeId?: string;
  password: string;
  role: UserRole;

  department?: mongoose.Types.ObjectId;

  contact?: string;
  designation?: string;
  reportingManager?: mongoose.Types.ObjectId;

  // Profile
  avatar?: string;
  bio?: string;

  // Leave balance
  leaveBalance?: {
    casual: number;
    sick: number;
    earned: number;
  };

  mustChangePassword: boolean;
  isActive: boolean;
  refreshToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: [
        "SUPER_ADMIN",
        "PROJECT_MANAGER",
        "EMPLOYEE",
      ],
      required: true,
    },

    department: {
      type: Schema.Types.ObjectId,
      ref: "Department",
    },

    contact: {
      type: String,
      trim: true,
    },

    designation: {
      type: String,
      trim: true,
    },

    reportingManager: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    // Profile Photo URL
    avatar: {
      type: String,
      default: null,
      trim: true,
    },

    // Professional Bio
    bio: {
      type: String,
      default: "",
      trim: true,
    },

    // Leave Balance tracking
    leaveBalance: {
      casual: {
        type: Number,
        default: 12,
      },
      sick: {
        type: Number,
        default: 10,
      },
      earned: {
        type: Number,
        default: 15,
      },
    },

    mustChangePassword: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    refreshToken: {
      type: String,
      default: null,
    },

    resetPasswordToken: {
      type: String,
      default: null,
    },

    resetPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUser>("User", userSchema);

export default User;

