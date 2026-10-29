const cron = require("node-cron");
const Payment = require("../models/payment.model");
const { verifyPayUPaymentWithServer } = require("./payment.service");
const { verifyAndSyncVotePayment } = require("./voting.service");
const { verifyAndSyncRegistrationPayment } = require("./contestant.service");

// Record server startup timestamp so we strictly only monitor NEW transactions going forward
const SYSTEM_START_TIME = new Date();
let isReconciling = false;

/**
 * Reconciles ONLY NEW transactions created from now onwards that are stuck in "created"
 * Never touches or modifies any historical/past records.
 */
const reconcileRecentPayments = async () => {
  if (isReconciling) return;
  isReconciling = true;

  try {
    const now = Date.now();
    // Only check transactions at least 2 minutes old to allow active checkout in-flight
    const minAge = new Date(now - 2 * 60 * 1000);

    // Strictly check ONLY transactions created after this server instance started
    const pendingPayments = await Payment.find({
      status: "created",
      createdAt: { $gte: SYSTEM_START_TIME, $lte: minAge },
    })
      .sort({ createdAt: -1 })
      .limit(20);

    for (const payment of pendingPayments) {
      try {
        const serverCheck = await verifyPayUPaymentWithServer(payment.txnid);

        if (serverCheck.verified) {
          if (payment.type === "voting") {
            await verifyAndSyncVotePayment(payment.txnid);
          } else if (payment.type === "registration") {
            await verifyAndSyncRegistrationPayment(payment.txnid);
          }
          console.log(`[Auto-Reconcile] ✓ Successfully verified and credited missed payment: ${payment.txnid}`);
        } else {
          const status = String(serverCheck.status || "").toLowerCase();
          const unmapped = String(serverCheck.raw?.unmappedstatus || "").toLowerCase();

          if (
            status === "failure" ||
            status === "failed" ||
            ["bounced", "dropped", "failed", "usercancelled"].includes(unmapped)
          ) {
            payment.status = "failed";
            payment.rawResponse = serverCheck.raw || { status: "failure" };
            await payment.save();
          }
        }
      } catch (err) {
        console.error(`[Auto-Reconcile] Error checking ${payment.txnid}:`, err.message);
      }
    }
  } catch (err) {
    console.error("[Auto-Reconcile] Error in reconciliation cycle:", err.message);
  } finally {
    isReconciling = false;
  }
};

/**
 * Starts the safe, forward-only payment reconciliation cron.
 * Runs every 3 minutes.
 */
const startPaymentReconciliationCron = () => {
  cron.schedule("*/3 * * * *", async () => {
    await reconcileRecentPayments();
  });
  console.log("✓ Forward-only payment watcher active (Monitoring new transactions every 3 minutes).");
};

module.exports = {
  startPaymentReconciliationCron,
};
