import { asynchandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/apierror.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.js";
import {
  USER_TYPE_ADMIN,
  USER_TYPE_PLAYER,
  USER_TYPE_PRODUCTION,
} from "../constant.js";

const verifyjwt = asynchandler(async (req, _, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized Request");
    }
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );
    console.log("user from accessToken", user);

    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }
    req.user = user;
    console.log("user :", req.user);
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Access Token");
  }
});

const authAdmin = async (req, res, next) => {
  if (req.user.role === USER_TYPE_ADMIN) {
    next();
  } else {
    return res.status(402).json({
      success: false,
      message: "Authorization failed. Not authorized to perform this action.",
    });
  }
};

const authSalesperson = async (req, res, next) => {
  if (req.user.role === USER_TYPE_PLAYER) {
    next();
  } else {
    return res.status(402).json({
      success: false,
      message: "Authorization failed. Not authorized to perform this action.",
    });
  }
};
const authProduction = async (req, res, next) => {
  console.log("req.user", req.user);
  if (req.user.role === USER_TYPE_PRODUCTION) {
    next();
  } else {
    return res.status(402).json({
      success: false,
      message: "Authorization failed. Not authorized to perform this action.",
    });
  }
};

export { verifyjwt, authAdmin, authSalesperson, authProduction };
