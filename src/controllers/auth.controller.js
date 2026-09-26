const {
  registerUser,
  loginUser,
  googleLogin,
  createContestantProfile,
} = require("../services/auth.service");

const register = async (req, res) => {
  try {
    const result = await registerUser(req.body);

    res.status(201).json({
      success: true,
      message: "Registration successful",
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

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const googleAuth = async (req, res) => {
  try {
    const { idToken } = req.body;

    const result = await googleLogin(idToken);

    res.status(200).json({
      success: true,
      message: "Google authentication successful",
      data: result,
    });
  } catch (error) {
    console.error("Google Auth Error:", error);

    res.status(401).json({
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
  register,
  login,
  googleAuth,
  getMe,
  logout,
  createContestantProfileController,
};