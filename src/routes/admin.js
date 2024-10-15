import { Router } from "express";
import {
  assignMonthlyTargetToSalesperson,
  getMonthlyTargetStats,
  setTaskAssignmentPermission,
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

export default router;
