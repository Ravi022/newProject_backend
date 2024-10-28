import { asynchandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/apierror.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.js";
import {
  PRODUCTION_JOBID,
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
    // console.log("user :", req.user);
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

const productionJobIdtoAdminAuth = async (req, res, next) => {
  try {
    const productionJobId = PRODUCTION_JOBID;

    // Find the production user by jobId
    const productionUser = await User.findOne({
      jobId: productionJobId,
      role: USER_TYPE_PRODUCTION,
    });
    if (!productionUser) {
      return res.status(404).json({ message: "Production user not found." });
    }

    // Add productionUserId to the request object
    req.productionUserId = productionUser._id;
    next();
  } catch (error) {
    console.error("Error in productionJobIdtoAdminAuth middleware:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// Controller function to retrieve TotalStocks data
const retrieveStocksData = asynchandler(async (req, res) => {
  const { date, month, year } = req.body;
  const productionUserId = req.productionUserId;

  // Build the query object based on provided inputs
  const query = { user: productionUserId };

  if (date) {
    query.date = new Date(date).setHours(0, 0, 0, 0); // Specific date
  } else if (month && year) {
    query.date = {
      $gte: new Date(year, month - 1, 1), // Start of month
      $lt: new Date(year, month, 1), // Start of next month
    };
  } else if (year) {
    query.date = {
      $gte: new Date(year, 0, 1), // Start of year
      $lt: new Date(year + 1, 0, 1), // Start of next year
    };
  } else {
    return res.status(400).json({
      message: "Please provide a valid date, month and year, or year only.",
    });
  }

  try {
    const stocksData = await TotalStocks.find(query);
    res.status(200).json({
      message: "Stocks data retrieved successfully",
      data: stocksData,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

export {
  verifyjwt,
  authAdmin,
  authSalesperson,
  authProduction,
  productionJobIdtoAdminAuth,
  retrieveStocksData,
};
