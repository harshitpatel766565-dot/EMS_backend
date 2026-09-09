
// =====================================================
// ENVIRONMENT CONFIGURATION
// =====================================================

import dotenv from "dotenv";

dotenv.config();

// =====================================================
// IMPORTS
// =====================================================

import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";

import connectDB from "./config/db";

// =====================================================
// ROUTE IMPORTS
// =====================================================

import authRoutes from "./routes/authRoutes";
import employeeRoutes from "./routes/employeeRoutes";
import departmentRoutes from "./routes/departmentRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import projectRoutes from "./routes/projectRoutes";
import taskRoutes from "./routes/taskRoutes";
import sprintRoutes from "./routes/sprintRoutes";
import standupRoutes from "./routes/standupRoutes";
import leaveRoutes from "./routes/leaveRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import reportRoutes from "./routes/reportRoutes";
import auditLogRoutes from "./routes/auditLogRoutes";
import loginSessionRoutes from "./routes/loginSessionRoutes";

// =====================================================
// SERVICES
// =====================================================

import { verifyEmailConnection } from "./services/emailService";

// =====================================================
// APP INITIALIZATION
// =====================================================

const app = express();

const PORT = process.env.PORT || 5000;

// =====================================================
// DATABASE CONNECTION
// =====================================================

connectDB();

// =====================================================
// EMAIL SMTP CONNECTION
// =====================================================

verifyEmailConnection();

// =====================================================
// CORS CONFIGURATION
// =====================================================

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an origin
      // Thunder Client
      // curl
      // Server-to-server requests

      if (!origin) {
        return callback(null, true);
      }

      // Allow registered frontend origins

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Reject unknown origins

      return callback(
        new Error("Not allowed by CORS")
      );
    },

    credentials: true,
  })
);

// =====================================================
// BODY PARSER & STATIC FILES
// =====================================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

// Static uploads folder
const uploadsDir = path.resolve(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// =====================================================
// API ROUTES
// =====================================================

// -----------------------------------------------------
// DEPARTMENT ROUTES
// -----------------------------------------------------

app.use(
  "/api/v1/departments",
  departmentRoutes
);

// -----------------------------------------------------
// AUTHENTICATION ROUTES
// -----------------------------------------------------

app.use(
  "/api/v1/auth",
  authRoutes
);

// -----------------------------------------------------
// EMPLOYEE ROUTES
// -----------------------------------------------------

app.use(
  "/api/v1/employees",
  employeeRoutes
);

// -----------------------------------------------------
// NOTIFICATION ROUTES
// -----------------------------------------------------

app.use(
  "/api/v1/notifications",
  notificationRoutes
);

app.use(
  "/api/v1/projects",
  projectRoutes
);

app.use(
  "/api/v1/tasks",
  taskRoutes
);

app.use(
  "/api/v1/sprints",
  sprintRoutes
);

app.use(
  "/api/v1/standups",
  standupRoutes
);

app.use(
  "/api/v1/leaves",
  leaveRoutes
);

app.use(
  "/api/v1/dashboard",
  dashboardRoutes
);

app.use(
  "/api/v1/reports",
  reportRoutes
);

app.use(
  "/api/v1/audit-logs",
  auditLogRoutes
);

app.use(
  "/api/v1/login-sessions",
  loginSessionRoutes
);

// =====================================================
// ROOT ROUTE
// =====================================================

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message:
      "EMS-PMS Backend API is running 🚀",
  });
});

// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
  "/api/v1/health",
  (_req, res) => {
    res.status(200).json({
      success: true,
      message:
        "EMS-PMS API is healthy",
    });
  }
);

// =====================================================
// 404 HANDLER
// =====================================================

app.use(
  (_req, res) => {
    res.status(404).json({
      success: false,
      message:
        "API route not found",
    });
  }
);

// =====================================================
// GLOBAL ERROR HANDLER
// =====================================================

app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(
      "======================================"
    );

    console.error(
      "Server Error ❌:",
      error
    );

    console.error(
      "======================================"
    );

    res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Internal Server Error",
    });
  }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
  console.log(
    "======================================"
  );

  console.log(
    "🚀 EMS-PMS BACKEND SERVER"
  );

  console.log(
    `🌐 Server running on http://localhost:${PORT}`
  );

  console.log(
    `❤️ Health: http://localhost:${PORT}/api/v1/health`
  );

  console.log(
    `🔔 Notifications: http://localhost:${PORT}/api/v1/notifications`
  );

  console.log(
    "======================================"
  );
});

