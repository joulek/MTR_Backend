// routes/devis.routes.js
import { Router } from "express";
import { createFromDemande, getNextDevisNumberPreview ,getDevisByDemande} from "../controllers/controller.devis.js";

const router = Router();

// (facultatif) preview du prochain N° devis
router.get("/next-number", getNextDevisNumberPreview);

// création d’un devis à partir d’une demande (auto-détection du modèle)
router.post("/from-demande/:demandeId", createFromDemande);
 
router.get("/by-demande/:demandeId", getDevisByDemande);   // ⚠️ AVANT "/:id" si tu en as un
export default router;
