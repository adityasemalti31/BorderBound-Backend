const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const errorHandler = require("./src/middleware/errorHandler.middleware");
require("dotenv").config();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

// Static local uploads folder fallback
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "THE BORDERBOUND Official Registration & Voting API is active.",
  });
});

// API Routes
app.use("/api/auth", require("./src/routes/auth.routes"));
app.use("/api/contestants", require("./src/routes/contestant.routes"));
app.use("/api/voting", require("./src/routes/voting.routes"));
app.use("/api/leaderboard", require("./src/routes/leaderboard.routes"));
app.use("/api/admin", require("./src/routes/admin.routes"));
app.use("/api/config", require("./src/routes/config.routes"));

// Central Error Handler
app.use(errorHandler);

module.exports = app;