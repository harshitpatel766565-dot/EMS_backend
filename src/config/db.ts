import mongoose from "mongoose";

// =====================================================
// CONNECT TO MONGODB
// =====================================================

const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGO_URI;

  // ===================================================
  // CHECK MONGO URI
  // ===================================================

  if (!mongoURI) {
    throw new Error(
      "MONGO_URI is not defined"
    );
  }

  // ===================================================
  // ALREADY CONNECTED
  // ===================================================

  if (
    mongoose.connection.readyState === 1
  ) {
    console.log(
      "MongoDB already connected ✅"
    );

    return;
  }

  // ===================================================
  // CONNECTION ALREADY IN PROGRESS
  // ===================================================

  if (
    mongoose.connection.readyState === 2
  ) {
    console.log(
      "MongoDB connection already in progress..."
    );

    await mongoose.connection.asPromise();

    console.log(
      "MongoDB connection completed ✅"
    );

    return;
  }

  // ===================================================
  // START CONNECTION
  // ===================================================

  console.log(
    "🔄 Connecting to MongoDB Atlas..."
  );

  try {
    await mongoose.connect(
      mongoURI,
      {
        // ---------------------------------------------
        // Connection timeout
        // ---------------------------------------------

        serverSelectionTimeoutMS: 30000,

        connectTimeoutMS: 30000,

        socketTimeoutMS: 45000,

        // ---------------------------------------------
        // Prefer IPv4
        // ---------------------------------------------

        family: 4,

        // ---------------------------------------------
        // Connection pool
        // ---------------------------------------------

        maxPoolSize: 10,

        minPoolSize: 0,

        maxIdleTimeMS: 10000,

        // ---------------------------------------------
        // Retry support
        // ---------------------------------------------

        retryWrites: true,

        retryReads: true,
      }
    );

    console.log(
      "MongoDB Connected Successfully ✅"
    );
  } catch (error) {
    console.error(
      "MongoDB Connection Failed ❌",
      error
    );

    throw error;
  }
};

// =====================================================
// EXPORT
// =====================================================

export default connectDB;