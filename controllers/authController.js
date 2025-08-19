// controllers/authController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import nodemailer from "nodemailer";
import crypto from "crypto";
/** Utilitaire commun pour poser les cookies */
// controllers/authController.js
export function clearAuthCookies(res) {
  const common = { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" };
  res.clearCookie("token", common);
  res.clearCookie("role", common);
}


// controllers/authController.js
function setAuthCookies(res, { token, role, remember }) {
  const common = {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };

  // ⏱ durée: 30 jours si remember, sinon cookie de session (pas de maxAge)
  const opts = remember ? { ...common, maxAge: 30 * 24 * 60 * 60 * 1000 } : common;

  res.cookie("token", token, { httpOnly: true, ...opts });
  res.cookie("role", role, { httpOnly: false, ...opts });
}


export const registerClient = async (req, res) => {
  try {
    let {
      email,
      password,
      nom,
      prenom,
      numTel,
      adresse,
      accountType,      // "personnel" | "societe"
      personal,         // ex: { cin, posteActuel }
      company,          // ex: { matriculeFiscal, nomSociete, posteActuel }
    } = req.body;

    // normalisation
    accountType = (accountType || "").toString().trim().toLowerCase();
    nom = (nom || "").trim();
    prenom = (prenom || "").trim();
    email = (email || "").trim();
    numTel = (numTel || "").trim();
    adresse = (adresse || "").trim();

    // validations de base
    if (!email || !password || !nom || !prenom) {
      return res.status(400).json({ message: "Champs requis: email, password, nom, prenom" });
    }
    if (!["personnel", "societe"].includes(accountType)) {
      return res.status(400).json({ message: "Le type de compte est obligatoire (personnel ou societe)" });
    }

    // validations spécifiques
    if (accountType === "personnel") {
      if (!personal || typeof personal !== "object") {
        return res.status(400).json({ message: "Données 'personal' manquantes" });
      }
      // coercion
      if (personal.cin != null) personal.cin = Number(personal.cin);
      personal.posteActuel = (personal.posteActuel || "").trim();
      if (!personal.cin || !personal.posteActuel) {
        return res.status(400).json({ message: "CIN et poste actuel sont requis pour un compte personnel" });
      }
    } else {
      if (!company || typeof company !== "object") {
        return res.status(400).json({ message: "Données 'company' manquantes" });
      }
      company.matriculeFiscal = (company.matriculeFiscal || company.matriculeFiscale || "").trim();
      company.nomSociete = (company.nomSociete || "").trim();
      company.posteActuel = (company.posteActuel || "").trim();
      if (!company.matriculeFiscal || !company.nomSociete || !company.posteActuel) {
        return res.status(400).json({ message: "Matricule fiscal, Nom société et Poste actuel sont requis pour un compte société" });
      }
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
      numTel,
      adresse,
    };
    if (accountType === "personnel") doc.personal = personal;
    if (accountType === "societe") doc.company = company;

    const user = await User.create(doc);

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    setAuthCookies(res, { token, role: user.role });
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
// routes/auth.js



/** 🚀 Demande reset password */
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body ?? {};
    if (!email) return res.status(400).json({ message: "Email requis" });

    const user = await User.findOne({ email });
    // Réponse neutre pour ne pas révéler l'existence du compte
    if (!user) return res.json({ message: "Si un compte existe, un email a été envoyé." });

    // ✅ crée ET stocke (hash + expiration) dans user.passwordReset
    const rawToken = user.createPasswordResetToken(60); // 60 min
    await user.save();

    const RESET_BASE_URL = process.env.FRONTEND_RESET_URL
      || "http://localhost:3000/reset-password";
    const resetUrl = `${RESET_BASE_URL}/${rawToken}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT || 587),
      secure: false, // STARTTLS
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      to: user.email,
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      subject: "Réinitialisation de mot de passe",
      html: `
        <p>Bonjour ${user.prenom || user.nom || "client"},</p>
        <p>Vous avez demandé une réinitialisation de mot de passe.</p>
        <p>Cliquez ici (valide 1h) : <a href="${resetUrl}">${resetUrl}</a></p>
        <p>Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      `,
    });

    res.json({ message: "Si un compte existe, un email a été envoyé." });
  } catch (err) {
    console.error("requestPasswordReset:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};


/** 🚀 Reset password */
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body ?? {};
    if (!token || !password) {
      return res.status(400).json({ message: "Token et nouveau mot de passe requis" });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      "passwordReset.tokenHash": tokenHash,
      "passwordReset.expiresAt": { $gt: new Date() },
      $or: [{ "passwordReset.usedAt": null }, { "passwordReset.usedAt": { $exists: false } }],
    }).select("+passwordHash +passwordReset.tokenHash +passwordReset.expiresAt +passwordReset.usedAt");

    if (!user) return res.status(400).json({ message: "Token invalide ou expiré" });

    user.passwordHash = await bcrypt.hash(password, 10);
    user.clearPasswordResetToken();
    await user.save();

    res.json({ message: "Mot de passe réinitialisé avec succès." });
  } catch (err) {
    console.error("resetPassword:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
