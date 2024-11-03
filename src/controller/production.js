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

    // Validate and normalize year
    const normalizedYear = year.toString().padStart(4, "0");
    if (!/^\d{4}$/.test(normalizedYear)) {
      return res
        .status(400)
        .json({ message: "Invalid year format. Must be a 4-digit year." });
    }

    // Validate and normalize month
    const validMonths = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const normalizedMonth =
      month.charAt(0).toUpperCase() + month.slice(1).toLowerCase();
    if (!validMonths.includes(normalizedMonth)) {
      return res
        .status(400)
        .json({ message: "Invalid month. Must be the full month name." });
    }

    // Validate and normalize day
    const normalizedDay = day.toString().padStart(2, "0");
    if (!/^(0[1-9]|[12][0-9]|3[01])$/.test(normalizedDay)) {
      return res
        .status(400)
        .json({ message: "Invalid day format. Must be 01-31." });
    }

    // Validate mtdType
    const validMtdTypes = ["totaldispatch", "production", "packing", "sales"];
    if (!validMtdTypes.includes(mtdType)) {
      return res.status(400).json({
        message:
          "Invalid mtdType. Must be one of: totaldispatch, production, packing, sales.",
      });
    }

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
    if (!report.yearReport[normalizedYear]) {
      report.yearReport[normalizedYear] = {
        year: normalizedYear,
        months: {},
        yearReport: {},
      };
    }
    const yearData = report.yearReport[normalizedYear];

    if (!yearData.months[normalizedMonth]) {
      yearData.months[normalizedMonth] = {
        month: normalizedMonth,
        days: {},
        monthReport: {},
      };
    }
    const monthData = yearData.months[normalizedMonth];

    if (!monthData.days[normalizedDay]) {
      monthData.days[normalizedDay] = {
        todayReport: {},
        lastUpdated: new Date(),
      };
    }
    const dayData = monthData.days[normalizedDay];

    // Check if there is an existing value for mtdType on this day
    const previousValue = dayData.todayReport[mtdType] || 0;

    // Update today's report
    dayData.todayReport[mtdType] = value;
    dayData.lastUpdated = new Date();

    // Adjust month and year report by subtracting the previous value and adding the new value
    monthData.monthReport[mtdType] =
      (monthData.monthReport[mtdType] || 0) - previousValue + value;
    yearData.yearReport[mtdType] =
      (yearData.yearReport[mtdType] || 0) - previousValue + value;

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
  const { year, month, day, packedStocks, unpackedStocks } = req.body;
  const userId = req.user._id;

  console.log(packedStocks, unpackedStocks);

  // Check that all required fields are provided and valid
  if (!year || !month || !day || packedStocks===undefined || unpackedStocks===undefined) {
    return res.status(400).json({
      message:
        "Year, month, day, packedStocks, and unpackedStocks are required",
    });
  }

  // Normalize year, month, and day
  const normalizedYear = year.toString().padStart(4, "0");
  const normalizedMonth = month.toString().padStart(2, "0");
  const normalizedDay = day.toString().padStart(2, "0");

  // Validate that year, month, and day are in the correct format
  if (!/^\d{4}$/.test(normalizedYear)) {
    return res
      .status(400)
      .json({ message: "Invalid year format. Must be a 4-digit year." });
  }

  if (!/^(0[1-9]|1[0-2])$/.test(normalizedMonth)) {
    return res
      .status(400)
      .json({ message: "Invalid month format. Must be 01-12." });
  }

  if (!/^(0[1-9]|[12][0-9]|3[01])$/.test(normalizedDay)) {
    return res
      .status(400)
      .json({ message: "Invalid day format. Must be 01-31." });
  }

  // Construct the date from normalized values
  const date = new Date(
    `${normalizedYear}-${normalizedMonth}-${normalizedDay}`
  );
  date.setHours(0, 0, 0, 0); // Set time to start of the day

  try {
    // Find existing record for the specified date and user
    let totalStocks = await TotalStocks.findOne({ user: userId, date });

    if (totalStocks) {
      // Subtract previous values before updating
      totalStocks.packedStocks = packedStocks;
      totalStocks.unpackedStocks = unpackedStocks;
    } else {
      // Create a new entry if none exists for the specified date
      totalStocks = new TotalStocks({
        user: userId,
        date,
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
