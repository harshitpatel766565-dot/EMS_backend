import dotenv from "dotenv";
dotenv.config();

import nodemailer from "nodemailer";

// =====================================================
// SMTP DEBUG
// =====================================================

console.log("SMTP_HOST:", process.env.SMTP_HOST);
console.log("SMTP_PORT:", process.env.SMTP_PORT);
console.log("SMTP_USER:", process.env.SMTP_USER);

// =====================================================
// EMAIL TRANSPORTER
// =====================================================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "",
  port: Number(process.env.SMTP_PORT || 587),

  // Gmail SMTP port 587 = STARTTLS
  secure: false,

  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASSWORD || "",
  },
});

// =====================================================
// VERIFY SMTP CONNECTION
// =====================================================

export const verifyEmailConnection = async (): Promise<void> => {
  try {
    await transporter.verify();

    console.log(
      "Email SMTP connection successful ✅"
    );
  } catch (error) {
    console.error(
      "Email SMTP connection failed ❌:",
      error
    );
  }
};

// =====================================================
// SEND EMPLOYEE CREDENTIALS
// =====================================================

export const sendEmployeeCredentials = async (
  email: string,
  name: string,
  employeeId: string,
  temporaryPassword: string
): Promise<void> => {
  try {
    await transporter.sendMail({
      from:
        process.env.SMTP_FROM ||
        process.env.SMTP_USER,

      to: email,

      subject:
        "EMS-PMS Employee Account Credentials",

      text: `
Hello ${name},

Your EMS-PMS employee account has been created successfully.

Employee ID: ${employeeId}
Email: ${email}
Temporary Password: ${temporaryPassword}

Please login using these credentials.

For security, please change your password after your first login.

Regards,
EMS-PMS Team
      `,
    });

    console.log(
      `Employee credentials email sent to ${email} ✅`
    );
  } catch (error) {
    console.error(
      "Employee email sending failed ❌:",
      error
    );

    throw error;
  }
};

// =====================================================
// SEND TASK ASSIGNED EMAIL
// =====================================================

export const sendTaskAssignedEmail = async (
  email: string,
  name: string,
  taskCode: string,
  taskTitle: string,
  projectName: string,
  dueDate?: string | Date
): Promise<void> => {
  try {
    const formattedDueDate = dueDate
      ? new Date(dueDate).toLocaleDateString()
      : "No deadline specified";

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: `[EMS-PMS] New Task Assigned: ${taskCode} - ${taskTitle}`,
      text: `
Hello ${name},

You have been assigned a new task in project "${projectName}".

Task Code: ${taskCode}
Title: ${taskTitle}
Due Date: ${formattedDueDate}

Please log in to the EMS-PMS portal to view full details and track your progress.

Regards,
EMS-PMS Team
      `,
    });

    console.log(`Task assigned email sent to ${email} ✅`);
  } catch (error) {
    console.error("Task assignment email failed ❌:", error);
    // Silent fail for background email delivery to avoid failing task creation
  }
};

// =====================================================
// SEND LEAVE STATUS EMAIL
// =====================================================

export const sendLeaveStatusEmail = async (
  email: string,
  name: string,
  leaveType: string,
  status: "APPROVED" | "REJECTED",
  startDate: string | Date,
  endDate: string | Date,
  rejectionReason?: string
): Promise<void> => {
  try {
    const formattedStart = new Date(startDate).toLocaleDateString();
    const formattedEnd = new Date(endDate).toLocaleDateString();

    const isApproved = status === "APPROVED";
    const statusText = isApproved ? "Approved ✅" : "Rejected ❌";

    const reasonSection =
      !isApproved && rejectionReason
        ? `\nReason for Rejection: ${rejectionReason}\n`
        : "";

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: `[EMS-PMS] Leave Request ${statusText}`,
      text: `
Hello ${name},

Your ${leaveType} leave request for the period from ${formattedStart} to ${formattedEnd} has been ${status}.
${reasonSection}
Please check the EMS-PMS portal for your updated leave balances and details.

Regards,
EMS-PMS Team
      `,
    });

    console.log(`Leave status email sent to ${email} ✅`);
  } catch (error) {
    console.error("Leave status email failed ❌:", error);
  }
};

// =====================================================
// SEND PASSWORD RESET EMAIL
// =====================================================

export const sendPasswordResetEmail = async (
  email: string,
  name: string,
  resetToken: string,
  customFrontendUrl?: string
): Promise<void> => {
  try {
    const frontendUrl = customFrontendUrl || process.env.FRONTEND_URL || "http://localhost:3000";
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    const altResetUrl = resetUrl.includes("localhost")
      ? resetUrl.replace("localhost", "127.0.0.1")
      : resetUrl.replace("127.0.0.1", "localhost");

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "[EMS-PMS] Password Reset Request",
      text: `
Hello ${name},

You requested a password reset for your EMS-PMS account.

Primary Reset Link (localhost):
${resetUrl}

Alternative Reset Link (127.0.0.1):
${altResetUrl}

Reset Token: ${resetToken}

This link will expire in 1 hour.

Regards,
EMS-PMS Security Team
      `,
      html: `
<div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2 style="color: #4f46e5; margin: 0;">EMS-PMS Portal</h2>
    <p style="color: #64748b; font-size: 14px; margin-top: 5px;">Password Reset Request</p>
  </div>
  <p style="color: #334155; font-size: 15px;">Hello <strong>${name}</strong>,</p>
  <p style="color: #334155; font-size: 14px; line-height: 1.5;">
    You requested a password reset for your EMS-PMS account. Click the button below to set a new password:
  </p>
  <div style="text-align: center; margin: 25px 0;">
    <a href="${resetUrl}" target="_blank" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
      Reset Password (localhost)
    </a>
  </div>
  <div style="text-align: center; margin-bottom: 25px;">
    <a href="${altResetUrl}" target="_blank" style="background-color: #0284c7; color: #ffffff; padding: 10px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">
      Reset Password (127.0.0.1)
    </a>
  </div>
  <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; font-size: 13px; color: #475569; word-break: break-all;">
    <strong>Direct Link (Localhost):</strong><br/>
    <a href="${resetUrl}" target="_blank" style="color: #4f46e5;">${resetUrl}</a>
    <br/><br/>
    <strong>Direct Link (127.0.0.1):</strong><br/>
    <a href="${altResetUrl}" target="_blank" style="color: #0284c7;">${altResetUrl}</a>
    <br/><br/>
    <strong>Reset Token:</strong> <code>${resetToken}</code>
  </div>
  <p style="color: #94a3b8; font-size: 12px; margin-top: 25px; text-align: center;">
    This link and token will expire in 1 hour.<br/>
    If you did not request a password reset, please ignore this email.
  </p>
</div>
      `,
    });

    console.log(`Password reset email sent to ${email} ✅`);
  } catch (error) {
    console.error("Password reset email failed ❌:", error);
    throw error;
  }
};
