const mongoose = require("mongoose");

const ContestantProfile = require("../models/contestant.model");
const SystemConfig = require("../models/systemConfig.model");
const VoteTransaction = require("../models/voteTransaction.model");
const Payment = require("../models/payment.model");

const { getVotingStatusInfo } = require("../utils/dateUtils");
const { createPayment, verifyPayUResponseHash } = require("./payment.service");

const MAX_VOTES_PER_ORDER = 1000;

const getSystemConfig = async () => {
  let config = await SystemConfig.findOne({
    key: "DEFAULT_CONFIG",
  }).lean();

  if (!config) {
    config = await SystemConfig.create({
      key: "DEFAULT_CONFIG",
    });
  }

  return config;
};

const normalizeAmount = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Number(amount.toFixed(2));
};

const normalizeVoteCount = (value) => {
  const votes = Number(value);

  if (!Number.isFinite(votes)) {
    return null;
  }

  if (!Number.isInteger(votes)) {
    return null;
  }

  if (votes < 1 || votes > MAX_VOTES_PER_ORDER) {
    return null;
  }

  return votes;
};

const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(value);
};

const getVotingPackages = async () => {
  const config = await getSystemConfig();

  const votingStatus = getVotingStatusInfo(new Date(), config);

  const unitPrice = normalizeAmount(config.voteUnitPrice || 5);

  if (unitPrice === null || unitPrice <= 0) {
    throw new Error("Invalid voting price configuration.");
  }

  const packageDefinitions = [
    {
      id: "pkg_1",
      votes: 1,
    },
    {
      id: "pkg_10",
      votes: 10,
    },
    {
      id: "pkg_100",
      votes: 100,
    },
    {
      id: "pkg_1000",
      votes: 1000,
    },
  ];

  const packages = packageDefinitions.map((pkg) => {
    const amount = normalizeAmount(pkg.votes * unitPrice);

    return {
      id: pkg.id,
      votes: pkg.votes,
      amount,
      label: `${pkg.votes.toLocaleString(
        "en-IN",
      )} Vote${pkg.votes === 1 ? "" : "s"} (₹${amount.toLocaleString(
        "en-IN",
      )})`,
    };
  });

  return {
    votingStatus,
    unitPrice,
    packages,
  };
};

const createVoteOrder = async ({
  contestantId,
  votesCount,
  voterUserId,
  ipAddress,
  userAgent,
}) => {
  const config = await getSystemConfig();

  const votingStatus = getVotingStatusInfo(new Date(), config);

  if (!votingStatus.isOpen) {
    throw new Error(
      votingStatus.reason || "Public voting is currently closed.",
    );
  }

  if (!contestantId || !isValidObjectId(contestantId)) {
    throw new Error("Invalid contestant ID.");
  }

  const normalizedVotes = normalizeVoteCount(votesCount);

  if (!normalizedVotes) {
    throw new Error(
      `Invalid votes quantity. Must be a whole number between 1 and ${MAX_VOTES_PER_ORDER} votes.`,
    );
  }

  const contestant = await ContestantProfile.findOne({
    _id: contestantId,
    status: "approved",
  })
    .select("_id applicationId fullName userId isLive")
    .lean();

  if (!contestant) {
    throw new Error("Contestant profile not found or not eligible for voting.");
  }

  /*
   * If your business rule is:
   * "Only currently live contestants can receive votes"
   *
   * then uncomment this check:
   *
   * if (!contestant.isLive) {
   *   throw new Error(
   *     "Voting is not currently available for this contestant."
   *   );
   * }
   */

  const unitPrice = normalizeAmount(config.voteUnitPrice || 5);

  if (unitPrice === null || unitPrice <= 0) {
    throw new Error("Invalid voting price configuration.");
  }

  const amount = normalizeAmount(normalizedVotes * unitPrice);

  if (amount === null || amount <= 0) {
    throw new Error("Invalid voting amount.");
  }

  /*
   * Self-voting is intentionally not blocked here because
   * it is a business-rule decision.
   *
   * If self-voting should be prohibited, enable:
   *
   * if (
   *   voterUserId &&
   *   contestant.userId &&
   *   String(voterUserId) === String(contestant.userId)
   * ) {
   *   throw new Error("Contestants cannot vote for themselves.");
   * }
   */

  const orderData = await createPayment({
    userId: voterUserId || null,
    contestantId,
    amount,
    type: "voting",
    votesGenerated: normalizedVotes,
    productinfo: `Borderbound Voting - ${normalizedVotes} Votes for ${contestant.fullName}`,
    firstname: "Voter",
    email: "voter@borderbound.in",
    phone: "9999999999",
    udf1: String(voterUserId || "guest"),
    udf2: "voting",
    udf3: String(contestantId),
    udf4: String(normalizedVotes),
    ipAddress: ipAddress || "",
    userAgent: userAgent || "",
  });

  return {
    ...orderData,
    contestant: {
      id: contestant._id,
      applicationId: contestant.applicationId,
      fullName: contestant.fullName,
    },
    votesCount: normalizedVotes,
    unitPrice,
  };
};

const buildVoteResult = async (contestantId, message, transactionId = null) => {
  const contestant = await ContestantProfile.findById(contestantId)
    .select("_id fullName totalValidVotes rank")
    .lean();

  return {
    success: true,
    message,
    contestant: contestant
      ? {
          id: contestant._id,
          fullName: contestant.fullName,
          totalValidVotes: contestant.totalValidVotes,
          currentRank: contestant.rank,
        }
      : null,
    ...(transactionId
      ? {
          transactionId,
        }
      : {}),
  };
};

const verifyVotePayment = async (paymentData) => {
  const config = await getSystemConfig();

  if (config.isFinalized) {
    throw new Error(
      "Voting period is officially finalized. No new votes can be verified.",
    );
  }

  const { txnid, status, hash, voterIp } = paymentData || {};

  if (!txnid || !status || !hash) {
    throw new Error("Invalid PayU payment response.");
  }

  const isValidHash = verifyPayUResponseHash(paymentData);

  if (!isValidHash) {
    throw new Error("Payment verification failed.");
  }

  /*
   * Always load payment from our own database.
   * Callback UDF values are NOT trusted as source of truth.
   */
  const payment = await Payment.findOne({
    txnid,
    type: "voting",
  });

  if (!payment) {
    throw new Error("Payment transaction not found.");
  }

  if (!payment.contestantId) {
    throw new Error("Payment has no contestant associated with it.");
  }

  if (
    !payment.votesGenerated ||
    !Number.isInteger(Number(payment.votesGenerated)) ||
    payment.votesGenerated < 1
  ) {
    throw new Error("Payment contains an invalid vote quantity.");
  }

  const callbackAmount = normalizeAmount(paymentData.amount);

  const storedAmount = normalizeAmount(payment.amount);

  if (
    callbackAmount === null ||
    storedAmount === null ||
    callbackAmount !== storedAmount
  ) {
    throw new Error("Payment amount verification failed.");
  }

  /*
   * Verify that our stored payment amount also matches
   * the number of votes that were originally purchased.
   *
   * We use the original payment amount, not callback UDF4.
   */
  const storedVotes = Number(payment.votesGenerated);

  const storedVoteUnitPrice = normalizeAmount(config.voteUnitPrice || 5);

  if (storedVoteUnitPrice === null || storedVoteUnitPrice <= 0) {
    throw new Error("Invalid voting price configuration.");
  }

  const expectedStoredAmount = normalizeAmount(
    storedVotes * storedVoteUnitPrice,
  );

  /*
   * Do not reject an already-created payment solely because
   * the admin changed the vote price after the order was created.
   *
   * The Payment.amount is the financial source of truth.
   *
   * We only require:
   *
   * payment.amount === callback.amount
   */

  const normalizedStatus = String(status).trim().toLowerCase();

  if (normalizedStatus !== "success") {
    if (normalizedStatus === "failure" || normalizedStatus === "failed") {
      if (!["success", "failed", "cancelled"].includes(payment.status)) {
        payment.status = "failed";
        payment.rawResponse = paymentData;
        await payment.save();
      }
    }

    throw new Error("Payment was not successful.");
  }

  /*
   * Already successfully processed.
   *
   * IMPORTANT:
   * We do NOT increment votes again.
   */
  if (payment.status === "success") {
    const existingTransaction = await VoteTransaction.findOne({
      paymentId: payment._id,
    })
      .select("_id")
      .lean();

    return buildVoteResult(
      payment.contestantId,
      "Payment already verified.",
      existingTransaction?._id || null,
    );
  }

  if (payment.status === "failed" || payment.status === "cancelled") {
    throw new Error(
      "This payment transaction has already been closed and cannot be verified again.",
    );
  }

  /*
   * MongoDB transaction:
   *
   * 1. Atomically claim the payment
   * 2. Increment contestant votes
   * 3. Create immutable-ish financial audit record
   *
   * If any operation fails, everything rolls back.
   */
  const session = await mongoose.startSession();

  let transactionId = null;

  try {
    await session.withTransaction(
      async () => {
        /*
         * Atomic payment claim.
         *
         * If another callback already claimed this payment,
         * this update will match zero documents.
         */
        const claimedPayment = await Payment.findOneAndUpdate(
          {
            _id: payment._id,
            status: {
              $in: ["created", "pending"],
            },
          },
          {
            $set: {
              status: "success",
              mihpayid: paymentData.mihpayid || null,
              paymentMode: paymentData.mode || null,
              bankReferenceNumber: paymentData.bank_ref_num || null,
              rawResponse: paymentData,
            },
          },
          {
            new: true,
            session,
          },
        );

        if (!claimedPayment) {
          /*
           * Another callback likely processed this payment.
           *
           * Check the transaction inside the same session.
           */
          const existingTransaction = await VoteTransaction.findOne({
            paymentId: payment._id,
          })
            .select("_id")
            .session(session)
            .lean();

          if (existingTransaction) {
            transactionId = existingTransaction._id;
            return;
          }

          throw new Error(
            "Payment is currently being processed. Please do not retry.",
          );
        }

        /*
         * Verify contestant still exists and is approved.
         */
        const contestant = await ContestantProfile.findOne({
          _id: claimedPayment.contestantId,
          status: "approved",
        })
          .select("_id fullName totalValidVotes rank")
          .session(session);

        if (!contestant) {
          throw new Error(
            "Target contestant profile not found or is no longer eligible for voting.",
          );
        }

        /*
         * Finalization is checked again immediately before
         * applying the financial vote allocation.
         */
        const latestConfig = await SystemConfig.findOne({
          key: "DEFAULT_CONFIG",
        })
          .session(session)
          .lean();

        if (latestConfig && latestConfig.isFinalized) {
          throw new Error(
            "Voting period is officially finalized. No new votes can be verified.",
          );
        }

        /*
         * Atomically add the exact number of votes stored
         * in our Payment document.
         */
        const updatedContestant = await ContestantProfile.findOneAndUpdate(
          {
            _id: claimedPayment.contestantId,
            status: "approved",
          },
          {
            $inc: {
              totalValidVotes: Number(claimedPayment.votesGenerated),
            },
            $set: {
              lastVoteReceivedAt: new Date(),
            },
          },
          {
            new: true,
            session,
          },
        );

        if (!updatedContestant) {
          throw new Error("Target contestant profile could not be updated.");
        }

        /*
         * Store COMPLETE financial/audit information.
         */
        const createdTransaction = await VoteTransaction.create(
          [
            {
              contestantId: claimedPayment.contestantId,

              voterUserId: claimedPayment.userId || null,

              voterIp: voterIp || claimedPayment.ipAddress || "0.0.0.0",

              voterUserAgent: claimedPayment.userAgent || null,

              paymentId: claimedPayment._id,

              txnid: claimedPayment.txnid,

              mihpayid: claimedPayment.mihpayid || null,

              votesCount: Number(claimedPayment.votesGenerated),

              votePriceUnit: normalizeAmount(
                Number(claimedPayment.amount) /
                  Number(claimedPayment.votesGenerated),
              ),

              totalAmountPaid: Number(claimedPayment.amount),

              paymentMode: claimedPayment.paymentMode || null,

              bankReferenceNumber: claimedPayment.bankReferenceNumber || null,

              paymentStatus: "success",

              status: "valid",

              payuResponse: paymentData,
            },
          ],
          {
            session,
          },
        );

        transactionId = createdTransaction[0]._id;
      },
      {
        readConcern: {
          level: "snapshot",
        },
        writeConcern: {
          w: "majority",
        },
        maxCommitTimeMS: 10000,
      },
    );
  } catch (error) {
    /*
     * Duplicate-key protection for an extremely rare race.
     *
     * The transaction itself is the primary protection.
     */
    if (error?.code === 11000) {
      const existingTransaction = await VoteTransaction.findOne({
        paymentId: payment._id,
      })
        .select("_id")
        .lean();

      if (existingTransaction) {
        transactionId = existingTransaction._id;

        return buildVoteResult(
          payment.contestantId,
          "Payment already verified.",
          transactionId,
        );
      }
    }

    throw error;
  } finally {
    await session.endSession();
  }

  return buildVoteResult(
    payment.contestantId,
    `Successfully cast ${Number(payment.votesGenerated)} votes!`,
    transactionId,
  );
};

module.exports = {
  getVotingPackages,
  createVoteOrder,
  verifyVotePayment,
};
