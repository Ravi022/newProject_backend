import mongoose from "mongoose";
const globalPermissionSchema = new mongoose.Schema({
  canAssignTasks: {
    type: Boolean,
    default: false, // Default is false, meaning salespersons cannot assign tasks by default
  },
});

export const GlobalPermission = mongoose.model(
  "GlobalPermission",
  globalPermissionSchema
);
