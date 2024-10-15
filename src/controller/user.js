import { asynchandler } from "../utils/asynchandler.js";
import { ApiError } from "../utils/apierror.js";
import { User } from "../models/user.js";
// import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Target } from "../models/target.js";
import { Task } from "../models/task.js";
import { GlobalPermission } from "../models/permission.js";
import { ApiResponse } from "../utils/apiresponse.js";
import jwt from "jsonwebtoken";
//

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

const registerUser = asynchandler(async (req, res) => {
  // get user details (validation)
  // put it into  mongodb( if new user)(chek old user) (you have to make a object)
  //sent success msg(check for user creation) (but remove password and refresh token form response data.)
  // console.log(req.body);
  const { fullName, jobId, password, area, role } = req.body;
  console.log(fullName, jobId, password, area, role);
  if (
    [fullName, jobId, password, area, role].some((field) => field?.trim === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  //find the existing user (jobIdor eamil) (helps to give error)
  const existedUser = await User.findOne({ $or: [{ jobId }] });
  if (existedUser) {
    throw new ApiError(409, "User with  jobId already exists.");
  }
  const user = await User.create({
    fullName,
    password,
    jobId,
    area,
    role,
  });
  console.log("user :", user);
  //it check weather user is created(if created then remove password and refreshToken (we user select method in which we pass field which we don't required(put it in a string with a -ve symbol)))
  // or not .
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

const loginUser = asynchandler(async (req, res) => {
  // req.body-> jobIdor email ,password
  // find the user if found (proceed further ) throw apiError(register first)
  // compare password
  //  access and refresh token
  // send cookies
  // console.log("login User :");

  const { jobId, password } = req.body;
  console.log(jobId, password);
  if (!jobId) {
    return new ApiError(400, "jobId required");
  }
  const user = await User.findOne({ $or: [{ jobId }] });

  if (!user) {
    return new ApiError(400, "User does not exit");
  }
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    return new ApiError(400, "Enter correct Password");
  }
  const { refreshToken, accessToken } = await generateAccessandRefreshToken(
    user._id
  );
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  console.log("options", options);
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User LoggedIn Successfully"
      )
    );
});

const logoutUser = asynchandler(async (req, res) => {
  //clear cookies
  // console.log("refreshToken :", Headers);
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logout successfully"));
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

const changeCurrentPassword = asynchandler(async (req, res) => {
  // old password.
  // find user validate user.
  const { newPassword, oldPassword } = req.body;

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(400, "User not found ");
  }
  const isPasswordValid = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid Password");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

//jobId of salesperson(jobId) , description of target(tasks)
const assignDailyTasksToSelf = asynchandler(async (req, res) => {
  const { jobId, tasks } = req.body;

  // Validate input
  if (!jobId || !tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({
      message: "JobId and an array of tasks with descriptions are required.",
    });
  }

  try {
    // Check global permission for task assignment
    const globalPermission = await GlobalPermission.findOne({});
    console.log("Global Permission:", globalPermission.canAssignTasks); // Log globalPermission for debugging
    if (!globalPermission || !globalPermission.canAssignTasks) {
      return res.status(403).json({
        message: "Task assignment is not allowed for salespersons.",
      });
    }

    // Find the salesperson by jobId
    const salesperson = await User.findOne({ jobId, role: "salesperson" });
    if (!salesperson) {
      return res.status(404).json({ message: "Salesperson not found." });
    }

    // Get today's date (start of the day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Separate tasks into regular and extra tasks
    const newTasks = tasks.map((task) => ({
      description: task.description,
      isCompleted: false, // Newly created tasks are not completed by default
      isExtraTask: task.isExtraTask || false, // Identify if it's an extra task
      date: today, // Assign today's date to each task
      userId: salesperson._id, // Link the task to the salesperson
    }));

    // Insert the tasks directly into the Task collection
    await Task.insertMany(newTasks);

    // Respond with the tasks added
    res.status(200).json({
      message: "Tasks successfully assigned for today.",
      tasks: newTasks,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// jobId of salesperson (jobId) , date/month/year of day to retrieve data
const retrieveDailyTaskCompleted = asynchandler(async (req, res) => {
  const { jobId, day, month, year } = req.body;

  // Validate input
  if (!jobId || !month || !year) {
    return res.status(400).json({
      message: "JobId, month, and year are required.",
    });
  }

  try {
    // Find the salesperson by jobId
    const salesperson = await User.findOne({ jobId, role: "salesperson" });
    if (!salesperson) {
      return res.status(404).json({ message: "Salesperson not found." });
    }

    // Prepare date range for the month
    const startDate = new Date(year, month - 1, 1); // Start of the month
    const endDate = new Date(year, month, 0); // End of the month

    // Optionally, filter by a specific day
    let targetDate;
    if (day) {
      targetDate = new Date(year, month - 1, day); // Specific day
    }

    // Find the target for the salesperson for the specified date (if day is provided) or month
    const query = {
      userId: salesperson._id,
      date: targetDate ? targetDate : { $gte: startDate, $lte: endDate }, // Specific day or entire month
    };

    const target = await Target.findOne(query);

    if (!target) {
      return res
        .status(404)
        .json({ message: "No target found for the specified period." });
    }

    // Prepare the response object
    const response = {
      assignedMonthlyTarget: target.assignedMonthlyTarget, // Assigned target for the month
      dailyCompletedTarget: target.dailyCompletedTarget, // Completed target for the selected day
      totalMonthlyTaskCompleted: target.totalMonthlyTaskCompleted, // Total tasks completed for the month
      tasks: target.tasks.map((task) => ({
        description: task.description,
        isCompleted: task.isCompleted ? "Completed" : "Pending", // Mark each task's status
      })),
    };

    // Respond with the target details
    res.status(200).json({
      message: `Target data for ${day ? `day ${day}` : "month"} ${month}, ${year}.`,
      data: response,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

//jobId of salesperson(jobId),date,month,year,completedTarget;
const updateDailyTargetCompletion = asynchandler(async (req, res) => {
  const { completedTarget, day, month, year } = req.body;

  // Validate input
  if (completedTarget === undefined || !day || !month || !year) {
    return res.status(400).json({
      message: "Completed target, day, month, and year are required.",
    });
  }

  try {
    // Get jobId of the salesperson from req.user
    const { jobId } = req.user; // Ensure jobId is available in req.user

    // Find the salesperson by jobId
    const salesperson = await User.findOne({ jobId, role: "salesperson" });
    if (!salesperson) {
      return res.status(404).json({ message: "Salesperson not found." });
    }

    // Create the specific date for the target update
    const targetDate = new Date(year, month - 1, day); // Format: (year, month index, day)
    targetDate.setHours(0, 0, 0, 0); // Set to start of the day for consistency

    // Set the start and end of the month for querying the monthly target
    const startOfMonth = new Date(year, month - 1, 1); // First day of the month
    const endOfMonth = new Date(year, month, 0); // Last day of the month

    // Check if a monthly target has been assigned by the admin for the current month
    let monthlyTarget = await Target.findOne({
      userId: salesperson._id,
      date: { $gte: startOfMonth, $lte: endOfMonth },
      createdby: "admin", // Ensure that the monthly target was created by the admin
    });

    // If no monthly target exists, respond with an error
    if (!monthlyTarget) {
      return res.status(404).json({
        message: "No monthly target assigned by the admin for this month.",
      });
    }

    // Fetch or create the target for the specific day
    let dailyTarget = await Target.findOne({
      userId: salesperson._id,
      date: targetDate,
    });

    // If no target exists for the given day, create a new target document for the day
    if (!dailyTarget) {
      dailyTarget = new Target({
        userId: salesperson._id,
        date: targetDate,
        assignedMonthlyTarget: monthlyTarget.assignedMonthlyTarget, // Set assigned monthly target for context
        dailyCompletedTarget: completedTarget, // Set the daily completed target
        totalMonthlyTaskCompleted: completedTarget, // Initialize total monthly task completed
        createdby: "salesperson", // This target was created by the salesperson
      });
    } else {
      // Update existing daily target
      dailyTarget.dailyCompletedTarget += completedTarget; // Increment daily completed target
      dailyTarget.totalMonthlyTaskCompleted += completedTarget; // Increment total monthly target
    }

    // Update the cumulative total for the monthly target as well
    monthlyTarget.totalMonthlyTaskCompleted += completedTarget; // Increment cumulative monthly total
    monthlyTarget.dailyCompletedTarget += completedTarget; // Increment daily completed target

    // Save both the updated monthly target and daily target
    await dailyTarget.save();
    await monthlyTarget.save();

    // Respond with the updated daily target and monthly target
    res.status(200).json({
      message: `Daily target updated successfully for ${day}/${month}/${year}.`,
      dailyTarget: {
        assignedMonthlyTarget: dailyTarget.assignedMonthlyTarget,
        dailyCompletedTarget: dailyTarget.dailyCompletedTarget,
        totalMonthlyTaskCompleted: dailyTarget.totalMonthlyTaskCompleted,
      },
      monthlyTarget: {
        assignedMonthlyTarget: monthlyTarget.assignedMonthlyTarget,
        dailyCompletedTarget: monthlyTarget.dailyCompletedTarget,
        totalMonthlyTaskCompleted: monthlyTarget.totalMonthlyTaskCompleted,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

//jobId of salesperson(jobId),date,month,year.
const getSalespersonMonthlyStatsAndDailyTasks = asynchandler(
  async (req, res) => {
    const { day, month, year } = req.body;
    const jobId = req.user.jobId;

    // Validate input
    if (!jobId || !day || !month || !year) {
      return res.status(400).json({
        message: "JobId, day, month, and year are required.",
      });
    }

    try {
      // Find the salesperson by jobId
      const salesperson = await User.findOne({ jobId, role: "salesperson" });
      if (!salesperson) {
        return res.status(404).json({ message: "Salesperson not found." });
      }

      // Set the start and end of the requested month for querying monthly target
      const startOfMonth = new Date(year, month - 1, 1); // First day of the month
      const endOfMonth = new Date(year, month, 0); // Last day of the month

      // Fetch the salesperson's monthly target (created by admin) within the specified month
      const monthlyTarget = await Target.findOne({
        userId: salesperson._id,
        date: { $gte: startOfMonth, $lte: endOfMonth },
        createdby: "admin",
      });

      // Set the start and end of the specific day for task retrieval (daily target by salesperson)
      const startOfDay = new Date(year, month - 1, day);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(year, month - 1, day);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch all tasks for the specified day (daily target created by salesperson)
      const tasks = await Task.find({
        userId: salesperson._id,
        date: { $gte: startOfDay, $lte: endOfDay },
      });

      // Separate regular tasks and extra completed tasks
      const regularTasks = tasks.filter((task) => !task.isExtraTask);
      const extraCompletedTasks = tasks.filter((task) => task.isExtraTask);

      // Fetch daily target (created by admin) for the specific day
      const dailyTarget = await Target.findOne({
        userId: salesperson._id,
        date: startOfDay, // Look for the exact date
        createdby: "salesperson",
      });

      // Determine the daily completed target
      const dailyCompletedTarget = dailyTarget
        ? dailyTarget.dailyCompletedTarget
        : 0; // Return 0 if no daily target found

      // If no monthly target is found
      if (!monthlyTarget) {
        return res.status(404).json({
          message: `No target data found for ${month}/${year}.`,
        });
      }

      // Respond with both monthly and daily targets along with tasks
      res.status(200).json({
        message: `Monthly and daily targets for Job ID: ${jobId} on ${day}/${month}/${year}`,
        monthlyAssignedTarget: monthlyTarget.assignedMonthlyTarget,
        monthlyCompletedTarget: monthlyTarget.dailyCompletedTarget,
        dailyCompletedTarget, // Include daily completed target
        regularTasks,
        extraCompletedTasks,
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ message: "Server error. Please try again later." });
    }
  }
);

const canAddTasks = asynchandler(async (req, res) => {
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

    // Find the salesperson by jobId
    const salesperson = await User.findOne({ jobId, role: "salesperson" });
    if (!salesperson) {
      return res.status(404).json({ message: "Salesperson not found." });
    }

    // Get today's date (start of the day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch tasks for the salesperson for today
    const tasks = await Task.find({
      userId: salesperson._id,
      date: today,
    });

    // Separate tasks into completed, regular, and extra tasks
    const completedTasks = tasks.filter(
      (task) => task.isCompleted && !task.isExtraTask
    );
    const extraAddedTasks = tasks.filter((task) => task.isExtraTask);
    const regularTasks = tasks.filter(
      (task) => !task.isCompleted && !task.isExtraTask
    );

    // Respond with task assignment permission and today's tasks
    res.status(200).json({
      canAssignTasks: globalPermission.canAssignTasks,
      tasks: {
        completedTasks,
        regularTasks,
        extraAddedTasks,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

//taskid
const markTaskAsCompleted = asynchandler(async (req, res) => {
  const { taskId } = req.body; // Task ID to be marked as completed

  if (!taskId) {
    return res.status(400).json({ message: "Task ID is required." });
  }

  try {
    // Get the salesperson's jobId from req.user
    const { jobId } = req.user;

    // Find the salesperson by jobId
    const salesperson = await User.findOne({ jobId, role: "salesperson" });
    if (!salesperson) {
      return res.status(404).json({ message: "Salesperson not found." });
    }

    // Find the task by taskId and ensure it belongs to the salesperson
    const task = await Task.findOne({
      _id: taskId,
      userId: salesperson._id, // Ensure the task belongs to the salesperson
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    // Mark the task as completed
    task.isCompleted = true;
    await task.save();

    // Update the daily and monthly task completion in the target model
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const target = await Target.findOne({
      userId: salesperson._id,
      date: today,
    });

    if (target) {
      // Increment daily completed target and total monthly completed target
      target.dailyCompletedTarget += 1;
      target.totalMonthlyTaskCompleted += 1;
      await target.save();
    }

    // Respond with success
    res.status(200).json({
      message: "Task marked as completed successfully.",
      task,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

const addExtraTask = asynchandler(async (req, res) => {
  const { description } = req.body; // Description of the extra task

  // Validate input
  if (!description) {
    return res.status(400).json({ message: "Task description is required." });
  }

  try {
    // Get the salesperson's jobId from req.user
    const { jobId } = req.user;

    // Find the salesperson by jobId
    const salesperson = await User.findOne({ jobId, role: "salesperson" });
    if (!salesperson) {
      return res.status(404).json({ message: "Salesperson not found." });
    }

    // Create the extra task with isCompleted set to true
    const newExtraTask = new Task({
      userId: salesperson._id, // Link the task to the salesperson
      description,
      isCompleted: true, // Mark the extra task as completed
      isExtraTask: true, // Flag as an extra task
      date: new Date(), // Assign current date
    });

    // Save the extra task
    await newExtraTask.save();

    // Respond with the added extra task
    res.status(201).json({
      message: "Extra task added successfully.",
      task: newExtraTask,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refresh_token,
  assignDailyTasksToSelf,
  retrieveDailyTaskCompleted,
  updateDailyTargetCompletion,
  getSalespersonMonthlyStatsAndDailyTasks,
  canAddTasks,
  markTaskAsCompleted,
  addExtraTask,
};
