import mongoose from "mongoose";
const { Schema } = mongoose;

const taskSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User", // Reference to User model (salesperson)
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true, // A string representing the task description
    },
    date: {
      type: Date,
      required: true,
      default: Date.now, // The date the task is assigned/completed
    },
    isCompleted: {
      type: Boolean,
      default: false, // Task is marked as completed or not
      required: true,
    },
    isExtraTask: {
      type: Boolean,
      default: false, // Differentiates between regular and extra completed tasks
      required: true,
    },
  },
  { timestamps: true }
);

export const Task = mongoose.model("Task", taskSchema);
