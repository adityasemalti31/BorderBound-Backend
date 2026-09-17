const {
  registerUser,
  verifyOtp,
  resendOtp,
  loginUser,
  createContestantProfile
} = require("../services/auth.service");

const register = async (req, res) => {
  try {
    const result = await registerUser(req.body);

    res.status(201).json({
      success: true,
      message: "Registration successful. OTP sent to your mobile number.",
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const verifyMobileOtp = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    const result = await verifyOtp(userId, otp);

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Mobile number verified successfully",
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const resendMobileOtp = async (req, res) => {
  try {
    const { userId } = req.body;

    const result = await resendOtp(userId);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await loginUser(email, password);

    res.cookie("token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: result.user,
        token: result.token,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const getMe = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user,
    },
  });
};

const logout = async (req, res) => {
  res.clearCookie("token");
  res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};






const createContestantProfileController = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const profile = await createContestantProfile(
      userId,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Contestant profile created successfully",
      data: profile,
    });
  } catch (error) {
    console.error("Create contestant profile error:", error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createContestantProfile,
};


module.exports = {
  register,
  verifyMobileOtp,
  resendMobileOtp,
  login,
  getMe,
  logout,
  createContestantProfileController
};