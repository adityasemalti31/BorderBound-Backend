const ContestantProfile = require("../models/contestant.model");
const SystemConfig = require("../models/systemConfig.model");
const VoteTransaction = require("../models/voteTransaction.model");

// Recalculate and update rank positions for all live approved contestants
const refreshLeaderboardRanks = async () => {
  const contestants = await ContestantProfile.find({ isLive: true, status: "approved" })
    .sort({ totalValidVotes: -1, lastVoteReceivedAt: 1, createdAt: 1 });

  const bulkOps = contestants.map((c, idx) => {
    const newRank = idx + 1;
    // Previous rank stored; if 0, initialize to newRank
    const prevRank = c.rank > 0 ? c.rank : newRank;
    return {
      updateOne: {
        filter: { _id: c._id },
        update: {
          $set: {
            rank: newRank,
            previousRank: prevRank,
          },
        },
      },
    };
  });

  if (bulkOps.length > 0) {
    await ContestantProfile.bulkWrite(bulkOps);
  }

  return contestants.length;
};

// Step 7 & 9: Live Voting Leaderboard API
const getLiveLeaderboard = async ({ page = 1, limit = 50, search, city }) => {
  // Ensure ranks are updated
  await refreshLeaderboardRanks();

  const query = { isLive: true, status: "approved" };

  if (search) {
    query.$or = [
      { fullName: new RegExp(search, "i") },
      { applicationId: new RegExp(search, "i") },
    ];
  }

  if (city) {
    query.city = new RegExp(city, "i");
  }

  const skip = (page - 1) * limit;

  const contestants = await ContestantProfile.find(query)
    .sort({ totalValidVotes: -1, updatedAt: 1 })
    .skip(skip)
    .limit(limit)
    .select("applicationId fullName profilePhotoUrl city state age totalValidVotes rank previousRank lastVoteReceivedAt selectionStatus isWildCardSelected");

  const totalCount = await ContestantProfile.countDocuments(query);

  const formattedLeaderboard = contestants.map((c) => {
    const rankDiff = c.previousRank && c.previousRank > 0 ? c.previousRank - c.rank : 0;
    let movement = "SAME";
    if (rankDiff > 0) movement = "UP";
    else if (rankDiff < 0) movement = "DOWN";

    return {
      id: c._id,
      applicationId: c.applicationId,
      fullName: c.fullName,
      profilePhotoUrl: c.profilePhotoUrl,
      city: c.city,
      state: c.state,
      age: c.age,
      totalValidVotes: c.totalValidVotes,
      rank: c.rank,
      previousRank: c.previousRank,
      movement,
      rankChange: Math.abs(rankDiff),
      selectionStatus: c.selectionStatus,
      isWildCardSelected: c.isWildCardSelected,
    };
  });

  const totalValidVotesCastResult = await ContestantProfile.aggregate([
    { $match: { isLive: true, status: "approved" } },
    { $group: { _id: null, totalVotes: { $sum: "$totalValidVotes" } } },
  ]);

  const totalVotesCast = totalValidVotesCastResult[0]?.totalVotes || 0;

  return {
    leaderboard: formattedLeaderboard,
    pagination: {
      totalContestants: totalCount,
      page: Number(page),
      pages: Math.ceil(totalCount / limit),
      limit: Number(limit),
    },
    meta: {
      totalVotesCast,
      lastUpdated: new Date(),
    },
  };
};

module.exports = {
  refreshLeaderboardRanks,
  getLiveLeaderboard,
};
