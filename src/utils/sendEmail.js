const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  requireTLS: true,

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    console.log("Connecting to Gmail SMTP...");

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || `"The BorderBound" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    console.log("Email sent successfully:", info.messageId);

    return info;
  } catch (error) {
    console.error("SMTP ERROR:", error);
    throw error;
  }
};

module.exports = sendEmail;