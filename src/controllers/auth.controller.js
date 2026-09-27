const {
  registerUser,
  loginUser,
  googleLogin,
  createContestantProfile,
  forgotPassword,
  resetPassword,
} = require("../services/auth.service");

const sendEmail = require('../utils/sendEmail')
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



const forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;

    const result = await forgotPassword(email);

    const resetLink = result.resetLink;

    await sendEmail({
      to: email,
      subject: "Reset Your Co-Finder Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px;">
          <h2 style="color: #111;">Reset Your Password</h2>

          <p>
            We received a request to reset your Co-Finder password.
          </p>

          <p>
            Click the button below to create a new password:
          </p>

          <div style="margin: 30px 0;">
            <a
              href="${resetLink}"
              style="
                display: inline-block;
                padding: 14px 24px;
                background: #000;
                color: #fff;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
              "
            >
              Reset Password
            </a>
          </div>

          <p style="color: #666;">
            If you didn't request a password reset, you can safely ignore this email.
          </p>

          <p style="color: #666;">
            This reset link will expire soon.
          </p>

          <p>
            Regards,<br />
            <strong>Co-Finder Team</strong>
          </p>
        </div>
      `,
    });

    res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your email.",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


const resetPasswordController = async (req, res) => {
  try {
    const { token, password } = req.body;

    const result = await resetPassword(token, password);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error("Reset Password Error:", error);

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
  forgotPasswordController,
  resetPasswordController
};