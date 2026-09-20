const {
  createOrUpdateProfile,
  uploadContestantDoc,
  acceptTerms,
  initiateRegistrationFee,
  verifyRegistrationFee,
  getMyProfile,
  getPublicContestants,
  getPublicContestantById,
} = require("../services/contestant.service");

const saveProfile = async (req, res) => {
  try {
    const profile = await createOrUpdateProfile(
      req.user._id,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Contestant profile saved successfully.",
      data: profile,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const uploadDocument = async (req, res) => {
  try {
    const { docType } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded.",
      });
    }

    if (!docType) {
      return res.status(400).json({
        success: false,
        message: "docType is required.",
      });
    }

    const profile = await uploadContestantDoc(
      req.user._id,
      docType,
      req.file.buffer,
      req.file.originalname
    );

    res.status(200).json({
      success: true,
      message: `${docType} uploaded successfully.`,
      data: profile,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const handleAcceptTerms = async (req, res) => {
  try {
    const profile = await acceptTerms(req.user._id);

    res.status(200).json({
      success: true,
      message: "Terms and conditions accepted successfully.",
      data: profile,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const initiateRegistrationPayment = async (req, res) => {
  try {
    const ipAddress =
      req.headers["x-forwarded-for"] ||
      req.socket.remoteAddress ||
      "";

    const userAgent =
      req.headers["user-agent"] || "";

    const paymentData =
      await initiateRegistrationFee(
        req.user._id,
        ipAddress,
        userAgent
      );

    res.status(200).json({
      success: true,
      message: "Registration payment initiated successfully.",
      data: paymentData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const handlePayUSuccess = async (req, res) => {
  try {
    const userId = req.body.udf1;

    if (!userId) {
      if (req.headers.accept?.includes("text/html") || req.method === "POST") {
        return res.redirect(`${FRONTEND_URL}/dashboard?payment=failed&reason=User%20ID%20missing`);
      }
      return res.status(400).json({
        success: false,
        message: "User identification missing.",
      });
    }

    const result = await verifyRegistrationFee(
      userId,
      req.body
    );

    if (req.headers.accept?.includes("text/html") || req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
      return res.redirect(`${FRONTEND_URL}/dashboard?payment=success&txnid=${req.body.txnid || ""}`);
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("PayU success callback error:", error);

    if (req.headers.accept?.includes("text/html") || req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
      return res.redirect(`${FRONTEND_URL}/dashboard?payment=failed&reason=${encodeURIComponent(error.message)}`);
    }

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const handlePayUFailure = async (req, res) => {
  try {
    const userId = req.body.udf1 || req.body.userId;
    if (userId) {
      await verifyRegistrationFee(userId, req.body).catch(() => {});
    }

    if (req.headers.accept?.includes("text/html") || req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
      return res.redirect(`${FRONTEND_URL}/dashboard?payment=failed&reason=Payment%20failed`);
    }

    res.status(400).json({
      success: false,
      message: "PayU payment failed or was cancelled.",
    });
  } catch (error) {
    console.error("PayU failure callback:", error);

    if (req.headers.accept?.includes("text/html") || req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
      return res.redirect(`${FRONTEND_URL}/dashboard?payment=failed&reason=${encodeURIComponent(error.message)}`);
    }

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const fetchMyProfile = async (req, res) => {
  try {
    const profile = await getMyProfile(req.user._id);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const fetchPublicContestants = async (req, res) => {
  try {
    const result = await getPublicContestants(req.query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const fetchPublicContestantById = async (req, res) => {
  try {
    const profile = await getPublicContestantById(
      req.params.id
    );

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  saveProfile,
  uploadDocument,
  handleAcceptTerms,
  initiateRegistrationPayment,
  handlePayUSuccess,
  handlePayUFailure,
  fetchMyProfile,
  fetchPublicContestants,
  fetchPublicContestantById,
};