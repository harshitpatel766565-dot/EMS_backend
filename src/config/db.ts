import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGO_URI;

    if (!mongoURI) {
      throw new Error("MONGO_URI is not defined");
    }

    await mongoose.connect(mongoURI);

    console.log("MongoDB Connected Successfully ✅");
  } catch (error) {
    console.error("MongoDB Connection Failed ❌", error);
    process.exit(1);
  }
};

export default connectDB;