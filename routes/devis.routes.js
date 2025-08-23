// routes/devis.admin.routes.js
import { Router } from "express";
import auth, { only } from "../middleware/auth.js";
import {
  getAllDevisNumeros,
  getNextDevisNumberPreview,
  createFromDemande,
  getDevisByDemande,
} from "../controllers/devis.controller.js";

const router = Router();
router.post("/admin/from-demande/:demandeId", auth, only("admin"), createFromDemande);
router.get("/admin/next-number/preview", auth, only("admin"), getNextDevisNumberPreview);

// ✅ Endpoints attendus par le Front

router.get("/admin/by-demande/:demandeId",  auth, only("admin"), getDevisByDemande);
// Utilitaires numéros (optionnels mais utiles)
router.get("/", getAllDevisNumeros);


export default router;
