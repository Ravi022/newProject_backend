import { Router } from "express";
import { verifyjwt } from "../middleware/auth.js";
import { changeCurrentPassword, logoutUser } from "../controller/common.js";

const router = Router();

router.route("/changePassword").post(verifyjwt, changeCurrentPassword);
router.route("/logoutUser").get(verifyjwt, logoutUser);

export default router;
