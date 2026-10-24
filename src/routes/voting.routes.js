const express = require("express");
const router = express.Router();
const {
  fetchVotingPackages,
  initiateVoteOrder,
  confirmVotePayment,
  handlePayUVotingSuccess,
  handlePayUVotingFailure,
  checkVotePaymentStatus,
} = require("../controllers/voting.controller");
const { optionalAuth } = require("../middleware/auth.middleware");
const { votingLimiter } = require("../middleware/rateLimiter.middleware");

router.get("/packages", fetchVotingPackages);
router.post("/create-order", votingLimiter, optionalAuth, initiateVoteOrder);
router.post("/verify-payment", votingLimiter, confirmVotePayment);

// Public status check fallback (verifies directly with PayU if missed)
router.get("/payment-status/:txnid", checkVotePaymentStatus);
router.post("/verify-status", checkVotePaymentStatus);

// PayU Webhook Callbacks
router.post("/payu/success", handlePayUVotingSuccess);
router.post("/payu/failure", handlePayUVotingFailure);

module.exports = router;

