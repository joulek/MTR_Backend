// controllers/authController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

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
    res.status(201).json({ success: true, token, role: user.role, user });
  } catch (e) {
    console.error("registerClient ERROR:", e);
    if (e.code === 11000 && e.keyPattern?.email) return res.status(400).json({ message: "Email déjà utilisé" });
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

    res.status(201).json({ success: true, user });
  } catch (e) {
    console.error("registerAdmin ERROR:", e);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user) return res.status(400).json({ message: "Identifiants invalides" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ message: "Identifiants invalides" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({
      success: true,
      token,
      role: user.role,
      user: user.toJSON(), // passwordHash est supprimé par toJSON()
    });
  } catch (e) {
    console.error("login ERROR:", e);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
