const express = require("express");
const router = express.Router();
const {
  register,
  verifyMobileOtp,
  resendMobileOtp,
  login,
  getMe,
  logout
} = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { authLimiter } = require("../middleware/rateLimiter.middleware");

router.post("/register", authLimiter, register);
router.post("/verify-otp", verifyMobileOtp);
router.post("/resend-otp", authLimiter, resendMobileOtp);
router.post("/login", authLimiter, login);
router.get("/me", protect, getMe);
router.post("/logout", protect, logout);
module.exports = router;