import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    trim: true,
  },
  translations: {
    fr: { type: String, required: true },  // valeur par défaut
    en: { type: String },                  // traduction optionnelle
  },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Category", categorySchema);
