// =====================================================
// ENVIRONMENT CONFIGURATION
// =====================================================

import dotenv from "dotenv";

dotenv.config();

// =====================================================
// IMPORTS
// =====================================================

import express from "express";
import cors, {
  CorsOptions,
} from "cors";

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

void connectDB();

// =====================================================
// EMAIL SMTP CONNECTION
// =====================================================

void verifyEmailConnection();

// =====================================================
// CORS CONFIGURATION
// =====================================================

// Local development origins
const allowedOrigins: string[] = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

// =====================================================
// PRODUCTION FRONTEND URL
// =====================================================

// Your current Vercel frontend URL
const productionFrontendUrl =
  "https://ems-frontend-beta-seven.vercel.app";

// Add production frontend
if (
  !allowedOrigins.includes(
    productionFrontendUrl
  )
) {
  allowedOrigins.push(
    productionFrontendUrl
  );
}

// Add FRONTEND_URL from Vercel environment
if (process.env.FRONTEND_URL) {
  const envFrontendUrl =
    process.env.FRONTEND_URL
      .trim()
      .replace(/\/$/, "");

  if (
    envFrontendUrl &&
    !allowedOrigins.includes(
      envFrontendUrl
    )
  ) {
    allowedOrigins.push(
      envFrontendUrl
    );
  }
}

// =====================================================
// CORS OPTIONS
// =====================================================

const corsOptions: CorsOptions = {
  origin: (
    origin,
    callback
  ) => {
    // -----------------------------------------------
    // Requests without Origin
    // Thunder Client
    // Postman
    // curl
    // Server-to-server
    // -----------------------------------------------

    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin =
      origin
        .trim()
        .replace(/\/$/, "");

    console.log(
      "🌐 Incoming Origin:",
      normalizedOrigin
    );

    console.log(
      "✅ Allowed Origins:",
      allowedOrigins
    );

    // -----------------------------------------------
    // Exact origin match
    // -----------------------------------------------

    if (
      allowedOrigins.includes(
        normalizedOrigin
      )
    ) {
      return callback(null, true);
    }

    // -----------------------------------------------
    // Allow Vercel preview deployments
    // belonging to EMS frontend project
    // -----------------------------------------------

    const isVercelFrontend =
      normalizedOrigin.startsWith(
        "https://ems-frontend"
      ) &&
      normalizedOrigin.endsWith(
        ".vercel.app"
      );

    if (isVercelFrontend) {
      console.log(
        "✅ Vercel frontend origin allowed:",
        normalizedOrigin
      );

      return callback(null, true);
    }

    // -----------------------------------------------
    // Reject unknown origins
    // -----------------------------------------------

    console.error(
      "❌ CORS BLOCKED ORIGIN:",
      normalizedOrigin
    );

    // Do not throw an application error.
    // Simply reject the origin.
    return callback(null, false);
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
  ],

  exposedHeaders: [
    "Content-Length",
  ],

  optionsSuccessStatus: 204,
};

// =====================================================
// APPLY CORS
// =====================================================

app.use(cors(corsOptions));

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