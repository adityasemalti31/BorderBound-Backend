const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    contestantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ContestantProfile",
      required: true,
    },

    txnid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    mihpayid: {
      type: String,
      default: null,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    type: {
      type: String,
      enum: ["registration"],
      default: "registration",
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
    },

    bankReferenceNumber: {
      type: String,
      default: null,
    },

    rawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    ipAddress: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Payment", paymentSchema);