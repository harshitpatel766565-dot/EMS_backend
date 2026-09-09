import { Response, NextFunction } from "express";
import { AuthRequest } from "./authMiddleware";

type UserRole =
  | "SUPER_ADMIN"
  | "PROJECT_MANAGER"
  | "EMPLOYEE";

const roleMiddleware = (
  ...allowedRoles: UserRole[]
) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource",
      });
      return;
    }

    next();
  };
};

export default roleMiddleware;