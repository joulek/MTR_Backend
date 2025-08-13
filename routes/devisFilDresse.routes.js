// routes/devis.routes.js
import { Router } from "express";
import auth, { only } from "../middleware/auth.js";
import multer from "multer";
import { createDevisFilDresse } from "../controllers/devisFilDresse.controller.js";

const upload = multer(); // mémoire; champ "docs"
const router = Router();

router.post("/devis/fil", auth, only("client"), upload.array("docs"), createDevisFilDresse);

export default router;
