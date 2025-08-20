// controllers/reclamation.controller.js
import mongoose from "mongoose";
import Reclamation from "../models/reclamation.js";

/* ------------------------- Helpers ------------------------- */
const buildFilter = (q = {}) => {
  const f = {};
  if (q.user) f.user = new mongoose.Types.ObjectId(q.user);
  if (q.typeDoc) f["commande.typeDoc"] = q.typeDoc;
  if (q.numero) f["commande.numero"] = q.numero;
  if (q.nature) f.nature = q.nature;
  if (q.attente) f.attente = q.attente;

  // Filtre par date de création (createdAt)
  if (q.from || q.to) {
    f.createdAt = {};
    if (q.from) f.createdAt.$gte = new Date(q.from);
    if (q.to) f.createdAt.$lte = new Date(q.to);
  }
  return f;
};

const required = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

/* ------------------------- GET /api/reclamations ------------------------- */
/**
 * Query:
 *  - user=<userId>
 *  - typeDoc=facture|bon_livraison|bon_commande|devis
 *  - numero=<string>
 *  - nature=produit_non_conforme|...
 *  - attente=remplacement|reparation|remboursement|autre
 *  - from=YYYY-MM-DD
 *  - to=YYYY-MM-DD
 *  - page=1  limit=20  sort=-createdAt
 */
export const listReclamations = async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 200);
    const sort  = req.query.sort || "-createdAt";
    const skip  = (page - 1) * limit;

    const filter = buildFilter(req.query);

    const [items, total] = await Promise.all([
      Reclamation.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Reclamation.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error("listReclamations error:", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};

/* ------------------------- GET /api/reclamations/:id ------------------------- */
export const getReclamationById = async (req, res) => {
  try {
    const doc = await Reclamation.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, message: "Réclamation introuvable" });
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error("getReclamationById error:", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};

/* ------------------------- POST /api/reclamations ------------------------- */
/**
 * Body JSON attendu (ex):
 * {
 *   "user": "<ObjectId>",
 *   "commande": { "typeDoc":"devis", "numero":"DV2500016", "dateLivraison":"2025-08-21",
 *                 "referenceProduit":"ART-001", "quantite":10 },
 *   "nature":"produit_non_conforme",
 *   "description":"...optionnel...",
 *   "attente":"remplacement",
 *   "piecesJointes":[{ "filename":"photo1.jpg", "mimetype":"image/jpeg", "data":"<base64>" }]
 * }
 */
export const createReclamation = async (req, res) => {
  try {
    const { user, commande, nature, description, attente, piecesJointes } = req.body;

    // Validations minimales (pas de lib externe)
    required(user, "user est obligatoire");
    required(commande?.typeDoc, "commande.typeDoc est obligatoire");
    required(commande?.numero, "commande.numero est obligatoire");
    required(nature, "nature est obligatoire");
    required(attente, "attente est obligatoire");

    // Normaliser pièces jointes si data en base64
    let pj = [];
    if (Array.isArray(piecesJointes)) {
      pj = piecesJointes.map((p) => {
        if (p?.data && typeof p.data === "string") {
          return {
            filename: p.filename,
            mimetype: p.mimetype,
            data: Buffer.from(p.data, "base64"),
          };
        }
        return p;
      });
    }

    const doc = await Reclamation.create({
      user,
      commande,
      nature,
      description,
      attente,
      piecesJointes: pj,
    });

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error("createReclamation error:", err);
    res.status(400).json({ success: false, message: err.message || "Requête invalide" });
  }
};

/* ------------------------- PUT /api/reclamations/:id ------------------------- */
export const updateReclamation = async (req, res) => {
  try {
    const update = { ...req.body };

    // Si mise à jour des pièces jointes avec base64
    if (Array.isArray(update.piecesJointes)) {
      update.piecesJointes = update.piecesJointes.map((p) => {
        if (p?.data && typeof p.data === "string") {
          return { ...p, data: Buffer.from(p.data, "base64") };
        }
        return p;
      });
    }

    const doc = await Reclamation.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    ).lean();

    if (!doc) return res.status(404).json({ success: false, message: "Réclamation introuvable" });
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error("updateReclamation error:", err);
    res.status(400).json({ success: false, message: err.message || "Requête invalide" });
  }
};

/* ------------------------- DELETE /api/reclamations/:id ------------------------- */
export const deleteReclamation = async (req, res) => {
  try {
    const doc = await Reclamation.findByIdAndDelete(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, message: "Réclamation introuvable" });
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error("deleteReclamation error:", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};
