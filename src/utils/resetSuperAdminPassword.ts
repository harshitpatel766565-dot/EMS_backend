import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import connectDB from "../config/db";
import User from "../models/User";

dotenv.config();

const resetSuperAdminPassword = async (): Promise<void> => {
  try {
    await connectDB();

    const newPassword = "Admin@123";

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const admin = await User.findOneAndUpdate(
      {
        email: "admin@ems-pms.com",
        role: "SUPER_ADMIN",
      },
      {
        $set: {
          password: hashedPassword,
          mustChangePassword: false,
          isActive: true,
        },
      },
      {
        new: true,
      }
    );

    if (!admin) {
      console.log("Super Admin not found ❌");
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log("Super Admin password reset successfully ✅");
    console.log("Email:", admin.email);
    console.log("New Password:", newPassword);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Failed to reset password ❌", error);

    await mongoose.connection.close();
    process.exit(1);
  }
};

resetSuperAdminPassword();