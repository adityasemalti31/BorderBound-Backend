const ContestantProfile = require("../models/contestant.model");
const User = require("../models/user.model");
const VoteTransaction = require("../models/voteTransaction.model");
const SystemConfig = require("../models/systemConfig.model");
const Payment = require("../models/payment.model");
const { refreshLeaderboardRanks } = require("./leaderboard.service");

// Step 6: Application Review & Approval / Rejection
const reviewApplication = async (contestantId, { action, rejectionReason }) => {
  const profile = await ContestantProfile.findById(contestantId);
  if (!profile) {
    throw new Error("Contestant application profile not found.");
  }

  if (action === "approve") {
    profile.status = "approved";
    profile.isLive = true;
    profile.rejectionReason = "";
    await profile.save();

    // Upgrade user role to contestant
    await User.findByIdAndUpdate(profile.userId, { role: "contestant" });

    // Refresh ranks to assign initial rank
    await refreshLeaderboardRanks();

    return {
      success: true,
      message: `Application ${profile.applicationId} approved and profile is now LIVE on BorderBound website.`,
      profile,
    };
  } else if (action === "reject") {
    if (!rejectionReason) {
      throw new Error("Rejection reason is required.");
    }
    profile.status = "rejected";
    profile.isLive = false;
    profile.rejectionReason = rejectionReason;
    await profile.save();

    return {
      success: true,
      message: `Application ${profile.applicationId} rejected.`,
      profile,
    };
  } else {
    throw new Error("Invalid action. Must be 'approve' or 'reject'.");
  }
};

// List all applications with status & search filters
const getApplications = async ({ status, search, page = 1, limit = 20, exportAll = false }) => {
  const query = {};
  if (status) query.status = status;

  if (search) {
    const searchRegex = new RegExp(search, "i");
    query.$or = [
      { fullName: searchRegex },
      { applicationId: searchRegex },
      { email: searchRegex },
      { mobile: searchRegex },
      { city: searchRegex },
      { state: searchRegex },
    ];
  }

  if (exportAll === "true" || exportAll === true) {
    const applications = await ContestantProfile.find(query)
      .populate("userId", "fullName email mobile")
      .sort({ createdAt: -1 });
    return { applications, total: applications.length };
  }

  const skip = (page - 1) * limit;

  const applications = await ContestantProfile.find(query)
    .populate("userId", "fullName email mobile")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await ContestantProfile.countDocuments(query);

  return {
    applications,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
  };
};

// List all payment records with filters & search
const getPayments = async ({ status, type, search, page = 1, limit = 20, exportAll = false }) => {
  const query = {};
  if (status) query.status = status;
  if (type) query.type = type;

  if (search) {
    const searchRegex = new RegExp(search, "i");
    const matchingUsers = await User.find({
      $or: [{ fullName: searchRegex }, { email: searchRegex }, { mobile: searchRegex }],
    }).select("_id");

    const matchingContestants = await ContestantProfile.find({
      $or: [{ fullName: searchRegex }, { applicationId: searchRegex }, { email: searchRegex }],
    }).select("_id");

    const userIds = matchingUsers.map((u) => u._id);
    const contestantIds = matchingContestants.map((c) => c._id);

    query.$or = [
      { txnid: searchRegex },
      { mihpayid: searchRegex },
      { bankReferenceNumber: searchRegex },
      { userId: { $in: userIds } },
      { contestantId: { $in: contestantIds } },
    ];
  }

  if (exportAll === "true" || exportAll === true) {
    const payments = await Payment.find(query)
      .populate("userId", "fullName email mobile")
      .populate("contestantId", "fullName applicationId email mobile")
      .sort({ createdAt: -1 });

    return { payments, total: payments.length };
  }

  const skip = (page - 1) * limit;
  const payments = await Payment.find(query)
    .populate("userId", "fullName email mobile")
    .populate("contestantId", "fullName applicationId email mobile")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const total = await Payment.countDocuments(query);

  return {
    payments,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
  };
};

// Admin Dashboard Summary KPIs
const getDashboardStats = async () => {
  const totalApplications = await ContestantProfile.countDocuments();
  const pendingApplications = await ContestantProfile.countDocuments({ status: "pending_review" });
  const approvedApplications = await ContestantProfile.countDocuments({ status: "approved" });

  const totalSuccessfulPayments = await Payment.countDocuments({ status: "success" });

  const revenueResult = await Payment.aggregate([
    { $match: { status: "success" } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

  const votesResult = await ContestantProfile.aggregate([
    { $group: { _id: null, total: { $sum: "$totalValidVotes" } } },
  ]);
  const totalVotesCast = votesResult.length > 0 ? votesResult[0].total : 0;

  return {
    totalApplications,
    pendingApplications,
    approvedApplications,
    totalSuccessfulPayments,
    totalRevenue,
    totalVotesCast,
  };
};

// Step 10 & 15: Vote Verification & Anti-Fraud Invalidation
const invalidateVoteTransaction = async (transactionId, adminUserId, reason) => {
  const transaction = await VoteTransaction.findById(transactionId);
  if (!transaction) {
    throw new Error("Vote transaction not found.");
  }

  if (transaction.status === "invalidated") {
    throw new Error("Transaction has already been invalidated.");
  }

  transaction.status = "invalidated";
  transaction.invalidatedAt = new Date();
  transaction.invalidatedBy = adminUserId;
  transaction.invalidatedReason = reason || "Bot / Prohibited voting activity";
  await transaction.save();

  // Deduct invalidated votes from contestant totalValidVotes
  const contestant = await ContestantProfile.findById(transaction.contestantId);
  if (contestant) {
    contestant.totalValidVotes = Math.max(0, contestant.totalValidVotes - transaction.votesCount);
    await contestant.save();
  }

  // Refresh leaderboard ranks after vote deduction
  await refreshLeaderboardRanks();

  return {
    success: true,
    message: `Invalidated ${transaction.votesCount} votes for transaction ${transactionId}. Leaderboard updated.`,
    deductedVotes: transaction.votesCount,
    updatedContestantVotes: contestant ? contestant.totalValidVotes : 0,
  };
};

// Bulk Invalidate Votes by Voter IP Address (e.g. Botnet / Farm IP)
const invalidateVotesByIp = async (voterIp, adminUserId, reason) => {
  const transactions = await VoteTransaction.find({
    voterIp,
    status: "valid",
  });

  if (transactions.length === 0) {
    return { success: true, message: `No valid transactions found for IP: ${voterIp}` };
  }

  let totalVotesDeducted = 0;

  for (const tx of transactions) {
    tx.status = "invalidated";
    tx.invalidatedAt = new Date();
    tx.invalidatedBy = adminUserId;
    tx.invalidatedReason = reason || `Suspicious activity from IP: ${voterIp}`;
    await tx.save();

    totalVotesDeducted += tx.votesCount;

    await ContestantProfile.findByIdAndUpdate(tx.contestantId, {
      $inc: { totalValidVotes: -tx.votesCount },
    });
  }

  await refreshLeaderboardRanks();

  return {
    success: true,
    message: `Invalidated ${transactions.length} transactions (${totalVotesDeducted} total votes) from IP ${voterIp}.`,
    transactionsAffected: transactions.length,
    totalVotesDeducted,
  };
};

// Step 8, 9, 12, 13, 16: Process Final Top 32, Top 50, and Certification
const calculateFinalSelections = async () => {
  await refreshLeaderboardRanks();

  // Fetch top 50 ranked live contestants
  const topContestants = await ContestantProfile.find({ isLive: true, status: "approved" })
    .sort({ totalValidVotes: -1, lastVoteReceivedAt: 1 })
    .limit(50);

  const top32 = topContestants.slice(0, 32);
  const top50Remaining = topContestants.slice(32, 50);

  return {
    top32: top32.map((c, idx) => ({
      rank: idx + 1,
      id: c._id,
      applicationId: c.applicationId,
      fullName: c.fullName,
      totalValidVotes: c.totalValidVotes,
      city: c.city,
      selectionStatus: c.selectionStatus,
    })),
    wildcardEligibleTop50: top50Remaining.map((c, idx) => ({
      rank: idx + 33,
      id: c._id,
      applicationId: c.applicationId,
      fullName: c.fullName,
      totalValidVotes: c.totalValidVotes,
      city: c.city,
      selectionStatus: c.selectionStatus,
      isWildCardSelected: c.isWildCardSelected,
    })),
  };
};

// Step 9 & 13: Select 4 Wild Card contestants from Top 50 (ranked 33-50)
const selectWildcards = async (wildcardContestantIds) => {
  if (!Array.isArray(wildcardContestantIds) || wildcardContestantIds.length !== 4) {
    throw new Error("Exactly 4 Wild Card contestant IDs must be selected.");
  }

  await refreshLeaderboardRanks();

  // Fetch Top 50
  const top50 = await ContestantProfile.find({ isLive: true, status: "approved" })
    .sort({ totalValidVotes: -1, lastVoteReceivedAt: 1 })
    .limit(50);

  const top50Ids = top50.map((c) => c._id.toString());

  // Verify all 4 selected IDs are within Top 50 (and outside Top 32)
  for (const id of wildcardContestantIds) {
    const contestant = top50.find((c) => c._id.toString() === String(id));
    if (!contestant) {
      throw new Error(`Contestant ${id} is not within the Top 50 eligible list.`);
    }
    if (contestant.rank <= 32) {
      throw new Error(`Contestant ${contestant.fullName} (Rank #${contestant.rank}) is already in Top 32!`);
    }
  }

  // Update selected Wildcards
  await ContestantProfile.updateMany(
    { _id: { $in: wildcardContestantIds } },
    { $set: { selectionStatus: "wildcard", isWildCardSelected: true } }
  );

  return {
    success: true,
    message: "Successfully selected 4 Wild Card contestants for THE BORDERBOUND!",
    selectedIds: wildcardContestantIds,
  };
};

// Step 16: Final Competition Certification
const certifyFinalResults = async () => {
  await refreshLeaderboardRanks();

  const topContestants = await ContestantProfile.find({ isLive: true, status: "approved" })
    .sort({ totalValidVotes: -1, lastVoteReceivedAt: 1 });

  // Reset statuses
  await ContestantProfile.updateMany(
    { isLive: true },
    { $set: { selectionStatus: "eliminated" } }
  );

  // Mark Top 32
  const top32Ids = topContestants.slice(0, 32).map((c) => c._id);
  await ContestantProfile.updateMany(
    { _id: { $in: top32Ids } },
    { $set: { selectionStatus: "top_32", certifiedAt: new Date() } }
  );

  // Mark remaining Top 50 eligible
  const top50RemainingIds = topContestants.slice(32, 50).map((c) => c._id);
  await ContestantProfile.updateMany(
    { _id: { $in: top50RemainingIds }, selectionStatus: { $ne: "wildcard" } },
    { $set: { selectionStatus: "top_50" } }
  );

  // Freeze competition config
  let config = await SystemConfig.findOne({ key: "DEFAULT_CONFIG" });
  if (!config) config = new SystemConfig({ key: "DEFAULT_CONFIG" });
  config.isFinalized = true;
  config.leaderboardFrozen = true;
  await config.save();

  return {
    success: true,
    message: "THE BORDERBOUND competition results officially certified and locked!",
    initial32Count: top32Ids.length,
    top50Count: 50,
  };
};

// Update System Config
const updateSystemConfig = async (configUpdates) => {
  let config = await SystemConfig.findOne({ key: "DEFAULT_CONFIG" });
  if (!config) {
    config = new SystemConfig({ key: "DEFAULT_CONFIG" });
  }

  Object.assign(config, configUpdates);
  await config.save();

  return config;
};

module.exports = {
  reviewApplication,
  getApplications,
  getPayments,
  getDashboardStats,
  invalidateVoteTransaction,
  invalidateVotesByIp,
  calculateFinalSelections,
  selectWildcards,
  certifyFinalResults,
  updateSystemConfig,
};
