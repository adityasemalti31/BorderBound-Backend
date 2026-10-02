
const express = require("express");

const router = express.Router();

const {
  register,
  login,
  googleAuth,
  getMe,
  logout,
  forgotPasswordController,
  resetPasswordController,
} = require("../controllers/auth.controller");

const { protect } = require("../middleware/auth.middleware");
const { authLimiter } = require("../middleware/rateLimiter.middleware");

router.post("/register", register);

router.post("/login", authLimiter, login);

router.post("/google", authLimiter, googleAuth);

router.get("/me", protect, getMe);

router.post("/logout", protect, logout);


router.post("/forgot-password", authLimiter, forgotPasswordController);

router.post("/reset-password", authLimiter, resetPasswordController);

module.exports = router;
