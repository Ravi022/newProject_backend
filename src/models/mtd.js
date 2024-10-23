import mongoose from "mongoose";
const Schema = mongoose.Schema;

const mtdSchema = new Schema(
  {
    mtdType: {
      type: String,
      enum: ["dispatchMtd", "productionMtd", "packingMtd", "salesMtd"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      default: 0,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // Linking to your user model
      required: true,
    },
  },
  { timestamps: true }
);

export const MTD = mongoose.model("MTD", mtdSchema);
