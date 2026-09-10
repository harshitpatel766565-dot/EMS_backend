// =====================================================
// ENVIRONMENT CONFIGURATION
// =====================================================

import dotenv from "dotenv";

dotenv.config();

// =====================================================
// IMPORTS
// =====================================================

import express from "express";
import cors, { CorsOptions } from "cors";

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

const PORT = Number(process.env.PORT) || 5000;

// =====================================================
// CORS CONFIGURATION
// =====================================================

const normalizeOrigin = (value: string): string => {
  return value.trim().replace(/\/$/, "");
};

// -----------------------------------------------------
// Allowed Origins
// -----------------------------------------------------

const allowedOrigins: string[] = [
  // Local development
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",

  // Production frontend
  "https://ems-frontend-beta-seven.vercel.app",
];

// -----------------------------------------------------
// FRONTEND_URL from Environment Variable
// -----------------------------------------------------

if (process.env.FRONTEND_URL) {
  const frontendUrl = normalizeOrigin(
    process.env.FRONTEND_URL
  );

  if (
    frontendUrl &&
    !allowedOrigins.includes(frontendUrl)
  ) {
    allowedOrigins.push(frontendUrl);
  }
}

// =====================================================
// CORS OPTIONS
// =====================================================

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // -------------------------------------------------
    // Requests without Origin
    // -------------------------------------------------

    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin =
      normalizeOrigin(origin);

    console.log(
      "🌐 Incoming Origin:",
      normalizedOrigin
    );

    // -------------------------------------------------
    // Exact origin match
    // -------------------------------------------------

    if (
      allowedOrigins.includes(
        normalizedOrigin
      )
    ) {
      console.log(
        "✅ CORS Allowed:",
        normalizedOrigin
      );

      callback(null, true);
      return;
    }

    // -------------------------------------------------
    // Allow Vercel preview deployments
    // for EMS frontend
    // -------------------------------------------------

    let isEmsFrontendVercel = false;

    try {
      const originUrl = new URL(
        normalizedOrigin
      );

      const hostname =
        originUrl.hostname;

      isEmsFrontendVercel =
        originUrl.protocol === "https:" &&
        /^ems-frontend(?:-[a-z0-9-]+)*\.vercel\.app$/i.test(
          hostname
        );
    } catch {
      isEmsFrontendVercel = false;
    }

    if (isEmsFrontendVercel) {
      console.log(
        "✅ EMS Frontend Vercel Allowed:",
        normalizedOrigin
      );

      callback(null, true);
      return;
    }

    // -------------------------------------------------
    // Reject unknown origin
    // -------------------------------------------------

    console.error(
      "❌ CORS Blocked:",
      normalizedOrigin
    );

    callback(null, false);
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "Pragma",
    "X-Requested-With",
    "Accept",
  ],

  optionsSuccessStatus: 204,
};

// =====================================================
// APPLY CORS
// =====================================================

app.use(
  cors(corsOptions)
);

// =====================================================
// BODY PARSER
// =====================================================

app.use(
  express.json()
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

// =====================================================
// ROOT ROUTE
// =====================================================

app.get(
  "/",
  (_req, res) => {
    res.status(200).json({
      success: true,
      message:
        "EMS-PMS Backend API is running 🚀",
    });
  }
);

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
// DATABASE CONNECTION MIDDLEWARE
// =====================================================
//
// Every API request waits until MongoDB
// connection is available.
// =====================================================

app.use(
  async (_req, res, next) => {
    try {
      await connectDB();

      next();
    } catch (error) {
      console.error(
        "❌ Database unavailable:",
        error
      );

      res.status(503).json({
        success: false,
        message:
          "Database connection unavailable",
      });
    }
  }
);

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

// -----------------------------------------------------
// PROJECT ROUTES
// -----------------------------------------------------

app.use(
  "/api/v1/projects",
  projectRoutes
);

// -----------------------------------------------------
// TASK ROUTES
// -----------------------------------------------------

app.use(
  "/api/v1/tasks",
  taskRoutes
);

// -----------------------------------------------------
// SPRINT ROUTES
// -----------------------------------------------------

app.use(
  "/api/v1/sprints",
  sprintRoutes
);

// -----------------------------------------------------
// STANDUP ROUTES
// -----------------------------------------------------

app.use(
  "/api/v1/standups",
  standupRoutes
);

// -----------------------------------------------------
// LEAVE ROUTES
// -----------------------------------------------------

app.use(
  "/api/v1/leaves",
  leaveRoutes
);

// -----------------------------------------------------
// DASHBOARD ROUTES
// -----------------------------------------------------

app.use(
  "/api/v1/dashboard",
  dashboardRoutes
);

// -----------------------------------------------------
// REPORT ROUTES
// -----------------------------------------------------

app.use(
  "/api/v1/reports",
  reportRoutes
);

// -----------------------------------------------------
// AUDIT LOG ROUTES
// -----------------------------------------------------

app.use(
  "/api/v1/audit-logs",
  auditLogRoutes
);

// -----------------------------------------------------
// LOGIN SESSION ROUTES
// -----------------------------------------------------

app.use(
  "/api/v1/login-sessions",
  loginSessionRoutes
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
// EMAIL SMTP CONNECTION
// =====================================================

void verifyEmailConnection();

// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  () => {
    console.log(
      "======================================"
    );

    console.log(
      "🚀 EMS-PMS BACKEND SERVER"
    );

    console.log(
      `🌐 Server running on port ${PORT}`
    );

    console.log(
      "❤️ Health: /api/v1/health"
    );

    console.log(
      "🔔 Notifications: /api/v1/notifications"
    );

    console.log(
      "======================================"
    );
  }
);

export default app;