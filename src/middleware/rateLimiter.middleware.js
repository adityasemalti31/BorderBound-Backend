const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
  windowMs: 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many authentication requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const votingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // max 30 vote creation attempts per min
  message: {
    success: false,
    message: "High volume voting detected. Please slow down your requests.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  votingLimiter,
};
