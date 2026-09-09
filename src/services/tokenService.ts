import jwt from "jsonwebtoken";

interface AccessTokenPayload {
  userId: string;
  role: string;
}

interface RefreshTokenPayload {
  userId: string;
}

export const generateAccessToken = (
  userId: string,
  role: string
): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }

  const payload: AccessTokenPayload = {
    userId,
    role,
  };

  return jwt.sign(payload, secret, {
    expiresIn: (process.env.JWT_EXPIRES_IN || "15m") as jwt.SignOptions["expiresIn"],
  });
};

export const generateRefreshToken = (userId: string): string => {
  const secret = process.env.REFRESH_TOKEN_SECRET;

  if (!secret) {
    throw new Error("REFRESH_TOKEN_SECRET is not defined");
  }

  const payload: RefreshTokenPayload = {
    userId,
  };

  return jwt.sign(payload, secret, {
    expiresIn: (
      process.env.REFRESH_TOKEN_EXPIRES_IN || "7d"
    ) as jwt.SignOptions["expiresIn"],
  });
};

export const verifyAccessToken = (
  token: string
): AccessTokenPayload => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }

  return jwt.verify(token, secret) as AccessTokenPayload;
};

export const verifyRefreshToken = (
  token: string
): RefreshTokenPayload => {
  const secret = process.env.REFRESH_TOKEN_SECRET;

  if (!secret) {
    throw new Error("REFRESH_TOKEN_SECRET is not defined");
  }

  return jwt.verify(token, secret) as RefreshTokenPayload;
};