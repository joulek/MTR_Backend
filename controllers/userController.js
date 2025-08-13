// controllers/userController.js
import User from "../models/User.js";

export const me = async (req, res) => {
  const user = await User.findById(req.userId);
  res.json(user);
};

export const updateMe = async (req, res) => {
  try {
    const allowed = ["nom","prenom","numTel","adresse","personal","company"];
    const payload = {};
    for (const key of allowed) {
      if (key in req.body) payload[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(req.userId, payload, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Ajouter la fonction listUsers
export const listUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
