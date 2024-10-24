import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { ApiError } from "../utils/apierror.js";
import { APPLICATION_ROLE } from "../constant.js";

const userSchema = new Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true, // enable searching on this field
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    area: {
      type: String,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    refreshToken: {
      type: String,
    },
    role: {
      type: String,
      enum: APPLICATION_ROLE, // Ensure 'production' is included in APPLICATION_ROLE
      required: true,
    },
    totalTargetCompleted: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

//mongoose hook
userSchema.pre("save", async function (next) {
  // Check if the password field has been modified
  if (!this.isModified("password")) return next();

  try {
    // Generate salt with a cost factor of 10
    const salt = await bcrypt.genSalt(10);

    // Hash the password with the generated salt
    this.password = await bcrypt.hash(this.password, salt);

    // Proceed to the next middleware or save the user
    next();
  } catch (error) {
    // Handle any error that occurs during hashing
    console.error("Error hashing password:", error);
    next(error); // Pass the error to the next middleware
  }
});

// method function
userSchema.methods.isPasswordCorrect = async function (password) {
  try {
    if (!this.password || !password) {
      throw new ApiError(400, "Password and hash are required");
    }

    console.log(
      "Comparing password:",
      password,
      "with stored hash:",
      this.password
    );

    const isMatch = await bcrypt.compare(password, this.password);

    if (!isMatch) {
      throw new ApiError(400, "Invalid password provided");
    }

    return isMatch; // Return true if the passwords match
  } catch (error) {
    console.error("Error comparing passwords:", error.message);
    throw new ApiError(500, "Error occurred while comparing bcrypt password"); // Throw error to propagate to calling function
  }
};

userSchema.methods.generateAccessToken = async function () {
  return jwt.sign(
    {
      _id: this._id,
      jobId: this.jobId,
      fullName: this.fullName,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};
userSchema.methods.generateRefreshToken = async function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

export const User = mongoose.model("User", userSchema);
