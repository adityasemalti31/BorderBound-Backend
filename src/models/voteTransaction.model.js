
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
      trim: true,
      maxlength: 100,
      index: true,
    },

    voterUserAgent: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },

    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: true,
      unique: true,
      index: true,
    },

    txnid: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      maxlength: 100,
    },

    mihpayid: {
      type: String,
      default: null,
      trim: true,
      maxlength: 150,
      index: true,
    },

    votesCount: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "votesCount must be an integer.",
      },
    },

    votePriceUnit: {
      type: Number,
      required: true,
      min: 0,
    },

    totalAmountPaid: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMode: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    bankReferenceNumber: {
      type: String,
      default: null,
      trim: true,
      maxlength: 150,
    },

    paymentStatus: {
      type: String,
      default: "success",
      enum: ["success"],
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
      trim: true,
      maxlength: 1000,
    },

    payuResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

voteTransactionSchema.index({
  contestantId: 1,
  status: 1,
  createdAt: -1,
});

voteTransactionSchema.index({
  voterUserId: 1,
  status: 1,
  createdAt: -1,
});

voteTransactionSchema.index({
  createdAt: -1,
});

module.exports = mongoose.model(
  "VoteTransaction",
  voteTransactionSchema
);
