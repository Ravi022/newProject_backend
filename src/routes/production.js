import { Router } from "express";
import multer from "multer"; // Import multer
import { authProduction, verifyjwt } from "../middleware/auth.js";
import { uploadFileForProduction } from "../controller/production.js";

// Multer setup for storing files in public/temp
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/temp"); // Destination for the uploaded files
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`); // File naming convention
  },
});

// Define the upload middleware using multer
const upload = multer({ storage });

const router = Router();

// Route for production person to upload files
router
  .route("/upload")
  .post(
    verifyjwt,
    authProduction,
    upload.single("file"),
    uploadFileForProduction
  );

export default router;