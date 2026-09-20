const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const {
  getVotingPackages,
  createVoteOrder,
  verifyVotePayment,
} = require("../services/voting.service");

const fetchVotingPackages = async (req, res, next) => {
  try {
    const data = await getVotingPackages();
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const initiateVoteOrder = async (req, res, next) => {
  try {
    const { contestantId, votesCount } = req.body;
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || "";
    const userAgent = req.headers["user-agent"] || "";
    const voterUserId = req.user ? req.user._id : null;

    const orderData = await createVoteOrder({
      contestantId,
      votesCount: Number(votesCount),
      voterUserId,
      ipAddress,
      userAgent,
    });

    res.status(200).json({
      success: true,
      message: "Vote payment order created successfully.",
      data: orderData,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const confirmVotePayment = async (req, res, next) => {
  try {
    const voterIp = req.ip || req.headers["x-forwarded-for"] || "0.0.0.0";

    const result = await verifyVotePayment({
      ...req.body,
      voterIp,
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const handlePayUVotingSuccess = async (req, res, next) => {
  try {
    const voterIp = req.ip || req.headers["x-forwarded-for"] || "0.0.0.0";
    const result = await verifyVotePayment({
      ...req.body,
      voterIp,
    });

    const contestantId = req.body.udf3 || "";
    const votesCount = req.body.udf4 || "";

    if (req.headers.accept?.includes("text/html") || req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
      const redirectPath = contestantId ? `/contestant/${contestantId}` : "/leaderboard";
      return res.redirect(`${FRONTEND_URL}${redirectPath}?voting=success&votes=${votesCount}&txnid=${req.body.txnid || ""}`);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("PayU voting success callback error:", error);

    const contestantId = req.body.udf3 || "";
    if (req.headers.accept?.includes("text/html") || req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
      const redirectPath = contestantId ? `/contestant/${contestantId}` : "/leaderboard";
      return res.redirect(`${FRONTEND_URL}${redirectPath}?voting=failed&reason=${encodeURIComponent(error.message)}`);
    }

    res.status(400).json({ success: false, message: error.message });
  }
};

const handlePayUVotingFailure = async (req, res, next) => {
  try {
    const contestantId = req.body.udf3 || "";
    if (req.headers.accept?.includes("text/html") || req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
      const redirectPath = contestantId ? `/contestant/${contestantId}` : "/leaderboard";
      return res.redirect(`${FRONTEND_URL}${redirectPath}?voting=failed&reason=Payment%20cancelled%20or%20failed`);
    }

    res.status(400).json({ success: false, message: "PayU voting payment failed." });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  fetchVotingPackages,
  initiateVoteOrder,
  confirmVotePayment,
  handlePayUVotingSuccess,
  handlePayUVotingFailure,
};

