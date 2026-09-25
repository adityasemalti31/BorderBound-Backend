const mongoose = require("mongoose");

const contestantProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    applicationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },

    // Step 2 Info
    fullName: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    permanentAddress: { type: String, required: true, trim: true },
    occupation: { type: String, default: "" },
    education: { type: String, default: "" },
    bio: { type: String, default: "" },

    socialMedia: {
      instagram: { type: String, default: "" },
      facebook: { type: String, default: "" },
      youtube: { type: String, default: "" },
      twitter: { type: String, default: "" },
    },

    emergencyContact: {
      name: { type: String, required: true },
      relation: { type: String, required: true },
      phone: { type: String, required: true },
    },

    // Step 3 Documents & Photo
    profilePhotoUrl: { type: String, default: "" },
    documents: [
      {
        docType: {
          type: String,
          enum: [
            "identity_proof",
            "dob_proof",
            "address_proof",
            "photograph",
            "other",
          ],
          required: true,
        },
        url: { type: String, required: true },
        publicId: { type: String, default: "" },
        status: {
          type: String,
          enum: ["pending", "verified", "rejected"],
          default: "pending",
        },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // Step 4 Terms
    termsAccepted: { type: Boolean, default: false },
    termsAcceptedAt: { type: Date, default: null },

    // Step 5 Fee Payment
    registrationFeePaid: { type: Boolean, default: false },
    registrationFeeAmount: { type: Number, default: 0 },
    registrationFeePhase: { type: String, default: "" },
    registrationPaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null,
    },

    // Step 6 Review & Approval
    status: {
      type: String,
      enum: [
        "draft",
        "pending_payment",
        "pending_review",
        "approved",
        "rejected",
      ],
      default: "draft",
    },
    rejectionReason: { type: String, default: "" },
    isLive: { type: Boolean, default: false, index: true },

    // Step 7, 8, 9 Voting & Leaderboard Metrics
    totalValidVotes: { type: Number, default: 0, index: true },
    rank: { type: Number, default: 0, index: true },
    previousRank: { type: Number, default: 0 },
    lastVoteReceivedAt: { type: Date, default: null },

    // Step 12, 13 Qualification
    selectionStatus: {
      type: String,
      enum: ["none", "top_32", "top_50", "wildcard", "eliminated"],
      default: "none",
      index: true,
    },
    isWildCardSelected: { type: Boolean, default: false },
    certifiedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

contestantProfileSchema.index({ totalValidVotes: -1, updatedAt: 1 });

module.exports = mongoose.model("ContestantProfile", contestantProfileSchema);
