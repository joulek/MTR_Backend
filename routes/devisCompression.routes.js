import express from "express";
import multer from "multer";
import { createDevisCompression, getAllDevisCompression } from "../controllers/devisCompression.controller.js";

const router = express.Router();

// Config Multer pour upload fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// Routes
router.post("/", upload.array("docs"), createDevisCompression);
router.get("/", getAllDevisCompression);

export default router;
