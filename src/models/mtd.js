import mongoose from "mongoose";

const dayReportSchema = new mongoose.Schema({
  todayReport: {
    type: Map,
    of: Number, // Stores daily update for each type (totalDispatch, production, packing, sales)
    required: true,
    default: {},
  },
  lastUpdated: {
    type: Date,
    default: Date.now, // Tracks when the report was last updated
  },
});

const monthReportSchema = new mongoose.Schema({
  month: {
    type: String,
    required: true,
  },
  days: {
    type: Object,
    of: dayReportSchema,
    default: {},
  },
  monthReport: {
    type: Object,
    of: Number, // Stores cumulative report for each type (totalDispatch, production, packing, sales) till the given day
    default: {},
  },
});

const yearReportSchema = new mongoose.Schema({
  year: {
    type: String,
    required: true,
  },
  months: {
    type: Object,
    of: monthReportSchema,
    default: {},
  },
  yearReport: {
    type: Object,
    of: Number, // Stores cumulative report for each type (totalDispatch, production, packing, sales)
    default: {},
  },
});

const mtdReportSchema = new mongoose.Schema(
  {
    productionUser: {
      type: mongoose.Schema.Types.ObjectId, // Reference the User schema (production user)
      ref: "User", // This will create a reference to the User model
      required: true,
    },
    yearReport: {
      type: Object,
      of: yearReportSchema,
      default: {},
    },
    updatedBy: {
      type: String,
      enum: ["salesperson", "admin", "production"],
      required: true,
    },
  },
  { timestamps: true }
);

export const MTDReport = mongoose.model("MTDReport", mtdReportSchema);
