import express from "express";
import multer from "multer";
import AWS from "aws-sdk";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url"; // Required to define __dirname in ES modules
import { FileUpload } from "../models/uploadDocument.js";
import { asynchandler } from "../utils/asynchandler.js";
import { MTDReport } from "../models/mtd.js";
import { TotalStocks } from "../models/totalStocks.js";

// Define __dirname for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// AWS S3 setup
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Ensure public/temp directory exists
const tempDirectory = path.join(__dirname, "../../public/temp");
if (!fs.existsSync(tempDirectory)) {
  fs.mkdirSync(tempDirectory, { recursive: true });
}

// Multer setup to store files in public/temp
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDirectory); // Save to /public/temp using the correct relative path
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// Utility function to upload file to S3
const uploadToS3 = (filePath, s3Key, contentType) => {
  const fileStream = fs.createReadStream(filePath);

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: s3Key, // S3 key will include the directory structure
    Body: fileStream,
    ContentType: contentType, // Use file mimetype dynamically
  };

  return s3.upload(params).promise();
};

// Function to generate S3 Key based on fileType
const generateS3Key = (
  fileType,
  userId,
  originalFilename,
  reportMonth,
  reportYear
) => {
  let s3Key = `${fileType}/${userId}/`;

  // If the fileType is a productionReport, append the reportMonth and reportYear
  if (fileType === "productionReport") {
    s3Key += `${reportYear}-${reportMonth}/`;
  }

  // Append timestamp and original filename to s3Key
  s3Key += `${Date.now()}-${originalFilename}`;

  return s3Key;
};

// Function to handle file upload for production
const uploadFileForProduction = asynchandler(async (req, res) => {
  console.log("ravi");
  const { fileType, reportMonth, reportYear } = req.body;
  const { file } = req;
  const userId = req.user._id;
  console.log("userId:", userId);
  console.log("fileType:", fileType);
  if (!file) {
    return res.status(400).json({ message: "File is required" });
  }

  // Generate the S3 key based on fileType and other parameters
  const s3Key = generateS3Key(
    fileType,
    userId,
    file.originalname,
    reportMonth,
    reportYear
  );
  const localFilePath = path.join(tempDirectory, file.filename);

  console.log("S3 key:", s3Key);

  try {
    // Upload file to S3
    const s3Response = await uploadToS3(localFilePath, s3Key, file.mimetype);

    // Save file metadata including S3 URL to MongoDB
    const newFile = new FileUpload({
      productionUser: userId,
      fileType,
      s3Key,
      s3FileUrl: s3Response.Location, // Store the public S3 file URL
      reportMonth: fileType === "productionReport" ? reportMonth : null,
      reportYear: fileType === "productionReport" ? reportYear : null,
    });
    await newFile.save();

    // Remove the file from temp folder
    fs.unlinkSync(localFilePath);

    res
      .status(201)
      .json({ message: "File uploaded successfully", data: newFile });
  } catch (error) {
    // If an error occurs during file system operations or any other step
    console.error("Error during file upload:", error);

    if (error.code === "ENOENT") {
      return res
        .status(500)
        .json({ message: "File not found in temp directory" });
    }

    return res
      .status(500)
      .json({ message: "Error uploading file", error: error.message });
  }
});

// Controller for productionUpdateReport
const productionUpdateReport = async (req, res) => {
  try {
    const { year, month, day, mtdType, value } = req.body;
    const userId = req.user._id;
    console.log(year, month, day, mtdType, value);

    // Find or create the report for the production user
    let report = await MTDReport.findOne({ productionUser: userId });
    if (!report) {
      report = new MTDReport({
        productionUser: userId,
        updatedBy: "production",
      });
    }

    // Initialize nested structures if they don't exist
    if (!report.yearReport) {
      report.yearReport = {};
    }
    if (!report.yearReport[year]) {
      report.yearReport[year] = { year, months: {}, yearReport: {} };
    }
    const yearData = report.yearReport[year];

    if (!yearData.months[month]) {
      yearData.months[month] = { month, days: {}, monthReport: {} };
    }
    const monthData = yearData.months[month];

    if (!monthData.days[day]) {
      monthData.days[day] = { todayReport: {}, lastUpdated: new Date() };
    }
    const dayData = monthData.days[day];

    // Update today's report
    dayData.todayReport[mtdType] = value;
    dayData.lastUpdated = new Date();

    // Update cumulative month report till the given day
    monthData.monthReport[mtdType] =
      (monthData.monthReport[mtdType] || 0) + value;

    // Update cumulative year report
    yearData.yearReport[mtdType] = (yearData.yearReport[mtdType] || 0) + value;

    // Save the updated report
    report.markModified("yearReport");
    await report.save();

    res.status(200).json({ message: "Report updated successfully." });
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({ error: error.message });
  }
};

// Function to handle stock update for production
const updateStocksForProduction = asynchandler(async (req, res) => {
  const { packedStocks, unpackedStocks } = req.body;
  const userId = req.user._id;

  if (!packedStocks || !unpackedStocks) {
    return res
      .status(400)
      .json({ message: "Packed and unpacked stocks are required" });
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set time to start of the day

    // Find existing record for today for the user
    let totalStocks = await TotalStocks.findOne({ user: userId, date: today });

    if (totalStocks) {
      // Update the existing entry with the new values
      totalStocks.packedStocks = packedStocks;
      totalStocks.unpackedStocks = unpackedStocks;
    } else {
      // Create a new entry if none exists for today
      totalStocks = new TotalStocks({
        user: userId,
        date: today,
        packedStocks,
        unpackedStocks,
      });
    }

    await totalStocks.save();
    res
      .status(200)
      .json({ message: "Stocks updated successfully", totalStocks });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});
export {
  uploadFileForProduction,
  upload,
  productionUpdateReport,
  updateStocksForProduction,
};
