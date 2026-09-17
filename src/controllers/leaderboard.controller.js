const { getLiveLeaderboard } = require("../services/leaderboard.service");

const fetchLeaderboard = async (req, res, next) => {
  try {
    const data = await getLiveLeaderboard(req.query);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  fetchLeaderboard,
};
