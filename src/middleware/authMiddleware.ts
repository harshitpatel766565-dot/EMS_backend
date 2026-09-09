import { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../services/tokenService";
import User from "../models/User";

// =====================================================
// AUTH REQUEST TYPE
// =====================================================

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    department?: string;
  };
}

// =====================================================
// AUTH MIDDLEWARE
// =====================================================

const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // =====================================================
    // GET AUTHORIZATION HEADER
    // =====================================================

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: "Authorization header is missing",
      });
      return;
    }

    // =====================================================
    // CHECK BEARER TOKEN
    // =====================================================

    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authorization must use Bearer token",
      });
      return;
    }

    // =====================================================
    // EXTRACT TOKEN
    // =====================================================

    const token = authHeader.substring(7).trim();

    if (!token) {
      res.status(401).json({
        success: false,
        message: "Access token is missing",
      });
      return;
    }

    // =====================================================
    // VERIFY TOKEN
    // =====================================================

    const decoded = verifyAccessToken(token);

    // =====================================================
    // FIND CURRENT USER
    // =====================================================
    //
    // We fetch the user from MongoDB so that:
    // - role is current
    // - department is current
    // - inactive users can be blocked
    //
    // =====================================================

    const user = await User.findById(decoded.userId).select(
      "_id role department isActive"
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User account not found",
      });
      return;
    }

    // =====================================================
    // CHECK ACTIVE STATUS
    // =====================================================

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: "Your account has been deactivated",
      });
      return;
    }

    // =====================================================
    // SAVE USER IN REQUEST
    // =====================================================

    req.user = {
      userId: String(user._id),
      role: user.role,
      department: user.department
        ? String(user.department)
        : undefined,
    };

    // =====================================================
    // CONTINUE
    // =====================================================

    next();
  } catch (error) {
    console.error("Authentication Error ❌:", error);

    res.status(401).json({
      success: false,
      message: "Invalid or expired access token",
    });
  }
};

export default authMiddleware;