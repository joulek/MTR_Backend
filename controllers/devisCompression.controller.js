import DevisCompression from "../models/DevisCompression.js";

// Créer un devis Compression
export const createDevisCompression = async (req, res) => {
  try {
    const fichiers = req.files?.map(file => file.path) || [];

    const devis = new DevisCompression({
      ...req.body,
      user: req.user._id, // récupéré depuis l'auth
      documents: fichiers
    });

    await devis.save();
    res.status(201).json({ success: true, message: "Devis Compression créé avec succès", data: devis });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


// Récupérer tous les devis Compression
export const getAllDevisCompression = async (req, res) => {
  try {
    const devis = await DevisCompression.find().sort({ date_demande: -1 });
    res.json(devis);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
