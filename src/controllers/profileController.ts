import { Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import path from "path";
import fs from "fs";
import User from "../models/User";
import { AuthRequest } from "../middleware/authMiddleware";

// ============================================================
// CLOUDINARY CONFIGURATION
// ============================================================

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ============================================================
// GET MY PROFILE
// GET /employees/me/profile
// ============================================================

export const getMyProfile = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }

        const user = await User.findById(userId)
            .select("-password -refreshToken")
            .populate("department", "name")
            .populate(
                "reportingManager",
                "name email employeeId"
            );

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User profile not found",
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: user,
        });
    } catch (error) {
        console.error("Get My Profile Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch profile",
        });
    }
};

// ============================================================
// UPDATE MY PROFILE
// PUT /employees/me/profile
// ============================================================

export const updateMyProfile = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?.userId;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }

        const { name, designation, contact, bio } = req.body;

        const user = await User.findById(userId);

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        // ========================================================
        // NAME
        // ========================================================

        if (name !== undefined && typeof name === "string" && name.trim() !== "") {
            user.name = name.trim();
        }

        // ========================================================
        // DESIGNATION
        // ========================================================

        if (designation !== undefined && typeof designation === "string") {
            user.designation = designation.trim();
        }

        // ========================================================
        // CONTACT
        // ========================================================

        if (contact !== undefined) {
            user.contact =
                typeof contact === "string"
                    ? contact.trim()
                    : "";
        }

        // ========================================================
        // BIO
        // ========================================================

        if (bio !== undefined) {
            user.bio =
                typeof bio === "string"
                    ? bio.trim()
                    : "";
        }

        await user.save();

        const updatedUser = await User.findById(userId)
            .select("-password -refreshToken")
            .populate("department", "name")
            .populate(
                "reportingManager",
                "name email employeeId"
            );

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            data: updatedUser,
        });
    } catch (error) {
        console.error("Update My Profile Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to update profile",
        });
    }
};

// ============================================================
// UPLOAD MY PROFILE PHOTO
// POST /employees/me/profile/photo
// ============================================================

export const uploadMyProfilePhoto = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?.userId;

        // ========================================================
        // AUTH CHECK
        // ========================================================

        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }

        // ========================================================
        // MULTER FILE CHECK
        // ========================================================

        if (!req.file) {
            res.status(400).json({
                success: false,
                message: "Profile photo is required",
            });
            return;
        }

        // ========================================================
        // GET USER
        // ========================================================

        const user = await User.findById(userId);

        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }

        let uploadedAvatarUrl = "";

        // ========================================================
        // CLOUDINARY UPLOAD (IF CONFIGURED)
        // ========================================================

        const isCloudinaryConfigured =
            !!process.env.CLOUDINARY_CLOUD_NAME &&
            !!process.env.CLOUDINARY_API_KEY &&
            !!process.env.CLOUDINARY_API_SECRET;

        if (isCloudinaryConfigured) {
            try {
                const cloudinaryResult = await new Promise<{
                    secure_url: string;
                    public_id: string;
                }>((resolve, reject) => {
                    const uploadStream = cloudinary.uploader.upload_stream(
                        {
                            folder: "employee-profiles",
                            resource_type: "image",
                            transformation: [
                                {
                                    width: 500,
                                    height: 500,
                                    crop: "fill",
                                    gravity: "face",
                                },
                            ],
                        },
                        (error, result) => {
                            if (error || !result) {
                                reject(
                                    error ||
                                    new Error("Cloudinary upload failed")
                                );
                                return;
                            }

                            resolve({
                                secure_url: result.secure_url,
                                public_id: result.public_id,
                            });
                        }
                    );

                    uploadStream.end(req.file!.buffer);
                });

                uploadedAvatarUrl = cloudinaryResult.secure_url;
            } catch (cloudinaryErr) {
                console.warn(
                    "Cloudinary upload failed, falling back to local storage:",
                    cloudinaryErr
                );
            }
        }

        // ========================================================
        // LOCAL DISK STORAGE FALLBACK
        // ========================================================

        if (!uploadedAvatarUrl) {
            const uploadsDir = path.resolve(__dirname, "../../uploads");

            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            let ext = path.extname(req.file.originalname).toLowerCase();
            if (!ext || ext === ".") {
                if (req.file.mimetype === "image/png") ext = ".png";
                else if (req.file.mimetype === "image/webp") ext = ".webp";
                else if (req.file.mimetype === "image/gif") ext = ".gif";
                else ext = ".jpg";
            }

            const filename = `avatar-${userId}-${Date.now()}${ext}`;
            const filePath = path.join(uploadsDir, filename);

            await fs.promises.writeFile(filePath, req.file.buffer);

            // Local URL for static file serving
            uploadedAvatarUrl = `${req.protocol}://${req.get("host")}/uploads/${filename}`;
        }

        // ========================================================
        // DELETE OLD LOCAL AVATAR FILE IF IT EXISTS
        // ========================================================

        if (user.avatar && user.avatar.includes("/uploads/avatar-")) {
            try {
                const oldFilename = user.avatar.split("/uploads/")[1];
                if (oldFilename) {
                    const oldFilePath = path.resolve(
                        __dirname,
                        "../../uploads",
                        oldFilename
                    );
                    if (fs.existsSync(oldFilePath)) {
                        fs.unlinkSync(oldFilePath);
                    }
                }
            } catch (cleanupErr) {
                console.error("Old local avatar cleanup error:", cleanupErr);
            }
        }

        // ========================================================
        // SAVE URL IN MONGODB
        // ========================================================

        user.avatar = uploadedAvatarUrl;

        await user.save();

        // ========================================================
        // GET UPDATED PROFILE
        // ========================================================

        const updatedUser = await User.findById(userId)
            .select("-password -refreshToken")
            .populate("department", "name")
            .populate(
                "reportingManager",
                "name email employeeId"
            );

        // ========================================================
        // RESPONSE
        // ========================================================

        res.status(200).json({
            success: true,
            message: "Profile photo updated successfully",
            data: updatedUser,
        });
    } catch (error) {
        console.error("Upload My Profile Photo Error:", error);

        res.status(500).json({
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "Failed to upload profile photo",
        });
    }
};