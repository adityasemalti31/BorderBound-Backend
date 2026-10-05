const sendEmail = require("./sendEmail");

const sendCandidateRegistrationSuccessEmail = async ({
  to,
  fullName,
  applicationId,
}) => {
  return sendEmail({
    to,
    subject: "THE BORDERBOUND — Candidate Registration Successful",
    html: `
      <div style="margin:0;padding:40px 20px;background:#f5f5f5;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:40px;">

          <h1 style="margin:0 0 20px;font-size:28px;">
            REGISTRATION SUCCESSFUL
          </h1>

          <p>Hi ${fullName},</p>

          <p>
            Congratulations! Your registration as a candidate for
            <strong>THE BORDERBOUND</strong> has been successfully completed.
          </p>

          <p>
            Your application ID:
            <strong>${applicationId}</strong>
          </p>

          <p>
            We have successfully received your registration payment.
            Your application is now under review.
          </p>

          <p>
            We will notify you through your registered email regarding
            the next stage of the selection process.
          </p>

          <br />

          <p>
            <strong>THE BORDERBOUND</strong><br />
            CROSS THE BORDER
          </p>

        </div>
      </div>
    `,
  });
};

const sendCandidatePaymentReminderEmail = async ({
  to,
  fullName,
  applicationId,
  paymentUrl,
}) => {
  return sendEmail({
    to,
    subject: "THE BORDERBOUND — Complete Your Candidate Registration",
    html: `
      <div style="margin:0;padding:40px 20px;background:#f5f5f5;font-family:Arial,sans-serif;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;padding:40px;">

          <h1 style="margin:0 0 20px;font-size:28px;">
            COMPLETE YOUR REGISTRATION
          </h1>

          <p>Hi ${fullName},</p>

          <p>
            You have started your candidate registration for
            <strong>THE BORDERBOUND</strong>, but your registration
            payment is still pending.
          </p>

          <p>
            Application ID:
            <strong>${applicationId}</strong>
          </p>

          <p>
            Your candidate registration will only be completed after
            the required registration payment is successfully made.
          </p>

          <div style="margin:30px 0;">
            <a
              href="${paymentUrl}"
              style="
                display:inline-block;
                padding:14px 24px;
                background:#000000;
                color:#ffffff;
                text-decoration:none;
                font-weight:bold;
              "
            >
              COMPLETE REGISTRATION
            </a>
          </div>

          <p>
            If you have already completed the payment, please ignore
            this email.
          </p>

          <br />

          <p>
            <strong>THE BORDERBOUND</strong><br />
            CROSS THE BORDER
          </p>

        </div>
      </div>
    `,
  });
};

module.exports = {
  sendCandidateRegistrationSuccessEmail,
  sendCandidatePaymentReminderEmail,
};