// routes/auth.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { clearAuthCookies } from "../controllers/authController.js";

const router = Router();

/** POST /api/auth/login : pose les cookies HTTP-only */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Lire le hash du mot de passe
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) return res.status(400).json({ message: "Utilisateur introuvable" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ message: "Mot de passe incorrect" });

    // Générer le JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Définir les cookies
    const common = {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
      path: "/",
    };

    res.cookie("token", token, { httpOnly: true, ...common });
    res.cookie("role", user.role, { httpOnly: false, ...common });

    // Réponse (sans renvoyer le token dans le body)
    res.json({ success: true, role: user.role, user: user.toJSON() });
  } catch (err) {
    console.error("login ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/** POST /api/auth/logout : supprime les cookies */
router.post("/logout", (req, res) => {
  clearAuthCookies(res);
  res.json({ success: true, message: "Déconnecté" });
});

export default router;
