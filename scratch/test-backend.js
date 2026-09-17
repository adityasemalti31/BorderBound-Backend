const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("../src/config/db");
const User = require("../src/models/user.model");
const ContestantProfile = require("../src/models/contestant.model");
const SystemConfig = require("../src/models/systemConfig.model");
const VoteTransaction = require("../src/models/voteTransaction.model");
const Payment = require("../src/models/payment.model");

const { registerUser, verifyOtp, loginUser } = require("../src/services/auth.service");
const {
  createOrUpdateProfile,
  acceptTerms,
  initiateRegistrationFee,
  verifyRegistrationFee,
  getPublicContestants,
} = require("../src/services/contestant.service");
const { getVotingPackages, createVoteOrder, verifyVotePayment } = require("../src/services/voting.service");
const { getLiveLeaderboard } = require("../src/services/leaderboard.service");
const {
  reviewApplication,
  invalidateVoteTransaction,
  calculateFinalSelections,
  selectWildcards,
  certifyFinalResults,
  updateSystemConfig,
} = require("../src/services/admin.service");

const runTests = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await connectDB();
    console.log("Database ready for testing.\n");

    // Clean up test records and sync indexes
    await User.collection.dropIndexes().catch(() => {});
    await User.syncIndexes();
    await User.deleteMany({ email: /@testborderbound\.com$/ });
    await ContestantProfile.deleteMany({ email: /@testborderbound\.com$/ });

    // Step 0: Ensure SystemConfig is reset and set to force_open for testing
    await updateSystemConfig({
      registrationStatusOverride: "force_open",
      votingStatusOverride: "force_open",
      regFeePhase1: 499,
      voteUnitPrice: 5,
      isFinalized: false,
    });
    console.log("✓ Step 0: System Config initialized & forced OPEN for testing.");

    // Step 1: Create Account & Verify Mobile OTP
    console.log("\n--- Step 1: User Registration & OTP Verification ---");
    const adminReg = await registerUser({
      fullName: "Borderbound Admin",
      mobile: "9999900000",
      email: "admin@testborderbound.com",
      dob: "1990-01-01",
      gender: "male",
      city: "Mumbai",
      state: "Maharashtra",
      password: "Password123!",
    });
    await User.findByIdAndUpdate(adminReg.userId, { role: "admin", mobileVerified: true });
    console.log("✓ Admin User created and verified.");

    const contestantUsers = [];
    const contestantProfiles = [];

    // Create 35 test contestants
    for (let i = 1; i <= 35; i++) {
      const email = `contestant${i}@testborderbound.com`;
      const mobile = `98000000${String(i).padStart(2, "0")}`;
      const name = `Contestant ${i}`;

      const reg = await registerUser({
        fullName: name,
        mobile,
        email,
        dob: "2000-05-15",
        gender: i % 2 === 0 ? "female" : "male",
        city: i % 2 === 0 ? "Delhi" : "Mumbai",
        state: i % 2 === 0 ? "Delhi" : "Maharashtra",
        password: "Password123!",
      });

      // Verify OTP
      await verifyOtp(reg.userId, reg.otp);
      contestantUsers.push(reg);

      // Step 2: Complete Profile
      const profile = await createOrUpdateProfile(reg.userId, {
        permanentAddress: `${i} Main Road, Bounded Area`,
        occupation: "Performer / Athlete",
        education: "Graduate",
        socialMedia: { instagram: `@contestant_${i}` },
        emergencyContact: { name: `Parent ${i}`, relation: "Father", phone: `97000000${String(i).padStart(2, "0")}` },
        bio: `Hi I am ${name} ready for The Borderbound!`,
      });

      // Step 4: Accept Terms
      await acceptTerms(reg.userId);

      // Step 5: Pay Registration Fee (Mock Razorpay)
      const payOrder = await initiateRegistrationFee(reg.userId, "127.0.0.1", "TestAgent");
      await verifyRegistrationFee(reg.userId, {
        razorpayOrderId: payOrder.razorpayOrderId,
        razorpayPaymentId: `pay_test_${i}`,
        razorpaySignature: "mock_sig",
      });

      // Step 6: Admin Review & Approval
      const reviewRes = await reviewApplication(profile._id, { action: "approve" });
      contestantProfiles.push(reviewRes.profile);
    }
    console.log(`✓ Created, paid, and approved 35 test contestant profiles.`);

    // Step 7: Public Profile Query
    const publicList = await getPublicContestants({ limit: 5 });
    console.log(`✓ Public contestants retrieved: total = ${publicList.total}`);

    // Step 8: Voting Packages Query
    const pkgs = await getVotingPackages();
    console.log(`✓ Voting Packages fetched: unit price = ₹${pkgs.unitPrice}, packages count = ${pkgs.packages.length}`);

    // Step 11: Public Voting Test (₹5 = 1 Vote)
    console.log("\n--- Step 11: Unlimited Public Voting & Atomic Counts ---");
    // Cast votes for top contestants to generate a leaderboard gradient
    let firstVoteTransactionId = null;
    for (let i = 0; i < contestantProfiles.length; i++) {
      const votesToBuy = (35 - i) * 50; // Contestant 1 gets 1750 votes, Contestant 2 gets 1700 votes...
      const contestantId = contestantProfiles[i]._id;

      const voteOrder = await createVoteOrder({
        contestantId,
        votesCount: votesToBuy,
        voterUserId: null,
        ipAddress: i === 0 ? "192.168.1.100" : "192.168.1.101",
        userAgent: "TestVoterAgent",
      });

      const voteResult = await verifyVotePayment({
        razorpayOrderId: voteOrder.razorpayOrderId,
        razorpayPaymentId: `pay_vote_${i}`,
        razorpaySignature: "mock_sig",
        voterIp: i === 0 ? "192.168.1.100" : "192.168.1.101",
      });

      if (i === 0) {
        firstVoteTransactionId = voteResult.transactionId;
      }
    }
    console.log("✓ Cast voting packages across contestants successfully.");

    // Step 9: Query Live Leaderboard
    console.log("\n--- Step 9: Live Leaderboard Query ---");
    const leaderboardData = await getLiveLeaderboard({ limit: 10 });
    console.log(`✓ Total votes cast on leaderboard: ${leaderboardData.meta.totalVotesCast}`);
    console.log("Top 3 Leaderboard Standings:");
    leaderboardData.leaderboard.slice(0, 3).forEach((item) => {
      console.log(`  Rank #${item.rank}: ${item.fullName} (${item.applicationId}) - ${item.totalValidVotes} votes [Movement: ${item.movement}]`);
    });

    // Step 10: Anti-Fraud Vote Invalidation
    console.log("\n--- Step 10: Anti-Fraud Vote Invalidation ---");
    const invalidRes = await invalidateVoteTransaction(firstVoteTransactionId, adminReg.userId, "Flagged for bot traffic");
    console.log(`✓ Invalidated ${invalidRes.deductedVotes} votes. Updated contestant total: ${invalidRes.updatedContestantVotes}`);

    // Step 12 & 13: Final Selections & Wild Card
    console.log("\n--- Step 12 & 13: Top 32 Qualification & Wildcard Selection ---");
    const selections = await calculateFinalSelections();
    console.log(`✓ Calculated Top 32 count: ${selections.top32.length}`);
    console.log(`✓ Wildcard Eligible (Top 50 remaining) count: ${selections.wildcardEligibleTop50.length}`);

    // Pick 4 Wild Card contestants from Top 50
    for (let extra = 36; extra <= 39; extra++) {
      const email = `contestant${extra}@testborderbound.com`;
      const reg = await registerUser({
        fullName: `Contestant ${extra}`,
        mobile: `98000000${extra}`,
        email,
        dob: "2000-05-15",
        gender: "male",
        city: "Delhi",
        state: "Delhi",
        password: "Password123!",
      });
      await verifyOtp(reg.userId, reg.otp);
      const prof = await createOrUpdateProfile(reg.userId, {
        permanentAddress: `${extra} Main Road`,
        emergencyContact: { name: "Parent", relation: "Father", phone: "9700000000" },
      });
      await acceptTerms(reg.userId);
      const reviewRes = await reviewApplication(prof._id, { action: "approve" });
      contestantProfiles.push(reviewRes.profile);
    }

    const updatedSelections = await calculateFinalSelections();
    const wildcardIds = updatedSelections.wildcardEligibleTop50.slice(0, 4).map((c) => c.id);

    const wildcardRes = await selectWildcards(wildcardIds);
    console.log(`✓ Selected 4 Wild Card contestants successfully:`, wildcardRes.selectedIds);

    // Step 16: Certification
    console.log("\n--- Step 16: Official Final Result Certification ---");
    const certRes = await certifyFinalResults();
    console.log(`✓ ${certRes.message}`);

    // Cleanup test data
    await User.deleteMany({ email: /@testborderbound\.com$/ });
    await ContestantProfile.deleteMany({ email: /@testborderbound\.com$/ });
    await VoteTransaction.deleteMany({});
    await Payment.deleteMany({});

    console.log("\n==========================================");
    console.log(" ALL BORDERBOUND BACKEND TESTS PASSED!");
    console.log("==========================================\n");
    process.exit(0);
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  }
};

runTests();
