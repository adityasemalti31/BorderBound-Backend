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
} = require("../controllers/admin.controller");
const { protect, requireAdmin } = require("../middleware/auth.middleware");

// Require JWT and Admin Role
router.use(protect, requireAdmin);

router.get("/stats", fetchDashboardStats);
router.get("/applications", fetchApplications);
router.patch("/applications/:id/status", handleReviewApplication);

router.get("/payments", fetchPayments);

router.get("/votes", fetchVoteAuditLogs);
router.post("/votes/invalidate", handleInvalidateVote);

router.get("/final-selections", fetchFinalSelections);
router.post("/select-wildcards", handleSelectWildcards);
router.post("/certify-results", handleCertifyResults);

router.put("/config", handleUpdateConfig);

module.exports = router;
