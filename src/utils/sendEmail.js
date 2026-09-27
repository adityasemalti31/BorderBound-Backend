const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "192.178.158.108",
  port: 587,
  secure: false,
  requireTLS: true,

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },

  tls: {
    servername: "smtp.gmail.com",
  },

  connectionTimeout: 60000,
  greetingTimeout: 60000,
  socketTimeout: 60000,
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    console.log("Sending email...");
    console.log("TO:", to);
    console.log("FROM:", process.env.MAIL_FROM);

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html,
    });

    console.log("SMTP response:", info.response);
    console.log("Message ID:", info.messageId);

    return info;
  } catch (error) {
    console.error("SMTP ERROR:", error);
    throw error;
  }
};

module.exports = sendEmail;