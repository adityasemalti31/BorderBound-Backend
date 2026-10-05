const cron = require("node-cron");
const {
  sendPendingPaymentReminders,
} = require("../services/contestant.service");

const startCandidateReminderJob = () => {
  cron.schedule(
    "0 10 * * *",
    async () => {
      console.log(
        "Running candidate payment reminder job..."
      );

      try {
        const count =
          await sendPendingPaymentReminders();

        console.log(
          `Candidate reminder job completed. Emails processed: ${count}`
        );
      } catch (error) {
        console.error(
          "Candidate reminder job failed:",
          error
        );
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  console.log(
    "Candidate payment reminder cron started."
  );
};

module.exports = startCandidateReminderJob;