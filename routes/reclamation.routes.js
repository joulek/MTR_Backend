import { Router } from "express";
import {
  listReclamations,
  getReclamationById,
  createReclamation,
  updateReclamation,
  deleteReclamation,
} from "../controllers/reclamation.controller.js";

const router = Router();

router.get("/", listReclamations);
router.get("/:id", getReclamationById);
router.post("/", createReclamation);
router.put("/:id", updateReclamation);
router.delete("/:id", deleteReclamation);

export default router;
