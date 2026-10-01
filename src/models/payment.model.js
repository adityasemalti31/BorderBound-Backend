
const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },

    contestantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContestantProfile",
      required: true,
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
      index: true,
      trim: true,
      maxlength: 100,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    votesGenerated: {
      type: Number,
      default: 0,
      min: 0,
    },

    type: {
      type: String,
      enum: ["registration", "voting"],
      default: "registration",
      index: true,
    },

    status: {
      type: String,
      enum: [
        "created",
        "pending",
        "success",
        "failed",
        "cancelled",
      ],
      default: "created",
      index: true,
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

    rawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    ipAddress: {
      type: String,
      default: null,
      trim: true,
      maxlength: 100,
    },

    userAgent: {
      type: String,
      default: null,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

// Useful for payment history / admin queries
paymentSchema.index({
  contestantId: 1,
  status: 1,
  type: 1,
});

paymentSchema.index({
  userId: 1,
  status: 1,
  type: 1,
});

module.exports = mongoose.model(
  "Payment",
  paymentSchema
);
