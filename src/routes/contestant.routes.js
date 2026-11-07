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
  handleUpdateProfilePhoto,
  checkRegistrationPaymentStatus,editContestantProfileController
} = require("../controllers/contestant.controller");
const { protect } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");


router.patch(
  "/profile/photo",
  upload.single("photo"),
  handleUpdateProfilePhoto
);

// Public endpoints
router.get("/public", fetchPublicContestants);
router.get("/public/:id", fetchPublicContestantById);

// PayU Public Callback Webhooks
router.post("/payu/success", handlePayUSuccess);
router.post("/payu/failure", handlePayUFailure);

// Public payment status check fallback (allows checking by txnid)
router.get("/payment-status/:txnid", checkRegistrationPaymentStatus);
router.post("/verify-status", checkRegistrationPaymentStatus);

// Protected contestant endpoints
router.use(protect);
router.post("/profile", saveProfile);
router.post("/documents", upload.single("file"), uploadDocument);
router.post("/terms", handleAcceptTerms);
router.post("/initiate-payment", initiateRegistrationPayment);
router.post("/pay-fee", initiateRegistrationPayment);

router.get("/my-profile", fetchMyProfile);
router.put(
  "/edit-profile",
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "identityProof", maxCount: 1 },
  ]),
  editContestantProfileController
);
module.exports = router;

