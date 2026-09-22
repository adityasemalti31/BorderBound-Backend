const ContestantProfile = require("../models/contestant.model");
const SystemConfig = require("../models/systemConfig.model");
const VoteTransaction = require("../models/voteTransaction.model");
const Payment = require("../models/payment.model");
const { getVotingStatusInfo } = require("../utils/dateUtils");
const { createPayment, verifyPayUResponseHash } = require("./payment.service");

const getSystemConfig = async () => {
  let config = await SystemConfig.findOne({ key: "DEFAULT_CONFIG" });
  if (!config) {
    config = await SystemConfig.create({ key: "DEFAULT_CONFIG" });
  }
  return config;
};

// Step 4 & 8: Get voting packages and pricing options
const getVotingPackages = async () => {
  const config = await getSystemConfig();
  const votingStatus = getVotingStatusInfo(new Date(), config);

  const unitPrice = config.voteUnitPrice || 5;

  const packages = [
    { id: "pkg_1", votes: 1, amount: 1 * unitPrice, label: "1 Vote (₹5)" },
    { id: "pkg_10", votes: 10, amount: 10 * unitPrice, label: "10 Votes (₹50)" },
    { id: "pkg_100", votes: 100, amount: 100 * unitPrice, label: "100 Votes (₹500)" },
    { id: "pkg_1000", votes: 1000, amount: 1000 * unitPrice, label: "1,000 Votes (₹5,000)" },
  ];

  return {
    votingStatus,
    unitPrice,
    packages,
  };
};

// Step 11: Create Vote Purchase Payment Order
const createVoteOrder = async ({ contestantId, votesCount, voterUserId, ipAddress, userAgent }) => {
  const config = await getSystemConfig();
  const votingStatus = getVotingStatusInfo(new Date(), config);

  if (!votingStatus.isOpen) {
    throw new Error(votingStatus.reason || "Public voting is currently closed.");
  }

  if (!contestantId) {
    throw new Error("Contestant ID is required for voting.");
  }

  const contestant = await ContestantProfile.findOne({
    _id: contestantId,
    // isLive: true,
    status: "approved",
  });

  if (!contestant) {
    throw new Error("Contestant profile not found or not eligible for voting.");
  }

  if (!votesCount || votesCount < 1) {
    throw new Error("Invalid votes quantity. Must be at least 1 vote.");
  }

  const unitPrice = config.voteUnitPrice || 5;
  const amount = votesCount * unitPrice;

  const orderData = await createPayment({
    userId: voterUserId || null,
    contestantId,
    amount,
    type: "voting",
    votesGenerated: votesCount,
    productinfo: `Borderbound Voting - ${votesCount} Votes for ${contestant.fullName}`,
    firstname: "Voter",
    email: "voter@borderbound.in",
    phone: "9999999999",
    udf1: String(voterUserId || "guest"),
    udf2: "voting",
    udf3: String(contestantId),
    udf4: String(votesCount),
    ipAddress,
    userAgent,
  });

  return {
    ...orderData,
    contestant: {
      id: contestant._id,
      applicationId: contestant.applicationId,
      fullName: contestant.fullName,
    },
    votesCount,
    unitPrice,
  };
};

// Step 11 Verification: Verify Vote Payment and Atomically Allocate Votes
const verifyVotePayment = async (paymentData) => {
  const config = await getSystemConfig();
  if (config.isFinalized) {
    throw new Error("Voting period is officially finalized. No new votes can be verified.");
  }

  const { txnid, status, hash, voterIp, udf3, udf4 } = paymentData;

  if (!txnid || !status || !hash) {
    throw new Error("Invalid PayU payment response.");
  }

  const isValidHash = verifyPayUResponseHash(paymentData);
  if (!isValidHash) {
    throw new Error("Payment verification failed.");
  }

  const payment = await Payment.findOne({ txnid });
  if (!payment) {
    throw new Error("Payment transaction not found.");
  }

  if (payment.type !== "voting") {
    throw new Error("Payment is not a valid voting payment order.");
  }

  if (status !== "success") {
    payment.status = "failed";
    payment.rawResponse = paymentData;
    await payment.save();
    throw new Error("Payment was not successful.");
  }

  if (payment.status === "success") {
    const contestant = await ContestantProfile.findById(payment.contestantId);
    return {
      success: true,
      message: "Payment already verified.",
      contestant: contestant ? {
        id: contestant._id,
        fullName: contestant.fullName,
        totalValidVotes: contestant.totalValidVotes,
        currentRank: contestant.rank,
      } : null,
    };
  }

  payment.status = "success";
  payment.mihpayid = paymentData.mihpayid || null;
  payment.paymentMode = paymentData.mode || null;
  payment.bankReferenceNumber = paymentData.bank_ref_num || null;
  payment.rawResponse = paymentData;
  await payment.save();

  const contestantId = payment.contestantId || udf3;
  const votesCount = payment.votesGenerated || Number(udf4) || 1;

  // Atomically increment contestant's total valid votes and update timestamp
  const updatedContestant = await ContestantProfile.findByIdAndUpdate(
    contestantId,
    {
      $inc: { totalValidVotes: votesCount },
      $set: { lastVoteReceivedAt: new Date() },
    },
    { new: true }
  );

  if (!updatedContestant) {
    throw new Error("Target contestant profile not found.");
  }

  // Create Vote Transaction Audit Record
  const voteTransaction = await VoteTransaction.create({
    contestantId,
    voterUserId: payment.userId || null,
    voterIp: voterIp || payment.ipAddress || "0.0.0.0",
    paymentId: payment._id,
    votesCount,
    votePriceUnit: payment.amount / votesCount,
    totalAmountPaid: payment.amount,
    status: "valid",
  });

  return {
    success: true,
    message: `Successfully cast ${votesCount} votes for ${updatedContestant.fullName}!`,
    contestant: {
      id: updatedContestant._id,
      fullName: updatedContestant.fullName,
      totalValidVotes: updatedContestant.totalValidVotes,
      currentRank: updatedContestant.rank,
    },
    transactionId: voteTransaction._id,
  };
};

module.exports = {
  getVotingPackages,
  createVoteOrder,
  verifyVotePayment,
};
