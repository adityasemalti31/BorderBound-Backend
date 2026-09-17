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
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const voterIp = req.ip || req.headers["x-forwarded-for"] || "0.0.0.0";

    const result = await verifyVotePayment({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      voterIp,
    });

    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  fetchVotingPackages,
  initiateVoteOrder,
  confirmVotePayment,
};
