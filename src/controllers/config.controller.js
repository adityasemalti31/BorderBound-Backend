const SystemConfig = require("../models/systemConfig.model");
const { getRegistrationFeeInfo, getVotingStatusInfo } = require("../utils/dateUtils");

const fetchPublicConfig = async (req, res, next) => {
  try {
    let config = await SystemConfig.findOne({ key: "DEFAULT_CONFIG" });
    if (!config) {
      config = await SystemConfig.create({ key: "DEFAULT_CONFIG" });
    }

    const regInfo = getRegistrationFeeInfo(new Date(), config);
    const votingInfo = getVotingStatusInfo(new Date(), config);

    res.status(200).json({
      success: true,
      data: {
        registration: regInfo,
        voting: votingInfo,
        config: {
          regPhase1Start: config.regPhase1Start,
          regPhase2Start: config.regPhase2Start,
          regEnd: config.regEnd,
          votingStart: config.votingStart,
          votingEnd: config.votingEnd,
          regFeePhase1: config.regFeePhase1,
          regFeePhase2: config.regFeePhase2,
          voteUnitPrice: config.voteUnitPrice,
          isFinalized: config.isFinalized,
        },
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

module.exports = {
  fetchPublicConfig,
};
