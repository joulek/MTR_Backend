// routes/user.routes.js
import { Router } from "express";
import auth from "../middleware/auth.js";
import { me, updateMe, listUsers } from "../controllers/userController.js";

const router = Router();

// Profil utilisateur connecté
router.get("/me", auth, me);

// Mise à jour du profil
router.patch("/me", auth, updateMe);

// Liste des utilisateurs (admin seulement)
router.get("/", auth, (req, res, next) => {
  if (req.userRole !== "admin") {
    return res.status(403).json({ error: "Accès refusé" });
  }
  next();
}, listUsers);

export default router; // ✅ important pour que l'import dans server.js fonctionne
