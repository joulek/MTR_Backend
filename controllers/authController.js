// controllers/authController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

/** Utilitaire commun pour poser les cookies */
function setAuthCookies(res, { token, role }) {
  const common = {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    path: "/",
  };
  res.cookie("token", token, { httpOnly: true, ...common });
  res.cookie("role", role, { httpOnly: false, ...common });
}

/** Nettoyage (logout / échec) */
export function clearAuthCookies(res) {
  res.cookie("token", "", { path: "/", maxAge: 0 });
  res.cookie("role", "", { path: "/", maxAge: 0 });
}

export const registerClient = async (req, res) => {
  try {
    const { nom, prenom, email, password, numTel, adresse, personal, company } = req.body;
    if (!nom || !prenom || !email || !password) {
      return res.status(400).json({ message: "nom, prénom, email, password obligatoires" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email déjà utilisé" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      role: "client",
      email,
      passwordHash,
      nom, prenom, numTel, adresse,
      personal: personal || undefined,
      company:  company  || undefined,
    });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

    // ✅ Cookies HTTP-only
    setAuthCookies(res, { token, role: user.role });

    // Ne pas renvoyer de token dans le body
    res.status(201).json({ success: true, user: user.toJSON(), role: user.role });
  } catch (e) {
    console.error("registerClient ERROR:", e);
    if (e.code === 11000 && e.keyPattern?.email) {
      return res.status(400).json({ message: "Email déjà utilisé" });
    }
    res.status(500).json({ message: "Erreur serveur" });
  }
};

export const registerAdmin = async (req, res) => {
  try {
    const { email, password, nom, prenom } = req.body;
    if (!email || !password) return res.status(400).json({ message: "email & password obligatoires" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email déjà utilisé" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      role: "admin",
      email,
      passwordHash,
      nom: nom || "Admin",
      prenom: prenom || "",
    });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    setAuthCookies(res, { token, role: user.role });

    res.status(201).json({ success: true, user: user.toJSON(), role: user.role });
  } catch (e) {
    console.error("registerAdmin ERROR:", e);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
