import { asynchandler } from "../utils/asynchandler.js";
import { User } from "../models/user.js";
import { ApiError } from "../utils/apierror.js";
import { ApiResponse } from "../utils/apiresponse.js"; // Assuming you have this
import jwt from "jsonwebtoken";

const generateAccessandRefreshToken = async (userId) => {
  // console.log("generateAccessandRefreshToken");
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    // console.log("accessToken", accessToken);
    const refreshToken = await user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { refreshToken, accessToken };
  } catch (error) {
    return new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

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

const refresh_token = asynchandler(async (req, res) => {
  // fetch data (req.body || req.header.cookies)
  // find the user in data (_id)
  // set accessToken in cookies for this.

  const incomingToken = req.cookies?.refreshToken || req.body.refreshToken;
  console.log(incomingToken);
  try {
    if (!incomingToken) {
      throw new ApiError(401, "Unauthorized request");
    }
    const decodedToken = jwt.verify(
      incomingToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    if (!decodedToken) {
      throw new ApiError(
        400,
        "Something went wrong while decoding refresh Token"
      );
    }
    // console.log(decodedToken);
    const user = await User.findById(decodedToken?._id);
    // console.log("user", user);
    if (!user) {
      throw new ApiError(401, "Invalid refresh Token");
    }
    // console.log("userrefreshToken", user.refreshToken);
    if (incomingToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }
    const { refreshToken, accessToken } = await generateAccessandRefreshToken(
      user._id
    );
    console.log(refreshToken, accessToken);
    const options = {
      httpOnly: true,
      secure: true,
    };
    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: refreshToken },
          "Access Token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh Token");
  }
});

export { changeCurrentPassword, logoutUser, refresh_token };
