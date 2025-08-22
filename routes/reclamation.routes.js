
// routes/admin.reclamations.routes.js
import { Router } from "express";
import {
  adminListReclamations,
  createReclamation,
  streamReclamationDocument,
  streamReclamationPdf
} from "../controllers/reclamation.controller.js";import  auth  from "../middleware/auth.js"; // adapte à ton projet
import { requireAdmin } from "../middleware/auth.js";
const router = Router();

<<<<<<< HEAD
// limites d'upload (évite 413 côté app + nginx client_max_body_size)
const upload = multer({
  limits: { fileSize: 5 * 1024 * 1024, files: 20 }, // 5 Mo / fichier, 10 fichiers
});
router.post("/", upload.array("piecesJointes"), createReclamation);
=======
router.post("/",createReclamation);
// routes/reclamation.routes.js
router.get("/admin", requireAdmin, adminListReclamations);
router.get("/admin/:id/pdf", requireAdmin, streamReclamationPdf);
router.get("/admin/:id/document/:index", requireAdmin, streamReclamationDocument);
>>>>>>> b0d2674a13b7045e60015f5142685f1ca8409a66

export default router;
