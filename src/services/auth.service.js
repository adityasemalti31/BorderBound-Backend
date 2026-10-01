const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

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

const normalizeEmail = (email) => {
  if (typeof email !== "string") return null;
  return email.trim().toLowerCase();
};

const validatePassword = (password) => {
  if (
    typeof password !== "string" ||
    password.length < 8
  ) {
    throw new Error("Password must be at least 8 characters");
  }
};

const calculateAge = (dob) => {
  const birthDate = new Date(dob);

  if (Number.isNaN(birthDate.getTime())) {
    throw new Error("Invalid date of birth");
  }

  const today = new Date();

  let age =
    today.getFullYear() -
    birthDate.getFullYear();

  const monthDifference =
    today.getMonth() -
    birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (
      monthDifference === 0 &&
      today.getDate() < birthDate.getDate()
    )
  ) {
    age--;
  }

  return age;
};

const getPublicUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email,
  mobile: user.mobile,
  role: user.role,
  authProvider: user.authProvider,
});

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

  validatePassword(password);

  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("Invalid email");
  }

  const age = calculateAge(dob);

  if (age < 16) {
    throw new Error(
      "You must be at least 16 years old to register"
    );
  }

  const existingUser = await User.findOne({
    $or: [
      { email: normalizedEmail },
      { mobile },
    ],
  }).select("email mobile");

  if (existingUser) {
    if (existingUser.email === normalizedEmail) {
      throw new Error("Email already registered");
    }

    if (existingUser.mobile === mobile) {
      throw new Error("Mobile number already registered");
    }
  }

  const hashedPassword = await bcrypt.hash(
    password,
    10
  );

  try {
    const user = await User.create({
      fullName: fullName.trim(),
      mobile: mobile.trim(),
      email: normalizedEmail,
      dob,
      gender,
      city: city.trim(),
      state: state.trim(),
      password: hashedPassword,
      authProvider: "local",
      role: "user",
      status: "active",
    });

    const token = generateToken(user);

    return {
      user: getPublicUser(user),
      token,
    };
  } catch (error) {
    if (error?.code === 11000) {
      if (error.keyPattern?.email) {
        throw new Error("Email already registered");
      }

      if (error.keyPattern?.mobile) {
        throw new Error("Mobile number already registered");
      }

      throw new Error("Account already exists");
    }

    throw error;
  }
};

const loginUser = async (email, password) => {
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    throw new Error("Email and password are required");
  }

  const normalizedEmail = normalizeEmail(email);

  const user = await User.findOne({
    email: normalizedEmail,
  });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (user.status === "blocked") {
    throw new Error("Your account has been blocked");
  }

  if (
    user.authProvider === "google" &&
    !user.password
  ) {
    throw new Error("This account uses Google login");
  }

  const isPasswordValid = await bcrypt.compare(
    password,
    user.password
  );

  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  const token = generateToken(user);

  return {
    user: getPublicUser(user),
    token,
  };
};

const googleLogin = async (idToken) => {
  if (
    typeof idToken !== "string" ||
    !idToken.trim()
  ) {
    throw new Error(
      "Google ID token is required"
    );
  }

  let decodedToken;

  try {
    decodedToken =
      await getAuth(firebaseApp).verifyIdToken(
        idToken
      );
  } catch (error) {
    console.error(
      "Firebase token verification error:",
      error
    );

    throw new Error(
      "Invalid Google authentication token"
    );
  }

  const {
    uid,
    email,
    name,
    picture,
    email_verified,
  } = decodedToken;

  if (!email) {
    throw new Error(
      "Google account email is required"
    );
  }

  if (!email_verified) {
    throw new Error(
      "Google email is not verified"
    );
  }

  const normalizedEmail =
    normalizeEmail(email);

  let user = await User.findOne({
    $or: [
      { firebaseUid: uid },
      { email: normalizedEmail },
    ],
  });

  if (user) {
    if (user.status === "blocked") {
      throw new Error(
        "Your account has been blocked"
      );
    }

    let shouldSave = false;

    if (user.firebaseUid !== uid) {
      user.firebaseUid = uid;
      shouldSave = true;
    }

    if (
      user.authProvider !== "google" &&
      !user.password
    ) {
      user.authProvider = "google";
      shouldSave = true;
    }

    if (!user.fullName && name) {
      user.fullName = name;
      shouldSave = true;
    }

    if (shouldSave) {
      await user.save();
    }
  } else {
    try {
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
    } catch (error) {
      if (error?.code === 11000) {
        user = await User.findOne({
          $or: [
            { firebaseUid: uid },
            { email: normalizedEmail },
          ],
        });

        if (!user) {
          throw error;
        }

        if (user.status === "blocked") {
          throw new Error(
            "Your account has been blocked"
          );
        }
      } else {
        throw error;
      }
    }
  }

  const token = generateToken(user);

  return {
    user: {
      ...getPublicUser(user),
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
  if (
    typeof email !== "string" ||
    !email.trim()
  ) {
    throw new Error("Email is required");
  }

  const normalizedEmail =
    normalizeEmail(email);

  const user = await User.findOne({
    email: normalizedEmail,
  }).select(
    "email fullName status"
  );

  // Controller can always return the same public
  // success message to prevent account enumeration.
  if (!user) {
    return {
      resetToken: null,
      email: null,
      fullName: null,
    };
  }

  if (user.status === "blocked") {
    return {
      resetToken: null,
      email: null,
      fullName: null,
    };
  }

  const resetToken =
    crypto.randomBytes(32).toString("hex");

  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = new Date(
    Date.now() + 15 * 60 * 1000
  );

  await user.save({
    validateBeforeSave: false,
  });

  return {
    resetToken,
    email: user.email,
    fullName: user.fullName,
  };
};

const resetPassword = async (
  token,
  newPassword
) => {
  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    throw new Error(
      "Reset token is required"
    );
  }

  validatePassword(newPassword);

  const cleanToken = token.trim();

  const hashedToken = crypto
    .createHash("sha256")
    .update(cleanToken)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: {
      $gt: new Date(),
    },
  });

  if (!user) {
    throw new Error(
      "Invalid or expired reset link"
    );
  }

  if (user.status === "blocked") {
    throw new Error(
      "Your account has been blocked"
    );
  }

  const hashedPassword =
    await bcrypt.hash(newPassword, 12);

  user.password = hashedPassword;
  user.authProvider = "local";
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;

  await user.save({
    validateBeforeSave: false,
  });

  return {
    message: "Password reset successfully",
  };
};

module.exports = {
  registerUser,
  loginUser,
  googleLogin,
  forgotPassword,
  resetPassword,
};