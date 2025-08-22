// routes/reclamation.routes.js
import { Router } from "express";
import multer from "multer";
import {
  createReclamation
} from "../controllers/reclamation.controller.js";

const router = Router();

// limites d'upload (évite 413 côté app + nginx client_max_body_size)
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024, files: 10 }, // 5 Mo / fichier, 10 fichiers
});
router.post("/", upload.array("piecesJointes"), createReclamation);

export default router;
