// controllers/authController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

/** Utilitaire commun pour poser les cookies */
function setAuthCookies(res, { token, role }) {
  const common = {
    sameSite: "lax",                                   // "none" si front sur autre domaine + HTTPS
    secure: process.env.NODE_ENV === "production",     // true en prod HTTPS
    maxAge: 7 * 24 * 60 * 60 * 1000,                   // 7 jours
    path: "/",
  };
  res.cookie("token", token, { httpOnly: true, ...common });
  res.cookie("role", role, { httpOnly: false, ...common });
}

/** Nettoyer les cookies d'auth */
export function clearAuthCookies(res) {
  const common = { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" };
  res.clearCookie("token", common);
  res.clearCookie("role", common);
}

/** Inscription client (pose cookies) */
export const registerClient = async (req, res) => {
  try {
    const {
      email,
      password,
      nom,
      prenom,
      numTel,
      adresse,
      accountType,   // "personnel" | "societe" (obligatoire)
      personal,      // optionnel si accountType === "personnel"
      company        // optionnel si accountType === "societe"
    } = req.body;

    if (!email || !password || !nom || !prenom) {
      return res.status(400).json({ message: "Champs requis: email, password, nom, prenom" });
    }

    // ✅ Type de compte obligatoire et validé
    if (!accountType || !["personnel", "societe"].includes(accountType)) {
      return res.status(400).json({ message: "Le type de compte est obligatoire (personnel ou societe)" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email déjà utilisé" });

    const passwordHash = await bcrypt.hash(password, 10);

    const doc = {
      role: "client",
      accountType,
      email,
      passwordHash,
      nom,
      prenom,
      numTel: numTel || "",
      adresse: adresse || "",
    };

    // On n'ajoute des blocs détaillés que si fournis (et correspondant au type)
    if (accountType === "personnel" && personal && typeof personal === "object") {
      doc.personal = personal;
    }
    if (accountType === "societe" && company && typeof company === "object") {
      doc.company = company;
    }

    const user = await User.create(doc);

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

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

/** Inscription admin (pose cookies) */
export const registerAdmin = async (req, res) => {
  try {
    const { email, password, nom, prenom } = req.body;
    if (!email || !password) return res.status(400).json({ message: "email & password obligatoires" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email déjà utilisé" });

    const passwordHash = await bcrypt.hash(password, 10);

    // Pour ne pas casser la contrainte `required: true` sur accountType
    const user = await User.create({
      role: "admin",
      accountType: "personnel",       // valeur par défaut côté admin
      email,
      passwordHash,
      nom: nom || "Admin",
      prenom: prenom || "",
    });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    setAuthCookies(res, { token, role: user.role });

    res.status(201).json({ success: true, user: user.toJSON(), role: user.role });
  } catch (e) {
    console.error("registerAdmin ERROR:", e);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

/** (Optionnel) endpoint de debug pour vérifier cookies */
export const whoami = async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ message: "Non authentifié" });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) return res.status(401).json({ message: "Session invalide" });
    res.json({ success: true, user: user.toJSON() });
  } catch (e) {
    res.status(401).json({ message: "Session invalide" });
  }
};
