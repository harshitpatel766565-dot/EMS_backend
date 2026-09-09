import mongoose from "mongoose";

let connectionPromise: Promise<typeof mongoose> | null = null;

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      console.error("❌ MONGO_URI is not defined");
      return;
    }

    // Already connected
    if (mongoose.connection.readyState === 1) {
      console.log("MongoDB already connected ✅");
      return;
    }

    // Reuse an existing connection attempt
    if (mongoose.connection.readyState === 2 && connectionPromise) {
      await connectionPromise;
      return;
    }

    console.log("🔄 Connecting to MongoDB Atlas...");

    connectionPromise = mongoose.connect(mongoURI, {
      // MongoDB connection settings
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,

      // Prefer IPv4 for Vercel/serverless networking
      family: 4,

      // Connection pool
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 10000,

      // MongoDB retry support
      retryWrites: true,
      retryReads: true,
    });

    await connectionPromise;

    console.log("MongoDB Connected Successfully ✅");

    connectionPromise = null;
  } catch (error) {
    connectionPromise = null;

    console.error(
      "MongoDB Connection Failed ❌",
      error
    );

    // Do not use process.exit(1) on Vercel/serverless.
    // Keep the function alive so Vercel can handle the request.
  }
};

export default connectDB;