import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import connectDB from "../config/db";
import User from "../models/User";

dotenv.config();

const createSuperAdmin = async (): Promise<void> => {
  try {
    await connectDB();

    const existingAdmin = await User.findOne({
      role: "SUPER_ADMIN",
    });

    if (existingAdmin) {
      console.log("Super Admin already exists ✅");
      process.exit(0);
    }

    const password = "Admin@123";

    const hashedPassword = await bcrypt.hash(password, 12);

    const admin = await User.create({
      name: "Super Admin",
      email: "admin@ems-pms.com",
      password: hashedPassword,
      role: "SUPER_ADMIN",
      mustChangePassword: false,
      isActive: true,
    });

    console.log("Super Admin created successfully ✅");
    console.log("Email:", admin.email);
    console.log("Password:", password);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("Failed to create Super Admin ❌", error);

    await mongoose.connection.close();
    process.exit(1);
  }
};

createSuperAdmin();