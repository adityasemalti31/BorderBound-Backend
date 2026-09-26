
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

const { getAuth } = require("firebase-admin/auth");
const firebaseApp = require("../config/firebase");

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

  const normalizedEmail = email.toLowerCase().trim();

  const existingUser = await User.findOne({
    $or: [{ email: normalizedEmail }, { mobile }],
  });

  if (existingUser) {
    if (existingUser.email === normalizedEmail) {
      throw new Error("Email already registered");
    }

    if (existingUser.mobile === mobile) {
      throw new Error("Mobile number already registered");
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    fullName,
    mobile,
    email: normalizedEmail,
    dob,
    gender,
    city,
    state,
    password: hashedPassword,
    authProvider: "local",
    role: "user",
    status: "active",
  });

  const token = generateToken(user);

  return {
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      authProvider: user.authProvider,
    },
    token,
  };
};

const loginUser = async (email, password) => {
  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({
    email: normalizedEmail,
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (user.status === "blocked") {
    throw new Error("Your account has been blocked");
  }

  if (user.authProvider === "google" && !user.password) {
    throw new Error("This account uses Google login");
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  const token = generateToken(user);

  return {
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      authProvider: user.authProvider,
    },
    token,
  };
};

const googleLogin = async (idToken) => {
  if (!idToken) {
    throw new Error("Google ID token is required");
  }

  let decodedToken;

  try {
    decodedToken = await getAuth(firebaseApp).verifyIdToken(idToken);
  } catch (error) {
    console.error("Firebase token verification error:", error);
    throw new Error("Invalid Google authentication token");
  }

  const {
    uid,
    email,
    name,
    picture,
    email_verified,
  } = decodedToken;

  if (!email) {
    throw new Error("Google account email is required");
  }

  if (!email_verified) {
    throw new Error("Google email is not verified");
  }

  // baaki same...
};

module.exports = {
  registerUser,
  loginUser,
  googleLogin,
};
