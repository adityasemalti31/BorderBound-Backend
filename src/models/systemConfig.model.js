const mongoose = require("mongoose");

const systemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "DEFAULT_CONFIG",
      unique: true,
    },

    regPhase1Start: {
      type: Date,
      default: new Date("2026-10-05T00:00:00.000Z"),
    },

    regPhase2Start: {
      type: Date,
      default: new Date("2026-10-20T00:00:00.000Z"),
    },

    regEnd: {
      type: Date,
      default: new Date("2026-11-05T23:59:59.999Z"),
    },

    votingStart: {
      type: Date,
      default: new Date("2026-10-15T00:00:00.000Z"),
    },

    votingEnd: {
      type: Date,
      default: new Date("2026-11-15T23:59:59.999Z"),
    },

    regFeePhase1: {
      type: Number,
      default: 499,
    },

    regFeePhase2: {
      type: Number,
      default: 1499,
    },

    voteUnitPrice: {
      type: Number,
      default: 5, // ₹5 = 1 Vote
    },

    registrationStatusOverride: {
      type: String,
      enum: ["auto", "force_open", "force_closed"],
      default: "auto",
    },

    votingStatusOverride: {
      type: String,
      enum: ["auto", "force_open", "force_closed"],
      default: "auto",
    },

    leaderboardFrozen: {
      type: Boolean,
      default: false,
    },

    isFinalized: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("SystemConfig", systemConfigSchema);
