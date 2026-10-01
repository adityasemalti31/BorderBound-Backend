const crypto = require("crypto");
const Payment = require("../models/payment.model");

const PAYU_KEY = process.env.PAYU_KEY;
const PAYU_SALT = process.env.PAYU_SALT;

const PAYU_PAYMENT_URL =
  process.env.PAYU_PAYMENT_URL || "https://secure.payu.in/_payment";

const BACKEND_URL =
  process.env.BACKEND_URL || "https://borderbound-backend.onrender.com";

if (!PAYU_KEY || !PAYU_SALT) {
  throw new Error(
    "PAYU_KEY and PAYU_SALT must be configured in environment variables.",
  );
}

if (!BACKEND_URL || !/^https?:\/\//i.test(BACKEND_URL)) {
  throw new Error("BACKEND_URL must be a valid HTTP/HTTPS URL.");
}

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const normalizeAmount = (amount) => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Invalid payment amount.");
  }

  return numericAmount.toFixed(2);
};

const normalizeString = (value, maxLength = 500) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim().slice(0, maxLength);
};

const safeHashCompare = (expectedHash, receivedHash) => {
  if (typeof expectedHash !== "string" || typeof receivedHash !== "string") {
    return false;
  }

  const expected = Buffer.from(expectedHash.toLowerCase(), "utf8");

  const received = Buffer.from(receivedHash.toLowerCase(), "utf8");

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
};

// --------------------------------------------------
// PayU Hash Generation
// --------------------------------------------------

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
  const normalizedTxnId = normalizeString(txnid, 100);

  const normalizedAmount = normalizeAmount(amount);

  const normalizedProductInfo = normalizeString(productinfo, 255);

  const normalizedFirstname = normalizeString(firstname, 150);

  const normalizedEmail = normalizeString(email, 255);

  const normalizedUdf1 = normalizeString(udf1, 255);

  const normalizedUdf2 = normalizeString(udf2, 255);

  const normalizedUdf3 = normalizeString(udf3, 255);

  const normalizedUdf4 = normalizeString(udf4, 255);

  const normalizedUdf5 = normalizeString(udf5, 255);

  const hashString =
    `${PAYU_KEY}|${normalizedTxnId}|${normalizedAmount}|${normalizedProductInfo}|${normalizedFirstname}|${normalizedEmail}|` +
    `${normalizedUdf1}|${normalizedUdf2}|${normalizedUdf3}|${normalizedUdf4}|${normalizedUdf5}||||||${PAYU_SALT}`;

  return crypto.createHash("sha512").update(hashString, "utf8").digest("hex");
};

// --------------------------------------------------
// Transaction ID
// --------------------------------------------------

const generateTxnId = (prefix = "BBTXN") => {
  const randomPart = crypto.randomBytes(12).toString("hex");

  return `${prefix}${Date.now()}${randomPart}`;
};

// --------------------------------------------------
// Create Payment
// --------------------------------------------------

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
  if (!contestantId) {
    throw new Error("Contestant ID is required.");
  }

  if (type !== "registration" && type !== "voting") {
    throw new Error("Invalid payment type.");
  }

  const formattedAmount = normalizeAmount(amount);

  const numericAmount = Number(formattedAmount);

  const numericVotes = Number(votesGenerated || 0);

  if (!Number.isFinite(numericVotes) || numericVotes < 0) {
    throw new Error("Invalid votes generated value.");
  }

  const prefix = type === "voting" ? "BBVOTE" : "BBTXN";

  const txnid = generateTxnId(prefix);

  const defaultSurl =
    type === "voting"
      ? `${BACKEND_URL}/api/voting/payu/success`
      : `${BACKEND_URL}/api/contestants/payu/success`;

  const defaultFurl =
    type === "voting"
      ? `${BACKEND_URL}/api/voting/payu/failure`
      : `${BACKEND_URL}/api/contestants/payu/failure`;

  const surl = customSurl || defaultSurl;

  const furl = customFurl || defaultFurl;

  const normalizedUdf1 = normalizeString(udf1, 255);

  const normalizedUdf2 = normalizeString(udf2, 255);

  const normalizedUdf3 = normalizeString(udf3, 255);

  const normalizedUdf4 = normalizeString(udf4, 255);

  const normalizedUdf5 = normalizeString(udf5, 255);

  const normalizedProductInfo = normalizeString(productinfo, 255);

  const normalizedFirstname = normalizeString(firstname, 150);

  const normalizedEmail = normalizeString(email, 255);

  const normalizedPhone = normalizeString(phone, 50);

  const hash = generateHash({
    txnid,
    amount: formattedAmount,
    productinfo: normalizedProductInfo,
    firstname: normalizedFirstname,
    email: normalizedEmail,
    udf1: normalizedUdf1,
    udf2: normalizedUdf2,
    udf3: normalizedUdf3,
    udf4: normalizedUdf4,
    udf5: normalizedUdf5,
  });

  let payment;

  try {
    payment = await Payment.create({
      userId: userId || null,
      contestantId,
      txnid,
      amount: numericAmount,
      votesGenerated: numericVotes,
      type,
      status: "created",
      ipAddress: normalizeString(ipAddress, 100) || null,
      userAgent: normalizeString(userAgent, 1000) || null,
    });
  } catch (error) {
    // Extremely unlikely because txnid uses
    // cryptographically secure randomness.
    // Retry once on duplicate transaction ID.
    if (error?.code === 11000 && error?.keyPattern?.txnid) {
      const retryTxnId = generateTxnId(prefix);

      const retryHash = generateHash({
        txnid: retryTxnId,
        amount: formattedAmount,
        productinfo: normalizedProductInfo,
        firstname: normalizedFirstname,
        email: normalizedEmail,
        udf1: normalizedUdf1,
        udf2: normalizedUdf2,
        udf3: normalizedUdf3,
        udf4: normalizedUdf4,
        udf5: normalizedUdf5,
      });

      payment = await Payment.create({
        userId: userId || null,
        contestantId,
        txnid: retryTxnId,
        amount: numericAmount,
        votesGenerated: numericVotes,
        type,
        status: "created",
        ipAddress: normalizeString(ipAddress, 100) || null,
        userAgent: normalizeString(userAgent, 1000) || null,
      });

      return {
        paymentId: payment._id,
        txnid: retryTxnId,
        key: PAYU_KEY,
        amount: formattedAmount,
        productinfo: normalizedProductInfo,
        firstname: normalizedFirstname,
        email: normalizedEmail,
        phone: normalizedPhone,
        udf1: normalizedUdf1,
        udf2: normalizedUdf2,
        udf3: normalizedUdf3,
        udf4: normalizedUdf4,
        udf5: normalizedUdf5,
        surl,
        furl,
        hash: retryHash,
        action: PAYU_PAYMENT_URL,
      };
    }

    throw error;
  }

  return {
    paymentId: payment._id,
    txnid,
    key: PAYU_KEY,
    amount: formattedAmount,
    productinfo: normalizedProductInfo,
    firstname: normalizedFirstname,
    email: normalizedEmail,
    phone: normalizedPhone,
    udf1: normalizedUdf1,
    udf2: normalizedUdf2,
    udf3: normalizedUdf3,
    udf4: normalizedUdf4,
    udf5: normalizedUdf5,
    surl,
    furl,
    hash,
    action: PAYU_PAYMENT_URL,
  };
};

// --------------------------------------------------
// Verify PayU Response Hash
// --------------------------------------------------

const verifyPayUResponseHash = (data) => {
  if (!data || typeof data !== "object") {
    return false;
  }

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

  if (
    !status ||
    !txnid ||
    !hash ||
    amount === "" ||
    amount === null ||
    amount === undefined
  ) {
    return false;
  }

  let formattedAmount;

  try {
    formattedAmount = normalizeAmount(amount);
  } catch {
    return false;
  }

  const normalizedStatus = normalizeString(status, 100);

  const normalizedTxnId = normalizeString(txnid, 100);

  const normalizedUdf5 = normalizeString(udf5, 255);

  const normalizedUdf4 = normalizeString(udf4, 255);

  const normalizedUdf3 = normalizeString(udf3, 255);

  const normalizedUdf2 = normalizeString(udf2, 255);

  const normalizedUdf1 = normalizeString(udf1, 255);

  const normalizedEmail = normalizeString(email, 255);

  const normalizedFirstname = normalizeString(firstname, 150);

  const normalizedProductInfo = normalizeString(productinfo, 255);

  const reverseHashString =
    `${PAYU_SALT}|${normalizedStatus}||||||${normalizedUdf5}|${normalizedUdf4}|${normalizedUdf3}|${normalizedUdf2}|${normalizedUdf1}|` +
    `${normalizedEmail}|${normalizedFirstname}|${normalizedProductInfo}|${formattedAmount}|${normalizedTxnId}|${PAYU_KEY}`;

  const generatedHash = crypto
    .createHash("sha512")
    .update(reverseHashString, "utf8")
    .digest("hex");

  return safeHashCompare(generatedHash, hash);
};

module.exports = {
  createPayment,
  verifyPayUResponseHash,
};
