const {
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
} = require("../services/admin.service");
const VoteTransaction = require("../models/voteTransaction.model");

const handleReviewApplication = async (req, res, next) => {
  try {
    const { action, rejectionReason } = req.body;
    const result = await reviewApplication(req.params.id, { action, rejectionReason });
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const fetchApplications = async (req, res, next) => {
  try {
    const result = await getApplications(req.query);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const fetchPayments = async (req, res, next) => {
  try {
    const result = await getPayments(req.query);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const fetchDashboardStats = async (req, res, next) => {
  try {
    const stats = await getDashboardStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const handleInvalidateVote = async (req, res, next) => {
  try {
    const { transactionId, voterIp, reason } = req.body;

    if (transactionId) {
      const result = await invalidateVoteTransaction(transactionId, req.user._id, reason);
      return res.status(200).json(result);
    } else if (voterIp) {
      const result = await invalidateVotesByIp(voterIp, req.user._id, reason);
      return res.status(200).json(result);
    } else {
      return res.status(400).json({
        success: false,
        message: "Specify either transactionId or voterIp to invalidate votes.",
      });
    }
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const fetchVoteAuditLogs = async (req, res, next) => {
  try {
    const { status, contestantId, voterIp, page = 1, limit = 20, exportAll } = req.query;
    const query = {};
    if (status) query.status = status;
    if (contestantId) query.contestantId = contestantId;
    if (voterIp) query.voterIp = voterIp;

    if (exportAll === "true" || exportAll === true) {
      const transactions = await VoteTransaction.find(query)
        .populate("contestantId", "fullName applicationId")
        .populate("voterUserId", "fullName email mobile")
        .sort({ createdAt: -1 });
      return res.status(200).json({
        success: true,
        data: { transactions, total: transactions.length },
      });
    }

    const skip = (page - 1) * limit;

    const transactions = await VoteTransaction.find(query)
      .populate("contestantId", "fullName applicationId")
      .populate("voterUserId", "fullName email mobile")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await VoteTransaction.countDocuments(query);

    res.status(200).json({
      success: true,
      data: {
        transactions,
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const fetchFinalSelections = async (req, res, next) => {
  try {
    const data = await calculateFinalSelections();
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const handleSelectWildcards = async (req, res, next) => {
  try {
    const { wildcardContestantIds } = req.body;
    const result = await selectWildcards(wildcardContestantIds);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const handleCertifyResults = async (req, res, next) => {
  try {
    const result = await certifyFinalResults();
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const handleUpdateConfig = async (req, res, next) => {
  try {
    const config = await updateSystemConfig(req.body);
    res.status(200).json({
      success: true,
      message: "System configuration updated.",
      data: config,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
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
};
