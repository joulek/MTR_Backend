import mongoose from "mongoose";

const personalSchema = new mongoose.Schema({
  cin: { type: Number, trim: true },          // cin
  posteActuel: { type: String, trim: true }        // Poste Actuel
}, { _id: false });

const companySchema = new mongoose.Schema({
  matriculeFiscal: { type: String, trim: true },   // Matricule Fiscal
  nomSociete: { type: String, trim: true },        // Nom de la Société
  posteActuel: { type: String, trim: true }        // Poste actuel dans la société
}, { _id: false });

const userSchema = new mongoose.Schema({
  role: { type: String, enum: ["admin", "client"], default: "client", index: true },

  // Champs communs
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },

  // Champs spécifiques client
  nom: { type: String, trim: true },
  prenom: { type: String, trim: true },
  numTel: { type: String, trim: true },
  adresse: { type: String, trim: true },
  personal: personalSchema,
  company: companySchema

}, { timestamps: true });

// Masquer le hash dans JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

// Validation conditionnelle selon le rôle
userSchema.pre("validate", function (next) {
  if (this.role === "client") {
    if (!this.nom || !this.prenom) {
      return next(new Error("Nom et prénom sont obligatoires pour un client"));
    }
  }
  next();
});

export default mongoose.model("User", userSchema);
