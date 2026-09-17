const mongoose = require("mongoose");

const voteTransactionSchema = new mongoose.Schema(
  {
    contestantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContestantProfile",
      required: true,
      index: true,
    },

    voterUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    voterIp: {
      type: String,
      required: true,
      index: true,
    },

    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      unique: true,
    },

    votesCount: {
      type: Number,
      required: true,
    },

    votePriceUnit: {
      type: Number,
      default: 5,
    },

    totalAmountPaid: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      enum: ["valid", "invalidated", "flagged"],
      default: "valid",
      index: true,
    },

    invalidatedAt: {
      type: Date,
      default: null,
    },

    invalidatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    invalidatedReason: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("VoteTransaction", voteTransactionSchema);
