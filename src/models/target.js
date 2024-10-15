import mongoose from "mongoose";
const { Schema } = mongoose;

const targetSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User", // Reference to User model (salesperson)
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now, // Track when the target was assigned or completed
    },
    assignedMonthlyTarget: {
      type: Number,
      required: true,
      default: 0,
    },
    dailyCompletedTarget: {
      type: Number,
      required: true,
      default: 0, // Track daily completed target
    },
    totalMonthlyTaskCompleted: {
      type: Number,
      default: 0,
      required: true,
    },
    createdby: {
      type: String,
      default: "salesperson",
      required: true,
    },
  },
  { timestamps: true }
);

export const Target = mongoose.model("Target", targetSchema);
