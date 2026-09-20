const express = require("express");
const router = express.Router();
const {
  saveProfile,
  uploadDocument,
  handleAcceptTerms,
  initiateRegistrationPayment,
  handlePayUSuccess,
  handlePayUFailure,
  fetchMyProfile,
  fetchPublicContestants,
  fetchPublicContestantById,
} = require("../controllers/contestant.controller");
const { protect } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");

// Public endpoints
router.get("/public", fetchPublicContestants);
router.get("/public/:id", fetchPublicContestantById);

// PayU Public Callback Webhooks
router.post("/payu/success", handlePayUSuccess);
router.post("/payu/failure", handlePayUFailure);

// Protected contestant endpoints
router.use(protect);
router.post("/profile", saveProfile);
router.post("/documents", upload.single("file"), uploadDocument);
router.post("/terms", handleAcceptTerms);
router.post("/initiate-payment", initiateRegistrationPayment);
router.post("/pay-fee", initiateRegistrationPayment);

router.get("/my-profile", fetchMyProfile);

module.exports = router;

