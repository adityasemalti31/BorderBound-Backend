
const express = require("express");
const router = express.Router();

const {
  handleReviewApplication,
  fetchApplications,
  fetchPayments,
  fetchDashboardStats,
  handleInvalidateVote,
  fetchVoteAuditLogs,
  fetchFinalSelections,
  handleSelectWildcards,
  handleCertifyResults,
  handleUpdateConfig,
  changePassword,

  // User Management
  fetchAllUsers,
  fetchUserById,
  handleUpdateUser,
} = require("../controllers/admin.controller");

const {
  protect,
  requireAdmin,
} = require("../middleware/auth.middleware");

// Require JWT and Admin Role
router.use(protect, requireAdmin);

// Dashboard
router.get("/stats", fetchDashboardStats);

// Applications
router.get("/applications", fetchApplications);
router.patch("/applications/:id/status", handleReviewApplication);

// Payments
router.get("/payments", fetchPayments);

// Votes
router.get("/votes", fetchVoteAuditLogs);
router.post("/votes/invalidate", handleInvalidateVote);

// Final Selections
router.get("/final-selections", fetchFinalSelections);
router.post("/select-wildcards", handleSelectWildcards);
router.post("/certify-results", handleCertifyResults);

// User Management
router.get("/users", fetchAllUsers);
router.get("/users/:id", fetchUserById);
router.put("/users/:id", handleUpdateUser);

// System Config
router.put("/config", handleUpdateConfig);

// Admin Password
router.put("/change-password", changePassword);

module.exports = router;
