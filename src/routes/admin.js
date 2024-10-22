import { Router } from "express";
import {
  assignMonthlyTargetToSalesperson,
  getMonthlyTargetStats,
  setTaskAssignmentPermission,
  canSalespersonAddTasks,
  adminViewFile,
  adminDownloadFile,
  adminViewLastFourMonthsReports,
} from "../controller/admin.js";
import { verifyjwt, authAdmin } from "../middleware/auth.js";

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
router
  .route("/files/download")
  .post(verifyjwt, authAdmin, adminDownloadFile);
router.get(
  "/admin/production-reports",
  authAdmin,
  adminViewLastFourMonthsReports
);

export default router;
