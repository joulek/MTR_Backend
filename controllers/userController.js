// controllers/userController.js
import User from "../models/User.js";

/** Récupérer l'utilisateur connecté */
export const me = async (req, res) => {
  // ⚠️ lire l'id depuis req.user.id (middleware auth)
  const user = await User.findById(req.user?.id);
  if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
  res.json(user.toJSON());
};

/** Modifier le profil de l'utilisateur connecté */
export const updateMe = async (req, res) => {
  try {
    const allowed = ["nom", "prenom", "numTel", "adresse", "personal", "company"];
    const payload = {};
    for (const key of allowed) {
      if (key in req.body) payload[key] = req.body[key];
    }

    // ⚠️ lire l'id depuis req.user.id (middleware auth)
    const user = await User.findByIdAndUpdate(req.user?.id, payload, { new: true });
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });
    res.json(user.toJSON());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Liste des utilisateurs (admin) */
export const listUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users.map(u => u.toJSON()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
