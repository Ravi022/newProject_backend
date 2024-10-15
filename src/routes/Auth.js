import { Router } from "express";
import { loginUser } from "../controller/user.js";
// import { upload } from "../middlewares/multer.js";
// import { verifyjwt } from "../middlewares/auth.js";

const router = Router();


router.route("/login").post(loginUser);

//secure routes
// router.route("/logout").post(verifyjwt, logoutUser);
// router.route("/refresh-token").post(refresh_token);

export default router;
