
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const crypto = require("crypto");


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

  const normalizedEmail = email.toLowerCase().trim();

  let user = await User.findOne({
    $or: [
      { firebaseUid: uid },
      { email: normalizedEmail },
    ],
  });

  if (user) {
    if (user.status === "blocked") {
      throw new Error("Your account has been blocked");
    }

    user.firebaseUid = uid;

    if (!user.authProvider) {
      user.authProvider = "google";
    }

    if (!user.fullName && name) {
      user.fullName = name;
    }

    await user.save();
  } else {
    user = await User.create({
      fullName: name || "Google User",
      email: normalizedEmail,
      firebaseUid: uid,
      authProvider: "google",
      password: null,
      mobile: null,
      dob: null,
      gender: null,
      city: null,
      state: null,
      role: "user",
      status: "active",
    });
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
      profileImage: picture || null,
      profileCompleted: Boolean(
        user.mobile &&
        user.dob &&
        user.gender &&
        user.city &&
        user.state
      ),
    },
    token,
  };
};

const forgotPassword = async (email) => {
  if (!email) {
    throw new Error("Email is required");
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({
    email: normalizedEmail,
  });

  if (!user) {
    throw new Error("No account found with this email");
  }


  const resetToken = crypto.randomBytes(32).toString("hex");

  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.resetPasswordToken = hashedToken;

  user.resetPasswordExpires = new Date(
    Date.now() + 15 * 60 * 1000
  );

  await user.save();

  return {
    resetToken,
    email: user.email,
    fullName: user.fullName,
  };
};


const resetPassword = async (token, newPassword) => {
  if (!token) {
    throw new Error("Reset token is required");
  }

  if (!newPassword) {
    throw new Error("New password is required");
  }

  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: {
      $gt: new Date(),
    },
  });

  if (!user) {
    throw new Error("Invalid or expired reset link");
  }

 

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  user.password = hashedPassword;
  user.authProvider = "local";

  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;

  await user.save();

  return {
    message: "Password reset successfully",
  };
};

module.exports = {
  registerUser,
  loginUser,
  googleLogin,
  forgotPassword,
  resetPassword
};
