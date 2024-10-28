import { Router } from "express";
import { verifyjwt } from "../middleware/auth.js";
import {
  changeCurrentPassword,
  logoutUser,
  refresh_token,
} from "../controller/common.js";

const router = Router();

router.route("/changePassword").post(verifyjwt, changeCurrentPassword);
router.route("/logoutUser").get(verifyjwt, logoutUser);
router.route("/token").post(refresh_token);

export default router;
