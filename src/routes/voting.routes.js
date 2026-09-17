const express = require("express");
const router = express.Router();
const {
  fetchVotingPackages,
  initiateVoteOrder,
  confirmVotePayment,
} = require("../controllers/voting.controller");
const { optionalAuth } = require("../middleware/auth.middleware");
const { votingLimiter } = require("../middleware/rateLimiter.middleware");

router.get("/packages", fetchVotingPackages);
router.post("/create-order", votingLimiter, optionalAuth, initiateVoteOrder);
router.post("/verify-payment", votingLimiter, confirmVotePayment);

module.exports = router;
