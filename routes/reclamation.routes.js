
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

router.post("/",createReclamation);
// routes/reclamation.routes.js
router.get("/admin", requireAdmin, adminListReclamations);
router.get("/admin/:id/pdf", requireAdmin, streamReclamationPdf);
router.get("/admin/:id/document/:index", requireAdmin, streamReclamationDocument);

export default router;
