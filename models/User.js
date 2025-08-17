import mongoose from "mongoose";

const personalSchema = new mongoose.Schema(
  {
    cin: { type: Number, trim: true },        // CIN
    posteActuel: { type: String, trim: true } // Poste Actuel
  },
  { _id: false }
);

const companySchema = new mongoose.Schema(
  {
    matriculeFiscal: { type: String, trim: true }, // Matricule Fiscal
    nomSociete: { type: String, trim: true },      // Nom de la Société
    posteActuel: { type: String, trim: true }      // Poste actuel dans la société
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // 🔹 Type de compte (obligatoire, pas de valeur par défaut)
    accountType: {
      type: String,
      enum: ["personnel", "societe"],
      required: true,
      index: true,
    },

    role: { type: String, enum: ["admin", "client"], default: "client", index: true },

    // Identité
    nom:    { type: String, trim: true },
    prenom: { type: String, trim: true },

    // Contact
    email:   { type: String, trim: true, unique: true, index: true, required: true },
    numTel:  { type: String, trim: true },
    adresse: { type: String, trim: true },

    // Auth
    passwordHash: { type: String, select: false },

    // 🔹 Détails optionnels selon le type de compte
    personal: personalSchema, // utilisé si accountType === "personnel"
    company: companySchema,   // utilisé si accountType === "societe"
  },
  { timestamps: true }
);

// Nettoyage JSON
userSchema.methods.toJSON = function () {
  const obj = this.toObject({ getters: true, virtuals: false });
  delete obj.passwordHash;
  delete obj.__v;
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
