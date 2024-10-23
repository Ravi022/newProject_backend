import { Router } from "express";
import {
  assignMonthlyTargetToSalesperson,
  getMonthlyTargetStats,
  setTaskAssignmentPermission,
  canSalespersonAddTasks,
  adminViewFile,
  adminDownloadFile,
  adminViewLastFourMonthsReports,
  adminViewTasks,
  getMTDValues,
} from "../controller/admin.js";
import { verifyjwt, authAdmin } from "../middleware/auth.js";
import { Task } from "../models/task.js";

const router = Router();

router
  .route("/monthlyTarget")
  .post(verifyjwt, authAdmin, assignMonthlyTargetToSalesperson);

router.route("/monthlyStats").post(verifyjwt, authAdmin, getMonthlyTargetStats);
router
  .route("/setTaskPermission")
  .post(verifyjwt, authAdmin, setTaskAssignmentPermission);
router
  .route("/canSalespersonAddTasks")
  .get(verifyjwt, authAdmin, canSalespersonAddTasks);

router.route("/files").post(verifyjwt, authAdmin, adminViewFile);
router.route("/files/download").post(verifyjwt, authAdmin, adminDownloadFile);
router.get(
  "/admin/production-reports",
  authAdmin,
  adminViewLastFourMonthsReports
);

router.route("/adminViewTasks").post(verifyjwt, authAdmin, adminViewTasks);

// Route for admin to fetch all MTD values
router.route("/mtd/values").get(verifyjwt, authAdmin, getMTDValues);

export default router;
