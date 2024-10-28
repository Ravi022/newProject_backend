import mongoose from "mongoose";

const totalStocksSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to the User model
      required: true,
    },
    date: {
      type: Date,
      required: true,
      index: true, // Enable searching by date
    },
    packedStocks: {
      type: Number,
      default: 0,
    },
    unpackedStocks: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export const TotalStocks = mongoose.model("TotalStocks", totalStocksSchema);
