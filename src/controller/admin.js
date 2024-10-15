import { asynchandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/apierror.js";
import { Target } from "../models/target.js";
import { User } from "../models/user.js";
import { GlobalPermission } from "../models/permission.js";

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

export {
  assignMonthlyTargetToSalesperson,
  getMonthlyTargetStats,
  setTaskAssignmentPermission,
};
