const ContestantProfile = require("../models/contestant.model");
const User = require("../models/user.model");
const SystemConfig = require("../models/systemConfig.model");
const Payment = require("../models/payment.model");
const { getRegistrationFeeInfo } = require("../utils/dateUtils");
const { createPayment, verifyPayUResponseHash } = require("./payment.service");
const { uploadFile } = require("./upload.service");

// Helper to generate unique Application ID: BB-2026-XXXXX
const generateApplicationId = async () => {
  const count = await ContestantProfile.countDocuments();
  const year = new Date().getFullYear();
  const numStr = String(count + 1).padStart(5, "0");
  return `BB-${year}-${numStr}`;
};

const getSystemConfig = async () => {
  let config = await SystemConfig.findOne({ key: "DEFAULT_CONFIG" });
  if (!config) {
    config = await SystemConfig.create({ key: "DEFAULT_CONFIG" });
  }
  return config;
};

// Step 2: Save or Update Profile Information
const createOrUpdateProfile = async (userId, profileData) => {
  const config = await getSystemConfig();
  const feeInfo = getRegistrationFeeInfo(new Date(), config);

  if (feeInfo.isClosed) {
    throw new Error(
      feeInfo.reason || "Registration is currently closed."
    );
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  let profile = await ContestantProfile.findOne({ userId });

  const {
    fullName,
    dob,
    gender,
    mobile,
    email,
    city,
    state,
    permanentAddress,
    occupation,
    education,
    socialMedia,
    emergencyContact,
    bio,
  } = profileData;

  if (
    !dob ||
    !gender ||
    !mobile ||
    !city ||
    !state
  ) {
    throw new Error(
      "Date of birth, gender, mobile, city and state are required."
    );
  }

  if (
    !permanentAddress ||
    !emergencyContact ||
    !emergencyContact.name ||
    !emergencyContact.phone
  ) {
    throw new Error(
      "Permanent address and Emergency contact details are required."
    );
  }

  const parsedDob = new Date(dob);

  if (Number.isNaN(parsedDob.getTime())) {
    throw new Error("Please provide a valid date of birth.");
  }

  const age = Math.floor(
    (new Date() - parsedDob) /
      (365.25 * 24 * 60 * 60 * 1000)
  );

  if (age < 18) {
    throw new Error("Contestant must be at least 18 years old.");
  }

  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const finalFullName =
    fullName?.trim() || user.fullName;

  const finalEmail =
    email?.toLowerCase().trim() || user.email;

  if (!finalFullName) {
    throw new Error("Full name is required.");
  }

  if (!finalEmail) {
    throw new Error("Email is required.");
  }

  if (profile) {
    if (profile.status === "approved") {
      throw new Error(
        "Approved contestant profile cannot be edited directly."
      );
    }

    profile.fullName = finalFullName;
    profile.dob = parsedDob;
    profile.age = age;
    profile.gender = gender;
    profile.mobile = mobile;
    profile.email = finalEmail;
    profile.city = city;
    profile.state = state;

    profile.permanentAddress = permanentAddress;
    profile.occupation = occupation || profile.occupation;
    profile.education = education || profile.education;
    profile.bio = bio || profile.bio;

    if (socialMedia) {
      profile.socialMedia = {
        ...profile.socialMedia,
        ...socialMedia,
      };
    }

    profile.emergencyContact = emergencyContact;

    if (!profile.slug) {
      profile.slug = generateSlug(finalFullName);
    }

    await profile.save();
  } else {
    const applicationId = await generateApplicationId();

    const slug = generateSlug(finalFullName);

    profile = await ContestantProfile.create({
      userId,
      applicationId,

      fullName: finalFullName,
      slug,

      dob: parsedDob,
      age,
      gender,
      mobile,
      email: finalEmail,
      city,
      state,

      permanentAddress,
      occupation: occupation || "",
      education: education || "",
      bio: bio || "",

      socialMedia: socialMedia || {},
      emergencyContact,

      status: "draft",
    });

    user.contestantProfile = profile._id;
  }

  // Keep User data synced with the completed profile
  user.fullName = finalFullName;
  user.dob = parsedDob;
  user.gender = gender;
  user.mobile = mobile;
  user.email = finalEmail;
  user.city = city;
  user.state = state;

  await user.save();

  return profile;
};

// Step 3: Upload Document / Photograph
const uploadContestantDoc = async (
  userId,
  docType,
  fileBuffer,
  originalName,
) => {
  const profile = await ContestantProfile.findOne({ userId });
  if (!profile) {
    throw new Error(
      "Contestant profile does not exist. Complete profile form first.",
    );
  }

  const uploadRes = await uploadFile(
    fileBuffer,
    originalName,
    "borderbound_docs",
  );

  if (docType === "photograph") {
    profile.profilePhotoUrl = uploadRes.url;
  }

  // Replace existing doc of same type or append
  const existingDocIndex = profile.documents.findIndex(
    (d) => d.docType === docType,
  );
  if (existingDocIndex > -1) {
    profile.documents[existingDocIndex] = {
      docType,
      url: uploadRes.url,
      publicId: uploadRes.publicId,
      status: "pending",
      uploadedAt: new Date(),
    };
  } else {
    profile.documents.push({
      docType,
      url: uploadRes.url,
      publicId: uploadRes.publicId,
      status: "pending",
      uploadedAt: new Date(),
    });
  }

  await profile.save();
  return profile;
};

// Step 4: Accept Terms & Conditions
const acceptTerms = async (userId) => {
  const profile = await ContestantProfile.findOne({ userId });
  if (!profile) {
    throw new Error("Contestant profile not found.");
  }

  profile.termsAccepted = true;
  profile.termsAcceptedAt = new Date();
  await profile.save();

  return profile;
};

// Step 5: Initiate Registration Fee Payment
const initiateRegistrationFee = async (userId, ipAddress, userAgent) => {
  const config = await getSystemConfig();

  const feeInfo = getRegistrationFeeInfo(new Date(), config);

  if (feeInfo.isClosed) {
    throw new Error(feeInfo.reason || "Registration is closed.");
  }

  const profile = await ContestantProfile.findOne({
    userId,
  });

  if (!profile) {
    throw new Error("Contestant profile not found.");
  }

  if (!profile.termsAccepted) {
    throw new Error(
      "You must accept the official Terms & Conditions before paying.",
    );
  }

  if (profile.registrationFeePaid) {
    throw new Error(
      "Registration fee has already been paid for this application.",
    );
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found.");
  }

  const amount = feeInfo.amount;

  const paymentData = await createPayment({
    userId,
    contestantId: profile._id,
    amount,
    firstname: user.fullName,
    email: user.email,
    phone: user.mobile,
    productinfo: "Borderbound Registration Fee",
    type: "registration",
    udf1: String(userId),
    udf2: "registration",
    udf3: String(profile._id),
    ipAddress,
    userAgent,
  });

  profile.status = "pending_payment";
  profile.registrationFeeAmount = amount;
  profile.registrationFeePhase = feeInfo.phase;

  await profile.save();

  return {
    ...paymentData,
    phase: feeInfo.phase,
    phaseName: feeInfo.phaseName,
    applicationId: profile.applicationId,
  };
};

// Step 5 Verification: Confirm Registration Fee Payment
const verifyRegistrationFee = async (userId, paymentData) => {
  const {
    txnid,
    mihpayid,
    status,
    hash,
    amount,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
  } = paymentData;

  if (!txnid || !status || !hash) {
    throw new Error("Invalid PayU payment response.");
  }

  const isValidHash = verifyPayUResponseHash(paymentData);

  if (!isValidHash) {
    throw new Error("Payment verification failed.");
  }

  const payment = await Payment.findOne({ txnid });

  if (!payment) {
    throw new Error("Payment transaction not found.");
  }

  if (payment.userId.toString() !== userId.toString()) {
    throw new Error("Payment does not belong to this user.");
  }

  if (status !== "success") {
    payment.status = "failed";
    payment.rawResponse = paymentData;
    await payment.save();

    throw new Error("Payment was not successful.");
  }

  if (payment.status === "success") {
    return {
      success: true,
      message: "Payment already verified.",
      applicationId: payment.contestantId,
    };
  }

  payment.status = "success";
  payment.mihpayid = mihpayid || null;
  payment.paymentMode = paymentData.mode || null;
  payment.bankReferenceNumber =
    paymentData.bank_ref_num || null;
  payment.rawResponse = paymentData;

  await payment.save();

  const profile = await ContestantProfile.findById(
    payment.contestantId
  );

  if (!profile) {
    throw new Error("Contestant profile not found.");
  }

  profile.registrationFeePaid = true;
  profile.registrationPaymentId = payment._id;
  profile.status = "pending_review";

  await profile.save();

  return {
    success: true,
    message:
      "Registration fee payment verified successfully. Application submitted for verification.",
    applicationId: profile.applicationId,
    status: profile.status,
  };
};

// Get My Profile Dashboard (Step 7)
const getMyProfile = async (userId) => {
  const profile = await ContestantProfile.findOne({ userId }).populate(
    "registrationPaymentId",
  );
  if (!profile) {
    return null;
  }
  return profile;
};

// Public Get Approved Contestant Profiles (Step 7)
const getPublicContestants = async ({
  search,
  city,
  state,
  page = 1,
  limit = 20,
}) => {
  const query = { status: "approved" };

  if (search) {
    query.$or = [
      { fullName: new RegExp(search, "i") },
      { city: new RegExp(search, "i") },
      { applicationId: new RegExp(search, "i") },
    ];
  }

  if (city) {
    query.city = new RegExp(city, "i");
  }

  if (state) {
    query.state = new RegExp(state, "i");
  }

  const skip = (page - 1) * limit;

  const contestants = await ContestantProfile.find(query)
    .sort({ totalValidVotes: -1, updatedAt: 1 })
    .skip(skip)
    .limit(limit)
    .select(
      "applicationId fullName age gender city state profilePhotoUrl bio socialMedia totalValidVotes rank selectionStatus",
    );

  const total = await ContestantProfile.countDocuments(query);

  return {
    contestants,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
  };
};

// Public Get Single Contestant Details
const getPublicContestantById = async (contestantId) => {
  const profile = await ContestantProfile.findOne({
    _id: contestantId,
    status: "approved",
  }).select("-permanentAddress -emergencyContact -documents");

  if (!profile) {
    throw new Error("Contestant profile not found or not currently active.");
  }

  return profile;
};

module.exports = {
  createOrUpdateProfile,
  uploadContestantDoc,
  acceptTerms,
  initiateRegistrationFee,
  verifyRegistrationFee,
  getMyProfile,
  getPublicContestants,
  getPublicContestantById,
};
