const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const ContestantProfile = require("../models/contestant.model");


const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

const registerUser = async (data) => {
  const {
    fullName,
    mobile,
    email,
    dob,
    gender,
    city,
    state,
    password,
  } = data;

  if (
    !fullName ||
    !mobile ||
    !email ||
    !dob ||
    !gender ||
    !city ||
    !state ||
    !password
  ) {
    throw new Error("All fields are required");
  }

  const existingUser = await User.findOne({
    $or: [{ email }, { mobile }],
  });

  if (existingUser) {
    if (existingUser.email === email) {
      throw new Error("Email already registered");
    }

    if (existingUser.mobile === mobile) {
      throw new Error("Mobile number already registered");
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const otp = generateOtp();

  const user = await User.create({
    fullName,
    mobile,
    email,
    dob,
    gender,
    city,
    state,
    password: hashedPassword,
    authProvider: "local",
    mobileVerified: false,
    otp,
    otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });

  return {
    userId: user._id,
    mobile: user.mobile,
    email: user.email,
    otp,
  };
};

const verifyOtp = async (userId, otp) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  if (user.mobileVerified) {
    throw new Error("Mobile number already verified");
  }

  if (!user.otp || !user.otpExpiresAt) {
    throw new Error("OTP not found");
  }

  if (user.otpExpiresAt < new Date()) {
    throw new Error("OTP expired");
  }

  if (user.otp !== otp) {
    throw new Error("Invalid OTP");
  }

  user.mobileVerified = true;
  user.otp = null;
  user.otpExpiresAt = null;

  await user.save();

  const token = generateToken(user);

  return {
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
    },
    token,
  };
};

const resendOtp = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  if (user.mobileVerified) {
    throw new Error("Mobile number already verified");
  }

  const otp = generateOtp();

  user.otp = otp;
  user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await user.save();

  return {
    userId: user._id,
    mobile: user.mobile,
    otp,
  };
};

const loginUser = async (email, password) => {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (user.status === "blocked") {
    throw new Error("Your account has been blocked");
  }

  if (user.authProvider === "google") {
    throw new Error("This account uses Google login");
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    user.password
  );

  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  if (!user.mobileVerified) {
    throw new Error("Please verify your mobile number first");
  }

  const token = generateToken(user);

  return {
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
    },
    token,
  };
};







module.exports = {
  registerUser,
  verifyOtp,
  resendOtp,
  loginUser,
};