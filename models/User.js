import mongoose from "mongoose";
import crypto from "crypto";

const personalSchema = new mongoose.Schema(
  {
    cin: { type: Number, trim: true },
    posteActuel: { type: String, trim: true }
  },
  { _id: false }
);

const companySchema = new mongoose.Schema(
  {
    matriculeFiscal: { type: String, trim: true },
    nomSociete: { type: String, trim: true },
    posteActuel: { type: String, trim: true }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    accountType: { type: String, enum: ["personnel", "societe"], required: true, index: true },
    role: { type: String, enum: ["admin", "client"], default: "client", index: true },

    // Identité
    nom: { type: String, trim: true },
    prenom: { type: String, trim: true },

    // Contact
    email: { type: String, trim: true, unique: true, index: true, required: true },
    numTel: { type: String, trim: true },
    adresse: { type: String, trim: true },

    // Auth
    passwordHash: { type: String, select: false },

    // Détails
    personal: personalSchema,
    company: companySchema,

    // 🔐 Reset password (sécurisé par hash)
    passwordReset: {
      tokenHash: { type: String, select: false, index: true },
      expiresAt: { type: Date,   select: false, index: true },
      usedAt:    { type: Date,   select: false },
    },
  },
  { timestamps: true }
);

// (Optionnel) index TTL si tu veux purge auto quand expiresAt est dépassé.
// userSchema.index({ "passwordReset.expiresAt": 1 }, { expireAfterSeconds: 0, partialFilterExpression: { "passwordReset.expiresAt": { $type: "date" } } });

userSchema.methods.toJSON = function () {
  const obj = this.toObject({ getters: true, virtuals: false });
  delete obj.passwordHash;
  delete obj.passwordReset;
  delete obj.__v;
  return obj;
};

userSchema.pre("validate", function (next) {
  if (this.role === "client") {
    if (!this.nom || !this.prenom) {
      return next(new Error("Nom et prénom sont obligatoires pour un client"));
    }
  }
  next();
});

/** Génère un token raw (à envoyer par email) et stocke son hash + expiration. */
userSchema.methods.createPasswordResetToken = function (ttlMinutes = 60) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  this.passwordReset = { tokenHash, expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000), usedAt: null };
  return rawToken; // <-- c'est ça que tu mets dans l'URL
};

/** Marque le token comme consommé et l’invalide. */
userSchema.methods.clearPasswordResetToken = function () {
  this.passwordReset = { tokenHash: undefined, expiresAt: undefined, usedAt: new Date() };
};

export default mongoose.model("User", userSchema);
