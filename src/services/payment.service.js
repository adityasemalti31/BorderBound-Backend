const crypto = require("crypto");
const Payment = require("../models/payment.model");

const PAYU_KEY = process.env.PAYU_KEY || "mhrxT6";
const PAYU_SALT = process.env.PAYU_SALT || "hfCyM3KlcIU3CVCbXaeFHEoqeYJef7bg";

const PAYU_PAYMENT_URL =
  process.env.PAYU_PAYMENT_URL || "https://test.payu.in/_payment";

const BACKEND_URL = process.env.BACKEND_URL || "https://borderbound-backend.onrender.com";

const generateHash = ({
  txnid,
  amount,
  productinfo,
  firstname,
  email,
  udf1 = "",
  udf2 = "",
  udf3 = "",
  udf4 = "",
  udf5 = "",
}) => {
  const hashString =
    `${PAYU_KEY}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|` +
    `${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${PAYU_SALT}`;

  return crypto
    .createHash("sha512")
    .update(hashString)
    .digest("hex");
};

const generateTxnId = (prefix = "BBTXN") => {
  return `${prefix}${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
};

const createPayment = async ({
  userId,
  contestantId,
  amount,
  firstname = "User",
  email = "user@borderbound.in",
  phone = "9999999999",
  productinfo = "Borderbound Payment",
  type = "registration",
  votesGenerated = 0,
  udf1 = "",
  udf2 = "",
  udf3 = "",
  udf4 = "",
  udf5 = "",
  customSurl = null,
  customFurl = null,
  ipAddress = "",
  userAgent = "",
}) => {
  const prefix = type === "voting" ? "BBVOTE" : "BBTXN";
  const txnid = generateTxnId(prefix);

  const defaultSurl = type === "voting" 
    ? `${BACKEND_URL}/api/voting/payu/success` 
    : `${BACKEND_URL}/api/contestants/payu/success`;
  const defaultFurl = type === "voting" 
    ? `${BACKEND_URL}/api/voting/payu/failure` 
    : `${BACKEND_URL}/api/contestants/payu/failure`;

  const surl = customSurl || defaultSurl;
  const furl = customFurl || defaultFurl;

  const formattedAmount = Number(amount).toFixed(2);

  const hash = generateHash({
    txnid,
    amount: formattedAmount,
    productinfo,
    firstname,
    email,
    udf1: String(udf1 || ""),
    udf2: String(udf2 || ""),
    udf3: String(udf3 || ""),
    udf4: String(udf4 || ""),
    udf5: String(udf5 || ""),
  });

  const payment = await Payment.create({
    userId: userId || null,
    contestantId: contestantId || null,
    txnid,
    amount: Number(amount),
    votesGenerated: Number(votesGenerated || 0),
    type,
    status: "created",
    ipAddress,
    userAgent,
  });

  return {
    paymentId: payment._id,
    txnid,
    key: PAYU_KEY,
    amount: formattedAmount,
    productinfo,
    firstname,
    email,
    phone,
    udf1: String(udf1 || ""),
    udf2: String(udf2 || ""),
    udf3: String(udf3 || ""),
    udf4: String(udf4 || ""),
    udf5: String(udf5 || ""),
    surl,
    furl,
    hash,
    action: PAYU_PAYMENT_URL,
  };
};

const verifyPayUResponseHash = (data) => {
  const {
    status = "",
    udf5 = "",
    udf4 = "",
    udf3 = "",
    udf2 = "",
    udf1 = "",
    email = "",
    firstname = "",
    productinfo = "",
    amount = "",
    txnid = "",
    hash = "",
  } = data;

  const formattedAmount = Number(amount).toFixed(2);

  const reverseHashString =
    `${PAYU_SALT}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|` +
    `${email}|${firstname}|${productinfo}|${formattedAmount}|${txnid}|${PAYU_KEY}`;

  const generatedHash = crypto
    .createHash("sha512")
    .update(reverseHashString)
    .digest("hex");

  return generatedHash.toLowerCase() === (hash || "").toLowerCase();
};

module.exports = {
  createPayment,
  verifyPayUResponseHash,
};