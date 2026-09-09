import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";

import User from "../models/User";
import LoginSession from "../models/LoginSession";

import {
  generateAccessToken,
  generateRefreshToken,
} from "../services/tokenService";

import { AuthRequest } from "../middleware/authMiddleware";
import { createAuditLog } from "../services/auditService";
import { sendPasswordResetEmail } from "../services/emailService";

// =====================================================
// LOGIN
// =====================================================

export const login = async (
  req: Request,
  res: Response
): Promise<void> => {
  const loginIdentifier = req.body?.email || req.body?.employeeId || "unknown";

  try {
    const {
      email,
      employeeId,
      password,
    } = req.body;

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if ((!email && !employeeId) || !password) {
      await createAuditLog({
        actorName: loginIdentifier,
        action: "LOGIN_FAILED",
        entity: "AUTH",
        description: `Login attempt failed: Missing identifier or password`,
        ipAddress: req.ip,
      });

      res.status(400).json({
        success: false,
        message:
          "Email/Employee ID and password are required",
      });

      return;
    }

    // -------------------------------------------------
    // FIND USER
    // -------------------------------------------------

    const user = await User.findOne(
      email
        ? {
            email: email.toLowerCase().trim(),
          }
        : {
            employeeId: employeeId.trim(),
          }
    ).populate("department", "name");

    if (!user) {
      console.log("❌ Login failed: User not found");

      await createAuditLog({
        actorName: loginIdentifier,
        action: "LOGIN_FAILED",
        entity: "AUTH",
        description: `Login failed for identifier '${loginIdentifier}': User not found`,
        ipAddress: req.ip,
      });

      res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });

      return;
    }

    // -------------------------------------------------
    // CHECK ACTIVE STATUS
    // -------------------------------------------------

    if (!user.isActive) {
      console.log(
        "❌ Login failed: Account inactive"
      );

      await createAuditLog({
        actorId: user._id.toString(),
        actorName: user.name,
        action: "LOGIN_FAILED",
        entity: "AUTH",
        entityId: user._id.toString(),
        description: `Login blocked for account '${user.email}': Account is inactive`,
        ipAddress: req.ip,
      });

      res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });

      return;
    }

    // -------------------------------------------------
    // CHECK PASSWORD
    // -------------------------------------------------

    const isPasswordValid =
      await bcrypt.compare(
        password,
        user.password
      );

    console.log(
      "🔐 Login password valid:",
      isPasswordValid
    );

    if (!isPasswordValid) {
      console.log(
        "❌ Login failed: Invalid password"
      );

      await createAuditLog({
        actorId: user._id.toString(),
        actorName: user.name,
        action: "LOGIN_FAILED",
        entity: "AUTH",
        entityId: user._id.toString(),
        description: `Login failed for user '${user.email}': Invalid password`,
        ipAddress: req.ip,
      });

      res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });

      return;
    }

    // -------------------------------------------------
    // GENERATE TOKENS
    // -------------------------------------------------

    const accessToken =
      generateAccessToken(
        user._id.toString(),
        user.role
      );

    const refreshToken =
      generateRefreshToken(
        user._id.toString()
      );

    // -------------------------------------------------
    // SAVE REFRESH TOKEN
    // -------------------------------------------------

    user.refreshToken = refreshToken;

    await user.save();

    await createAuditLog({
      actorId: user._id.toString(),
      actorName: user.name,
      action: "LOGIN_SUCCESS",
      entity: "AUTH",
      entityId: user._id.toString(),
      description: `User '${user.email}' (${user.role}) logged in successfully`,
      ipAddress: req.ip,
    });

    try {
      await LoginSession.create({
        employee: user._id,
        employeeName: user.name,
        loginAt: new Date(),
        ipAddress: req.ip || (req.headers["x-forwarded-for"] as string) || "::1",
      });
    } catch (sessionError) {
      console.error("❌ Failed to create LoginSession:", sessionError);
    }

    console.log(
      "✅ Login successful:",
      user.email
    );

    console.log(
      "Role:",
      user.role
    );

    console.log(
      "mustChangePassword:",
      user.mustChangePassword
    );

    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    res.status(200).json({
      success: true,

      message: "Login successful",

      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          employeeId: user.employeeId,
          role: user.role,
          department: user.department,
          avatar: user.avatar,
          contact: user.contact,
          designation: user.designation,
          mustChangePassword:
            user.mustChangePassword,
        },

        accessToken,

        refreshToken,
      },
    });
  } catch (error) {
    console.error(
      "❌ Login Error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// =====================================================
// CHANGE PASSWORD
// =====================================================

export const changePassword = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    console.log(
      "================================="
    );

    console.log(
      "🔐 CHANGE PASSWORD REQUEST"
    );

    console.log(
      "User:",
      req.user
    );

    console.log(
      "Body received:",
      {
        currentPassword:
          req.body.currentPassword
            ? "********"
            : "MISSING",

        newPassword:
          req.body.newPassword
            ? "********"
            : "MISSING",
      }
    );

    // -------------------------------------------------
    // AUTH CHECK
    // -------------------------------------------------

    if (!req.user) {
      console.log(
        "❌ Authentication required"
      );

      res.status(401).json({
        success: false,
        message: "Authentication required",
      });

      return;
    }

    // -------------------------------------------------
    // GET PASSWORDS
    // -------------------------------------------------

    const {
      currentPassword,
      newPassword,
    } = req.body;

    // -------------------------------------------------
    // REQUIRED FIELDS
    // -------------------------------------------------

    if (
      !currentPassword ||
      !newPassword
    ) {
      console.log(
        "❌ Password fields missing"
      );

      res.status(400).json({
        success: false,
        message:
          "Current password and new password are required",
      });

      return;
    }

    // -------------------------------------------------
    // PASSWORD LENGTH
    // -------------------------------------------------

    if (newPassword.length < 8) {
      console.log(
        "❌ New password too short"
      );

      res.status(400).json({
        success: false,
        message:
          "New password must be at least 8 characters",
      });

      return;
    }

    // -------------------------------------------------
    // FIND USER
    // -------------------------------------------------

    const user = await User.findById(
      req.user.userId
    );

    if (!user) {
      console.log(
        "❌ User not found:",
        req.user.userId
      );

      res.status(404).json({
        success: false,
        message: "User not found",
      });

      return;
    }

    console.log(
      "✅ User found:",
      user.email
    );

    console.log(
      "Role:",
      user.role
    );

    // -------------------------------------------------
    // VERIFY CURRENT PASSWORD
    // -------------------------------------------------

    const isCurrentPasswordValid =
      await bcrypt.compare(
        currentPassword,
        user.password
      );

    console.log(
      "Current password valid:",
      isCurrentPasswordValid
    );

    if (!isCurrentPasswordValid) {
      console.log(
        "❌ Current password is incorrect"
      );

      res.status(401).json({
        success: false,
        message:
          "Current password is incorrect",
      });

      return;
    }

    // -------------------------------------------------
    // CHECK SAME PASSWORD
    // -------------------------------------------------

    const isSamePassword =
      await bcrypt.compare(
        newPassword,
        user.password
      );

    if (isSamePassword) {
      console.log(
        "❌ New password same as old password"
      );

      res.status(400).json({
        success: false,
        message:
          "New password must be different from current password",
      });

      return;
    }

    // -------------------------------------------------
    // HASH NEW PASSWORD
    // -------------------------------------------------

    const hashedPassword =
      await bcrypt.hash(
        newPassword,
        12
      );

    // -------------------------------------------------
    // UPDATE USER
    // -------------------------------------------------

    user.password =
      hashedPassword;

    user.mustChangePassword =
      false;

    // -------------------------------------------------
    // SAVE USER
    // -------------------------------------------------

    await user.save();

    console.log(
      "================================="
    );

    console.log(
      "✅ PASSWORD CHANGED SUCCESSFULLY"
    );

    console.log(
      "User:",
      user.email
    );

    console.log(
      "mustChangePassword:",
      user.mustChangePassword
    );

    console.log(
      "================================="
    );

    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    res.status(200).json({
      success: true,
      message:
        "Password changed successfully",
    });
  } catch (error) {
    console.error(
      "❌ Change Password Error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// =====================================================
// GET CURRENT USER
// =====================================================

export const getMe = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // -------------------------------------------------
    // AUTH CHECK
    // -------------------------------------------------

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });

      return;
    }

    // -------------------------------------------------
    // FIND USER
    // -------------------------------------------------

    const user = await User.findById(
      req.user.userId
    ).select(
      "-password -refreshToken"
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });

      return;
    }

    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    res.status(200).json({
      success: true,

      data: {
        user,
      },
    });
  } catch (error) {
    console.error(
      "❌ Get Me Error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// =====================================================
// FORGOT PASSWORD
// =====================================================

export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email || !String(email).trim()) {
      res.status(400).json({
        success: false,
        message: "Registered email address is required",
      });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail, isActive: true });

    if (!user) {
      // Return success to avoid email enumeration attacks
      res.status(200).json({
        success: true,
        message:
          "If an account with that email exists, password reset instructions have been sent.",
      });
      return;
    }

    // Generate unhashed reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Store hashed token in DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await user.save();

    // Send email with unhashed token
    try {
      const clientOrigin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;
      await sendPasswordResetEmail(user.email, user.name, resetToken, clientOrigin);

      await createAuditLog({
        actorId: user._id.toString(),
        actorName: user.name,
        action: "PASSWORD_RESET_REQUESTED",
        entity: "AUTH",
        entityId: user._id.toString(),
        description: `Password reset token generated and email sent to ${user.email}`,
        ipAddress: req.ip,
      });
    } catch (emailErr) {
      console.error("Failed to send reset email:", emailErr);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      res.status(500).json({
        success: false,
        message: "Error sending password reset email. Please try again.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message:
        "If an account with that email exists, password reset instructions have been sent.",
    });
  } catch (error: any) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Internal server error",
    });
  }
};

// =====================================================
// RESET PASSWORD
// =====================================================

export const resetPassword = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({
        success: false,
        message: "Reset token and new password are required",
      });
      return;
    }

    if (String(newPassword).length < 8) {
      res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters long",
      });
      return;
    }

    // Hash provided token to match stored hash
    const hashedToken = crypto
      .createHash("sha256")
      .update(String(token).trim())
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        message: "Password reset token is invalid or has expired",
      });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(String(newPassword), 12);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.mustChangePassword = false;

    await user.save();

    await createAuditLog({
      actorId: user._id.toString(),
      actorName: user.name,
      action: "PASSWORD_RESET_SUCCESS",
      entity: "AUTH",
      entityId: user._id.toString(),
      description: `Password reset successfully completed for user '${user.email}'`,
      ipAddress: req.ip,
    });

    res.status(200).json({
      success: true,
      message: "Password has been reset successfully. You can now login.",
    });
  } catch (error: any) {
    console.error("Reset Password Error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Internal server error",
    });
  }
};

// =====================================================
// LOGOUT
// =====================================================

export const logout = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (req.user?.userId) {
      // Find the most recent active session for that employee
      const activeSession = await LoginSession.findOne({
        employee: req.user.userId,
        $or: [{ logoutAt: { $exists: false } }, { logoutAt: null }],
      }).sort({ loginAt: -1 });

      if (activeSession) {
        const logoutAt = new Date();
        const durationMinutes = Math.floor(
          (logoutAt.getTime() - activeSession.loginAt.getTime()) / 60000
        );

        activeSession.logoutAt = logoutAt;
        activeSession.durationMinutes = Math.max(0, durationMinutes);
        await activeSession.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error: any) {
    console.error("Logout session error:", error);
    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  }
};
