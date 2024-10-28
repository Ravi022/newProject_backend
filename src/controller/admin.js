import { asynchandler } from "../utils/asynchandler.js";
import { Target } from "../models/target.js";
import { User } from "../models/user.js";
import { Task } from "../models/task.js";
import { MTDReport } from "../models/mtd.js";
import { TotalStocks } from "../models/totalStocks.js";
import { FileUpload } from "../models/uploadDocument.js";
import { GlobalPermission } from "../models/permission.js";
import AWS from "aws-sdk";
import path from "path";

// Initialize AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID, // Your AWS Access Key
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // Your AWS Secret Access Key
  region: process.env.AWS_REGION, // Your S3 bucket region
});

//jobId of salesperson(jobId),target of current month (target)
const assignMonthlyTargetToSalesperson = asynchandler(async (req, res) => {
  const { jobId, target } = req.body;

  // Validate input data
  if (!jobId || typeof target !== "number") {
    return res
      .status(400)
      .json({ message: "JobId and valid target are required." });
  }

  try {
    // Find the salesperson by jobId and ensure the role is "salesperson"
    const salesperson = await User.findOne({ jobId, role: "salesperson" });

    // If the salesperson is not found
    if (!salesperson) {
      return res.status(404).json({ message: "Salesperson not found." });
    }

    // Get the current month and year
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // Month is 0-indexed (Jan = 0)
    const currentYear = currentDate.getFullYear();

    // Set the start and end of the current month to search for an existing target
    const startOfMonth = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0); // First day of the month
    const endOfMonth = new Date(
      currentYear,
      currentMonth + 1,
      0,
      23,
      59,
      59,
      999
    ); // Last day of the month

    // Check if there is already a target assigned for the current month, created by the admin
    let targetRecord = await Target.findOne({
      userId: salesperson._id,
      date: { $gte: startOfMonth, $lte: endOfMonth },
      createdby: "admin", // Ensure the target was created by the admin
    });

    if (targetRecord) {
      // Update the existing target if found
      targetRecord.assignedMonthlyTarget = target;
      targetRecord.createdby = "admin"; // Update the creator to admin (if needed)
    } else {
      // Create a new target for the salesperson for the current month
      targetRecord = new Target({
        userId: salesperson._id,
        date: currentDate, // Assign the current date
        assignedMonthlyTarget: target,
        dailyCompletedTarget: 0, // Initialize daily completion
        totalMonthlyTaskCompleted: 0, // Initialize total task completion
        createdby: "admin", // Set createdBy to admin
      });
    }

    // Save the target record to the database
    await targetRecord.save();

    // Respond with success
    return res.status(200).json({
      message: `Target of ${target} lakhs assigned to ${salesperson.fullName} (Job ID: ${jobId}).`,
      target: targetRecord,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Server error. Please try again later." });
  }
});

//jobId of salesperson, month, year
const getMonthlyTargetStats = asynchandler(async (req, res) => {
  const { jobId, month, year } = req.body;

  // Validate inputs
  if (!jobId || !month || !year) {
    return res
      .status(400)
      .json({ message: "JobId, month, and year are required." });
  }

  try {
    // Find the salesperson by jobId
    const salesperson = await User.findOne({ jobId, role: "salesperson" });
    if (!salesperson) {
      return res.status(404).json({ message: "Salesperson not found." });
    }

    // Get the start and end date of the month
    const startDate = new Date(year, month - 1, 1); // First day of the month
    const endDate = new Date(year, month, 0); // Last day of the month

    // Retrieve the monthly target assigned to the salesperson
    const monthlyTarget = await Target.findOne({
      userId: salesperson._id,
      date: { $gte: startDate, $lte: endDate }, // Ensure it's for the specified month
    });

    // If no target found for the specified month
    if (!monthlyTarget) {
      return res
        .status(404)
        .json({ message: "No target data found for this month." });
    }

    // Calculate pending target
    const totalAssignedTarget = monthlyTarget.assignedMonthlyTarget;
    const totalCompletedTarget = monthlyTarget.dailyCompletedTarget;
    const totalPendingTarget = totalAssignedTarget - totalCompletedTarget;

    // Respond with target stats
    res.status(200).json({
      message: `Target data for Job ID: ${jobId} for month/year: ${month}/${year}`,
      totalAssignedTarget,
      totalCompletedTarget,
      totalPendingTarget,
      tasks: monthlyTarget.tasks, // Include task details with completion status
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

//canAssignTasks(true/false)
const setTaskAssignmentPermission = asynchandler(async (req, res) => {
  const { canAssignTasks } = req.body; // Boolean value: true/false

  // Validate input
  if (typeof canAssignTasks !== "boolean") {
    return res
      .status(400)
      .json({ message: "Invalid input. Expected a boolean value." });
  }

  try {
    // Ensure only one global permission document exists
    const permission = await GlobalPermission.findOneAndUpdate(
      {}, // We assume only one global settings document
      { canAssignTasks }, // Update the canAssignTasks field
      { new: true, upsert: true } // Return updated doc, create if not found
    );

    res.status(200).json({
      message: `Task assignment permission set to ${canAssignTasks}`,
      permission,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

//set permission
const canSalespersonAddTasks = asynchandler(async (req, res) => {
  try {
    const { jobId } = req.user; // Extract jobId from req.user

    // Fetch global permission settings
    const globalPermission = await GlobalPermission.findOne({});

    // Check if global permission exists
    if (!globalPermission) {
      return res.status(404).json({
        message: "Global permission settings not found.",
      });
    }

    // Find the admin by jobId
    const admin = await User.findOne({ jobId, role: "admin" });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found." });
    }

    // Respond with task assignment permission
    res.status(200).json({
      canAssignTasks: globalPermission.canAssignTasks,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// Admin view the latest file uploaded for a given fileType (POST request)
const adminViewFile = asynchandler(async (req, res) => {
  const { fileType } = req.body; // Get fileType from request body
  console.log("fileType:", fileType);

  // Find the latest file by fileType
  const latestFile = await FileUpload.findOne({ fileType })
    .sort({ uploadedAt: -1 }) // Sort by latest uploaded time
    .limit(1); // Get the latest file only

  // If no file is found, return an error
  if (!latestFile) {
    return res
      .status(404)
      .json({ message: `No file found for type ${fileType}` });
  }

  // Return the latest file's URL and relevant details
  res.status(200).json({
    message: "Latest file found",
    fileType: latestFile.fileType,
    uploadedAt: latestFile.uploadedAt,
    s3FileUrl: latestFile.s3FileUrl,
    s3Key: latestFile.s3Key,
  });
});

// Admin download file from S3 using s3Key from request body
const adminDownloadFile = asynchandler(async (req, res) => {
  const { s3Key } = req.body; // Get s3Key from request body

  if (!s3Key) {
    return res.status(400).json({ message: "s3Key is required" });
  }

  const params = {
    Bucket: process.env.S3_BUCKET_NAME, // S3 bucket name from env
    Key: s3Key, // S3 key (path) provided in the request body
  };

  // Get the file from S3
  s3.getObject(params, (err, data) => {
    if (err) {
      console.error("Error downloading file from S3:", err);
      return res
        .status(500)
        .json({ message: "Error downloading file from S3" });
    }

    // Set the response headers for downloading the file
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${path.basename(s3Key)}`
    );
    res.setHeader("Content-Type", data.ContentType);
    console.log("res.Body", data.Body);

    // Send the file data
    res.send(data.Body);
  });
});

//Production Reports from Last 4 Months
const adminViewLastFourMonthsReports = asynchandler(async (req, res) => {
  const currentDate = new Date();
  const fourMonthsAgo = new Date();
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

  // Fetch the reports for the last 4 months
  const reports = await FileUpload.find({
    fileType: "productionReport",
    reportYear: { $gte: fourMonthsAgo.getFullYear() },
    reportMonth: { $gte: fourMonthsAgo.getMonth() + 1 },
  }).sort({ reportYear: -1, reportMonth: -1 });

  if (!reports || reports.length === 0) {
    return res
      .status(404)
      .json({ message: "No production reports found for the last 4 months" });
  }

  // Return the list of reports along with file URLs
  res.status(200).json(
    reports.map((report) => ({
      reportMonth: report.reportMonth,
      reportYear: report.reportYear,
      uploadedAt: report.uploadedAt,
      s3FileUrl: report.s3FileUrl, // Return the S3 file URL
    }))
  );
});

// Controller for adminViewTasks
const adminViewTasks = async (req, res) => {
  try {
    // Extract body parameters
    const { date, month, year, jobId } = req.body;

    // Validate required parameters
    if (!date || !month || !year || !jobId) {
      return res.status(400).json({ message: "Missing required parameters." });
    }

    // Fetch user based on jobId
    const user = await User.findOne({ jobId });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Create a Date object for the specified day
    const selectedDate = new Date(year, month - 1, date);

    // Find all tasks for the user on the selected date
    const tasks = await Task.find({
      userId: user._id,
      date: {
        $gte: new Date(selectedDate.setHours(0, 0, 0, 0)),
        $lt: new Date(selectedDate.setHours(23, 59, 59, 999)),
      },
    });

    // Categorize tasks into completed, incomplete, and extra
    const completedTasks = tasks.filter(
      (task) => task.isCompleted && !task.isExtraTask
    );
    const incompleteTasks = tasks.filter((task) => !task.isCompleted);
    const extraTasks = tasks.filter(
      (task) => task.isExtraTask && task.isCompleted
    );

    // Return the response with categorized tasks
    res.status(200).json({
      date: selectedDate.toISOString().split("T")[0],
      jobId: user.jobId,
      tasks: tasks.map((task) => ({
        taskId: task._id,
        taskDescription: task.description,
        status: task.isCompleted ? "completed" : "pending",
      })),
      completedTasks: completedTasks.map((task) => ({
        taskId: task._id,
        taskDescription: task.description,
      })),
      incompleteTasks: incompleteTasks.map((task) => ({
        taskId: task._id,
        taskDescription: task.description,
      })),
      extraTasks: extraTasks.map((task) => ({
        taskId: task._id,
        taskDescription: task.description,
      })),
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// Controller for adminFetchReport
const adminFetchReport = async (req, res) => {
  try {
    const { year, month, day } = req.body;
    const userId = req.productionUserId;

    // Validate required parameters
    if (!userId || !year || !month || !day) {
      return res.status(400).json({ message: "Missing required parameters." });
    }

    // Find the report for the production user
    const report = await MTDReport.findOne({ productionUser: userId }).populate(
      "productionUser"
    );
    if (!report) {
      return res.status(404).json({ message: "Report not found." });
    }

    // Extract the required data
    const yearData = report.yearReport?.[year];
    if (!yearData) {
      return res.status(404).json({ message: "Year data not found." });
    }

    const monthData = yearData.months?.[month];
    if (!monthData) {
      return res.status(404).json({ message: "Month data not found." });
    }

    const dayData = monthData.days?.[day] || { todayReport: {} };

    // Ensure all mtdTypes have a value in dayReport, defaulting to 0 if not found
    const allMtdTypes = ["totaldispatch", "production", "packing", "sales"];
    const dayReport = {};
    allMtdTypes.forEach((type) => {
      dayReport[type] = dayData.todayReport[type] || 0;
    });

    // Calculate month-to-date report till the given day
    const monthReportTillDate = {};
    allMtdTypes.forEach((type) => {
      monthReportTillDate[type] = 0;
      for (let d in monthData.days) {
        if (parseInt(d) <= parseInt(day)) {
          monthReportTillDate[type] += monthData.days[d].todayReport[type] || 0;
        }
      }
    });

    // Return the response with the day and month-to-date report
    res.status(200).json({
      dayReport: dayReport,
      monthReportTillDate: monthReportTillDate, // Cumulative MTD value till the given day
      monthReport: monthData.monthReport, // Total cumulative value for the whole month
    });
  } catch (error) {
    console.error("Error fetching report:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
};

// Controller function to retrieve TotalStocks data

const retrieveStocksData = asynchandler(async (req, res) => {
  const { date, month, year } = req.body;
  const productionUserId = req.productionUserId;

  console.log("productionId", productionUserId);

  // Ensure all three inputs (date, month, year) are provided
  if (!date || !month || !year) {
    return res.status(400).json({
      message: "Please provide all fields: date, month, and year.",
    });
  }

  // Set up the query object based on the provided date, month, and year
  const query = {
    user: productionUserId,
    date: {
      $gte: new Date(year, month - 1, date, 0, 0, 0, 0),
      $lt: new Date(year, month - 1, date, 23, 59, 59, 999),
    },
  };

  try {
    const stocksData = await TotalStocks.findOne(query);

    if (!stocksData) {
      return res
        .status(404)
        .json({ message: "No data found for the given date." });
    }

    // Calculate total stocks (packed + unpacked)
    const totalStocks = stocksData.packedStocks + stocksData.unpackedStocks;

    // Return the packedStocks, unpackedStocks, and calculated totalStocks
    res.status(200).json({
      message: "Stocks data retrieved successfully",
      data: {
        packedStocks: stocksData.packedStocks,
        unpackedStocks: stocksData.unpackedStocks,
        totalStocks: totalStocks,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

export {
  assignMonthlyTargetToSalesperson,
  getMonthlyTargetStats,
  setTaskAssignmentPermission,
  canSalespersonAddTasks,
  adminDownloadFile,
  adminViewLastFourMonthsReports,
  adminViewFile,
  adminViewTasks,
  adminFetchReport,
  retrieveStocksData,
};
