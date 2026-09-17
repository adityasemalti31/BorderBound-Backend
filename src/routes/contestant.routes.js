const express = require("express");
const router = express.Router();
const {
  saveProfile,
  uploadDocument,
  handleAcceptTerms,
  
  fetchMyProfile,
  fetchPublicContestants,
  fetchPublicContestantById,
} = require("../controllers/contestant.controller");
const { protect } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");

// Public endpoints
router.get("/public", fetchPublicContestants);
router.get("/public/:id", fetchPublicContestantById);

// Protected contestant endpoints
router.use(protect);
router.post("/profile", saveProfile);
router.post("/documents", upload.single("file"), uploadDocument);
router.post("/terms", handleAcceptTerms);

router.get("/my-profile", fetchMyProfile);

module.exports = router;
