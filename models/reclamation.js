// models/Reclamation.js
import mongoose from "mongoose";

const reclamationSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true, 
    index: true 
  },

  // 📦 Informations sur la commande
  commande: {
    typeDoc: { 
      type: String, 
      enum: ["facture", "bon_livraison", "bon_commande", "devis"], 
      required: true 
    },
    numero: { type: String, required: true },
    dateLivraison: { type: Date },
    referenceProduit: { type: String },
    quantite: { type: Number, min: 0 },
  },

  // 📋 Nature de la réclamation
  nature: {
    type: String,
    enum: [
      "produit_non_conforme",   // dimensions, matière, finition
      "deterioration_transport",
      "erreur_quantite",
      "retard_livraison",
      "defaut_fonctionnel",
      "autre"
    ],
    required: true
  },
  description: { type: String }, // explication libre

  // 📎 Pièces jointes (ex: photos)
  piecesJointes: [{
    filename: String,
    mimetype: String,
    data: Buffer
  }],

  // ✅ Attente du client
  attente: {
    type: String,
    enum: ["remplacement", "reparation", "remboursement", "autre"],
    required: true
  },

}, { timestamps: true });

export default mongoose.models.Reclamation || mongoose.model("Reclamation", reclamationSchema);
