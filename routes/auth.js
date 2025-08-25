import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import auth from "../middleware/auth.js";
import { clearAuthCookies, checkEmailExists } from "../controllers/authController.js";

const router = Router();

const IS_PROD = process.env.NODE_ENV === "production";
const COOKIE_DOMAIN = IS_PROD ? (process.env.COOKIE_DOMAIN || ".onrender.com") : undefined;
const BASE_COOKIE = {
  httpOnly: true,
  sameSite: "lax",
  secure: IS_PROD,
  path: "/",
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

router.get("/whoami", auth, (req, res) => {
  res.json({ id: req.user.id, role: req.user.role });
});

router.post("/login", async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    const remember = ("" + rememberMe).toLowerCase() === "true" || rememberMe === true;

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) return res.status(400).json({ message: "Identifiants invalides" });

    const ok = await bcrypt.compare(password, user.passwordHash || "");
    if (!ok) return res.status(400).json({ message: "Identifiants invalides" });

    // ✅ remets la durée du JWT
    const jwtTtl = remember ? "30d" : "1d";

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: jwtTtl });

    const tokenCookieOpts = remember ? { ...BASE_COOKIE, maxAge: 30 * 24 * 60 * 60 * 1000 } : BASE_COOKIE;

    // ⚠️ nom du cookie = "token" → ton middleware doit lire req.cookies.token
    res.cookie("token", token, tokenCookieOpts);

    const roleCookieOpts = {
      sameSite: tokenCookieOpts.sameSite,
      secure: tokenCookieOpts.secure,
      path: tokenCookieOpts.path,
      ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
      ...(remember ? { maxAge: tokenCookieOpts.maxAge } : {}),
    };
    res.cookie("role", user.role, roleCookieOpts);

    const { passwordHash, ...safeUser } = user.toObject();
    user.lastLogin = new Date();
    await user.save();

    res.json({ success: true, role: user.role, user: safeUser });
  } catch (err) {
    console.error("login ERROR:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

router.post("/check-email", checkEmailExists);

router.post("/logout", (req, res) => {
  clearAuthCookies(res);
  res.json({ success: true, message: "Déconnecté" });
});

// ✅ manquait chez toi
export default router;
