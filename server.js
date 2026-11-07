
const app = require("./app");
const connectDB = require("./src/config/db");
const SystemConfig = require("./src/models/systemConfig.model");
require("dotenv").config();
const { startCandidateReminderJob } = require("./src/utils/reminder");

const { startPaymentReconciliationCron } = require("./src/services/reconciliation.service");

const express = require("express");
const path = require("path");

const PORT = process.env.PORT || 5000;

const STORAGE_ROOT =
  process.env.STORAGE_ROOT || path.join(__dirname, "uploads");

app.use(
  "/uploads/contestant-photos",
  express.static(
    path.join(STORAGE_ROOT, "contestant-photos")
  )
);

app.use(
  "/private-documents",
  express.static(
    path.join(STORAGE_ROOT, "contestant-docs")
  )
);

const startServer = async () => {
  try {
    await connectDB();

    // Ensure initial SystemConfig exists
    let config = await SystemConfig.findOne({ key: "DEFAULT_CONFIG" });
    if (!config) {
      config = await SystemConfig.create({ key: "DEFAULT_CONFIG" });
      console.log("Initialized default BorderBound system config.");
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      // Start safe forward-only payment reconciliation watcher
      startPaymentReconciliationCron();
      // startCandidateReminderJob();
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();
