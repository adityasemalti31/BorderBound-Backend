const {
  createOrUpdateProfile,
  uploadContestantDoc,
  acceptTerms,
  initiateRegistrationFee,
  verifyRegistrationFee,
  verifyAndSyncRegistrationPayment,
  getMyProfile,
  getPublicContestants,
  getPublicContestantById,
  updateProfilePhoto
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

const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://borderbound.vercel.app";

const isHtmlBrowserRedirect = (req) => {
  const accept = req.headers.accept || "";
  return (
    accept.includes("text/html") ||
    req.headers["sec-fetch-dest"] === "document" ||
    req.headers["sec-fetch-mode"] === "navigate"
  );
};

const handlePayUSuccess = async (req, res) => {
  const isRedirect = isHtmlBrowserRedirect(req);
  const txnid = req.body?.txnid || "";

  try {
    const userId = req.body.udf1 || null;

    if (!txnid) {
      if (isRedirect) {
        return res.redirect(
          `${FRONTEND_URL}/dashboard?payment=failed&reason=Transaction%20ID%20missing`
        );
      }
      return res.status(400).json({
        success: false,
        message: "Transaction ID missing from PayU response.",
      });
    }

    const result = await verifyRegistrationFee(
      userId,
      req.body
    );

    if (isRedirect) {
      return res.redirect(
        `${FRONTEND_URL}/dashboard?payment=success&txnid=${encodeURIComponent(
          txnid
        )}`
      );
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("PayU success callback error:", error);

    if (isRedirect) {
      return res.redirect(
        `${FRONTEND_URL}/dashboard?payment=failed&reason=${encodeURIComponent(
          error.message || "Payment verification failed"
        )}`
      );
    }

    return res.status(400).json({
      success: false,
      message: error.message || "Payment verification failed",
    });
  }
};

const handlePayUFailure = async (req, res) => {
  const isRedirect = isHtmlBrowserRedirect(req);

  try {
    const userId = req.body.udf1 || req.body.userId || null;
    if (userId) {
      await verifyRegistrationFee(userId, req.body).catch(() => {});
    }

    if (isRedirect) {
      return res.redirect(
        `${FRONTEND_URL}/dashboard?payment=failed&reason=Payment%20failed%20or%20cancelled`
      );
    }

    return res.status(400).json({
      success: false,
      message: "PayU payment failed or was cancelled.",
    });
  } catch (error) {
    console.error("PayU failure callback:", error);

    if (isRedirect) {
      return res.redirect(
        `${FRONTEND_URL}/dashboard?payment=failed&reason=${encodeURIComponent(
          error.message || "Payment failed"
        )}`
      );
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const checkRegistrationPaymentStatus = async (req, res) => {
  try {
    const txnid =
      req.params.txnid || req.query.txnid || req.body?.txnid;
    const userId = req.user?._id || null;

    if (!txnid) {
      return res.status(400).json({
        success: false,
        message: "Transaction ID (txnid) is required.",
      });
    }

    const result = await verifyAndSyncRegistrationPayment(txnid, userId);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Check registration payment status error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to check payment status.",
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
const handleUpdateProfilePhoto = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a profile photo.",
      });
    }

   const profile = await updateProfilePhoto(
  req.body.userId,
  req.file.buffer,
  req.file.originalname
);

    return res.status(200).json({
      success: true,
      message: "Profile photo updated successfully.",
      data: {
        profilePhotoUrl: profile.profilePhotoUrl,
      },
    });
  } catch (error) {
    return res.status(400).json({
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
  handleUpdateProfilePhoto,
  checkRegistrationPaymentStatus,
};