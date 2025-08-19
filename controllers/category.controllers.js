// controllers/category.controller.js
import Category from "../models/Category.js";

// ➕ Créer une catégorie
export const createCategory = async (req, res) => {
  try {
    const { label, en } = req.body;

    const newCategory = new Category({
      label,
      translations: {
        fr: label,
        en: en || label,
      },
    });
    await newCategory.save();
    res.json({ success: true, category: newCategory });
  } catch (err) {
    console.error("Erreur création catégorie:", err);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// 📋 Lire toutes les catégories
export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find();
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ✏️ Modifier une catégorie
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, en } = req.body;

    const updated = await Category.findByIdAndUpdate(
      id,
      {
        label,
        translations: {
          fr: label,
          en: en || label,
        },
      },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "Catégorie non trouvée" });

    res.json({ success: true, category: updated });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// ❌ Supprimer une catégorie
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Category.findByIdAndDelete(id);

    if (!deleted) return res.status(404).json({ message: "Catégorie non trouvée" });

    res.json({ success: true, message: "Catégorie supprimée" });
  } catch (err) {
    res.status(500).json({ message: "Erreur serveur" });
  }
};
