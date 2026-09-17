const crypto = require("crypto");
const Payment = require("../models/payment.model");

const PAYU_KEY = process.env.PAYU_KEY;
const PAYU_SALT = process.env.PAYU_SALT;

const PAYU_PAYMENT_URL =
  process.env.PAYU_PAYMENT_URL || "https://test.payu.in/_payment";

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

const generateTxnId = () => {
  return `BBTXN${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
};

const createPayment = async ({
  userId,
  contestantId,
  amount,
  firstname,
  email,
  phone,
  productinfo,
  ipAddress,
  userAgent,
}) => {
  const txnid = generateTxnId();

  const surl = `${process.env.BACKEND_URL}/api/payment/payu/success`;
  const furl = `${process.env.BACKEND_URL}/api/payment/payu/failure`;

  const hash = generateHash({
    txnid,
    amount: amount.toFixed(2),
    productinfo,
    firstname,
    email,
  });

  const payment = await Payment.create({
    userId,
    contestantId,
    txnid,
    amount,
    type: "registration",
    status: "created",
    ipAddress,
    userAgent,
  });

  return {
    paymentId: payment._id,
    txnid,
    key: PAYU_KEY,
    amount: amount.toFixed(2),
    productinfo,
    firstname,
    email,
    phone,
    surl,
    furl,
    hash,
    action: PAYU_PAYMENT_URL,
  };
};

const verifyPayUResponseHash = (data) => {
  const {
    status,
    udf5 = "",
    udf4 = "",
    udf3 = "",
    udf2 = "",
    udf1 = "",
    email,
    firstname,
    productinfo,
    amount,
    txnid,
    hash,
  } = data;

  const reverseHashString =
    `${PAYU_SALT}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|` +
    `${email}|${firstname}|${productinfo}|${amount}|${txnid}|${PAYU_KEY}`;

  const generatedHash = crypto
    .createHash("sha512")
    .update(reverseHashString)
    .digest("hex");

  return generatedHash === hash;
};

module.exports = {
  createPayment,
  verifyPayUResponseHash,
};