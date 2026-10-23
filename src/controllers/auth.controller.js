const {
  registerUser,
  loginUser,
  googleLogin,
  createContestantProfile,
  forgotPassword,
  resetPassword,
} = require("../services/auth.service");

const sendEmail = require("../utils/sendEmail");

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

    const profile = await createContestantProfile(userId, req.body);

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
    const { email } = req.body || {};


    console.log("This is email", email)

    const result = await forgotPassword(email);

    if (result.shouldSendEmail) {
      const baseUrl = (
        process.env.FRONTEND_URL || "https://theborderbound.in"
      ).replace(/\/+$/, "");

      const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(
        result.resetToken
      )}`;

      const safeName = String(result.fullName || "there")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
console.log("RESULT OBJECT:", result);
console.log("RESULT EMAIL:", result.email);
      await sendEmail({
        to: result.email,
        subject: "Reset Your BorderBound Password",
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:30px;color:#111;line-height:1.6;">
            <h2 style="margin-bottom:16px;">Reset Your Password</h2>

            <p>Hi ${safeName},</p>

            <p>We received a request to reset your BorderBound account password.</p>

            <p>Click below to securely create a new password.</p>

            <div style="margin:28px 0;">
              <a href="${resetLink}"
                style="display:inline-block;padding:14px 24px;background:#000;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
                Reset Password
              </a>
            </div>

            <p style="color:#666;font-size:14px;">
              This link expires in 15 minutes and can only be used once.
            </p>

            <p style="color:#666;font-size:14px;">
              If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </p>

            <p style="margin-top:30px;">
              Regards,<br />
              <strong>The BorderBound Team</strong>
            </p>
          </div>
        `,
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "If an account with that email exists, a password reset link will be sent shortly. Please check your inbox and spam folder.",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);

    return res.status(500).json({
      success: false,
      message:
        "We couldn't process your request right now. Please try again in a few minutes.",
    });
  }
};

const resetPasswordController = async (req, res) => {
  try {
    const token = req.body?.token || req.query?.token || req.params?.token;

    const newPassword = req.body?.newPassword || req.body?.password;

    const result = await resetPassword(token, newPassword);

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
  resetPasswordController,
};
