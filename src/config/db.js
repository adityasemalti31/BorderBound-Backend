const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB connected: ${mongoose.connection.host || "Local"}`);
  } catch (error) {
    console.warn("Primary MONGO_URI connection failed. Attempting local MongoDB fallback...");
    try {
      await mongoose.connect("mongodb://127.0.0.1:27017/borderbound", {
        serverSelectionTimeoutMS: 3000,
      });
      console.log("Connected to local MongoDB database (borderbound).");
    } catch (fallbackError) {
      console.error("MongoDB connection failed:", error.message);
      console.error("Please ensure MongoDB Atlas IP Whitelist includes your current IP or start local MongoDB service.");
      process.exit(1);
    }
  }
};

module.exports = connectDB;