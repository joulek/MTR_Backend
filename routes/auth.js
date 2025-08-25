import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import auth from "../middleware/auth.js"; // middleware d'authentification
import { clearAuthCookies } from "../controllers/authController.js";
import { checkEmailExists } from "../controllers/authController.js";

const router = Router();

// --- Cookie helpers ---
const IS_PROD = process.env.NODE_ENV === "production";
// En prod, on met le domaine parent pour couvrir front & back sur *.onrender.com
const COOKIE_DOMAIN = IS_PROD
  ? process.env.COOKIE_DOMAIN || ".onrender.com"
  : undefined;
const BASE_COOKIE = {
  httpOnly: true,
  sameSite: "lax", // OK car même "site" (onrender.com)
  secure: IS_PROD, // obligatoire en prod/https
  path: "/",
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

/** POST /api/auth/login : pose les cookies HTTP-only */
router.get("/whoami", auth, (req, res) => {
  res.json({ id: req.user.id, role: req.user.role });
});
router.post("/login", async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const remember =
      ("" + rememberMe).toLowerCase() === "true" || rememberMe === true;

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user)
      return res.status(400).json({ message: "Identifiants invalides" });

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) return res.status(400).json({ message: "Identifiants invalides" });

    // Durée JWT selon remember
    //    const jwtTtl = remember ? "30d" : "1d";

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: jwtTtl }
    );

    const tokenCookieOpts = remember
      ? { ...BASE_COOKIE, maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 jours
      : BASE_COOKIE;

    // ⚠️ Assure-toi que TON middleware `auth` lit bien "token"
    //    (si ton middleware attend "session", renomme ici -> "session")
    res.cookie("token", token, tokenCookieOpts);

    // Cookie role (non-HttpOnly, utile côté front si tu l’utilises)

    const roleCookieOpts = {
      sameSite: tokenCookieOpts.sameSite,
      secure: tokenCookieOpts.secure,
      path: tokenCookieOpts.path,
      ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
      ...(remember ? { maxAge: tokenCookieOpts.maxAge } : {}), // session si non coché
    };
    res.cookie("role", user.role, roleCookieOpts);

    // Nettoyage & dernière connexion
    const { passwordHash, ...safeUser } = user.toObject();
    user.lastLogin = new Date();
    await user.save();

    // Réponse (sans token, on s'appuie sur le cookie HttpOnly)
    res.json({
      success: true,
      role: user.role,
      user: safeUser,
    });
  } catch (err) {
    console.error("login ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});
router.post("/check-email", checkEmailExists);

/** POST /api/auth/logout : supprime les cookies */
router.post("/logout", (req, res) => {
  clearAuthCookies(res);
  res.json({ success: true, message: "Déconnecté" });
});
