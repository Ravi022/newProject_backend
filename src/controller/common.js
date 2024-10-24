import { asynchandler } from "../utils/asynchandler.js";
import { User } from "../models/user.js";
import { ApiError } from "../utils/apierror.js";
import { ApiResponse } from "../utils/apiresponse.js"; // Assuming you have this

const changeCurrentPassword = asynchandler(async (req, res) => {
  const { newPassword, oldPassword } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(400, "User not found");
  }

  // Validate old password
  const isPasswordValid = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid Password");
  }
  console.log("isPasswordValid", isPasswordValid);
  // Set new password (this will trigger pre-save hook to hash it)
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const logoutUser = asynchandler(async (req, res) => {
  // Log req.user for debugging purposes
  console.log("req.user", req.user);

  // Check if req.user and req.user._id exist
  if (!req.user || !req.user._id) {
    throw new ApiError(401, "User authentication failed");
  }

  const userId = req.user._id; // Extract the user ID from req.user

  // Find the user by their ID
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Clear the refreshToken from the user document
  user.refreshToken = null; // or use an empty string: user.refreshToken = '';
  await user.save();

  // Send success response
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Logged out successfully"));
});

export { changeCurrentPassword, logoutUser };
