const dns = require("dns");
const nodemailer = require("nodemailer");

dns.setDefaultResultOrder("ipv4first");

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: true,
    family: 4,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
  });
};

const sendEmail = async ({ to, subject, html }) => {
  try {
    console.log("Connecting to SMTP server...");

    const transporter = createTransporter();

    const fromHeader = process.env.MAIL_FROM
      ? `${process.env.MAIL_FROM} <${process.env.SMTP_USER}>`
      : `"The BorderBound" <${process.env.SMTP_USER}>`;

    const info = await transporter.sendMail({
      from: fromHeader,
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