import mongoose, { Schema } from "mongoose";
import { DOCUMENT_TYPE } from "../constant.js";

// Define the file upload schema
const fileUploadSchema = new Schema(
  {
    productionUser: {
      type: mongoose.Schema.Types.ObjectId, // Reference the User schema (production user)
      ref: "User", // This will create a reference to the User model
      required: true,
    },
    fileType: {
      type: String,
      enum: DOCUMENT_TYPE,
      required: true,
    },
    s3Key: {
      type: String, // S3 key of the uploaded file
      required: true,
    },
    s3FileUrl: {
      type: String,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    reportMonth: {
      type: Number, // only for productionReport
      required: function () {
        return this.fileType === "productionReport";
      },
    },
    reportYear: {
      type: Number, // only for productionReport
      required: function () {
        return this.fileType === "productionReport";
      },
    },
  },
  { timestamps: true }
);

export const FileUpload = mongoose.model("FileUpload", fileUploadSchema);
