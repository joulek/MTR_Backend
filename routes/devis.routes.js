import { Router } from "express";
import { getAllDevisNumeros } from "../controllers/devis.controller.js";

const router = Router();

router.get("/", getAllDevisNumeros);     // liste tous les devis

export default router;
