import { Router } from "express";
import { getAllDevisNumeros ,getNextDevisNumberPreview ,createFromDemande,getDevisByDemande} from "../controllers/devis.controller.js";

const router = Router();

router.get("/", getAllDevisNumeros);     // liste tous les devis
router.get("/admin/next-number", getNextDevisNumberPreview);
router.post("/admin/from-demande/:demandeId", createFromDemande);
// l’URL finale sera /api/admin/devis/by-demande/:demandeId
router.get("/admin/by-demande/:demandeId", getDevisByDemande);
export default router;
