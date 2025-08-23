// controllers/devis.controller.js
import path from "path";
import mongoose from "mongoose";
import Devis from "../models/Devis.js";

// Demandes (pour créer un devis depuis une demande)
import DemandeDevisAutre from "../models/DevisAutre.js";
import DemandeDevisCompression from "../models/DevisCompression.js";
import DemandeDevisTraction from "../models/DevisTraction.js";

// Devis "métier" (pour la recherche de numéros cross-collections)
import DevisCompression from "../models/DevisCompression.js";
import DevisTraction from "../models/DevisTraction.js";
import DevisTorsion from "../models/DevisTorsion.js";
import DevisFilDresse from "../models/DevisFilDresse.js";
import DevisGrille from "../models/DevisGrille.js";
import DevisAutre from "../models/DevisAutre.js";

import { previewDevisNumber, nextDevisNumber } from "../utils/numbering.js";
import Article from "../models/Article.js";
import { buildDevisPDF } from "../utils/pdf.devis.js";
import { makeTransport } from "../utils/mailer.js";

// 👉 BASE publique du backend (mets PUBLIC_BACKEND_URL en .env en prod)
const ORIGIN =
  process.env.PUBLIC_BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`;

const toNum = (v) => Number(String(v ?? "").replace(",", "."));

// ========  A) NUMÉROS SUR TOUTES LES COLLECTIONS DEVIS  ========

const MODELS = [
  DevisCompression,
  DevisTraction,
  DevisTorsion,
  DevisFilDresse,
  DevisGrille,
  DevisAutre,
];

/**
 * GET /api/devis/numeros-all      (monté aussi sous /api/admin/devis/numeros-all si tu veux)
 * Query (optionnel):
 *   - q=DV25           (filtre partiel, insensible à la casse)
 *   - limit=500        (défaut 500, max 5000)
 *   - withType=true    (retourne aussi { numero, type })
 */
export const getAllDevisNumeros = async (req, res) => {
  try {
    const { q, withType } = req.query;
    const limit = Math.min(parseInt(req.query.limit || "500", 10), 5000);
    const regex = q ? new RegExp(q, "i") : null;

    // lance toutes les requêtes en parallèle
    const results = await Promise.all(
      MODELS.map((M) =>
        M.find(regex ? { numero: regex } : {}, "numero type").lean()
      )
    );

    // aplatis + dédoublonne par "numero"
    const byNumero = new Map();
    for (const arr of results) {
      for (const d of arr) {
        if (d?.numero && !byNumero.has(d.numero)) byNumero.set(d.numero, d);
      }
    }

    let data = Array.from(byNumero.values());
    data.sort((a, b) => String(a.numero).localeCompare(String(b.numero), "fr"));
    data = data.slice(0, limit);

    const payload =
      withType === "true"
        ? data.map((d) => ({ numero: d.numero, type: d.type }))
        : data.map((d) => ({ numero: d.numero }));

    console.log("[/devis/numeros-all] count:", payload.length);
    return res.json({ success: true, data: payload });
  } catch (err) {
    console.error("Erreur getAllDevisNumeros:", err);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};

// ========  B) CRÉATION ET RÉCUP D’UN DEVIS (depuis une demande)  ========

const DEMANDE_MODELS = [
  { type: "autre",       Model: DemandeDevisAutre },
  { type: "compression", Model: DemandeDevisCompression },
  { type: "traction",    Model: DemandeDevisTraction },
  { type: "torsion",     Model: DevisTorsion },
  { type: "fil",   Model: DevisFilDresse },
  { type: "grille",      Model: DevisGrille },
];

export const getNextDevisNumberPreview = async (_req, res) => {
  try {
    const numero = await previewDevisNumber();
    return res.json({ success: true, numero });
  } catch (e) {
    console.error("Erreur preview devis:", e);
    return res.status(500).json({ success: false, message: "Erreur preview n° devis" });
  }
};

async function findDemandeAny(demandeId) {
  for (const { type, Model } of DEMANDE_MODELS) {
    const doc = await Model.findById(demandeId).populate("user");
    if (doc) return { type, doc };
  }
  return null;
}

export const createFromDemande = async (req, res) => {
  try {
    const { demandeId } = req.params;
    const { articleId, quantite, remisePct = 0, tvaPct = 19, sendEmail = true } = req.body;

    const result = await findDemandeAny(demandeId);
    if (!result) return res.status(404).json({ success:false, message:"Demande introuvable" });
    const { type, doc: demande } = result;

    const article = await Article.findById(articleId);
    if (!article) return res.status(404).json({ success:false, message:"Article introuvable" });

    const qte = toNum(quantite || demande.quantite || 1);
    const puht = toNum(article.prixHT || article.priceHT || 0);

    const totalHT = +(qte * puht * (1 - (toNum(remisePct)/100))).toFixed(3);
    const mtht = totalHT;
    const mtnetht = mtht;
    const mttva = +(mtnetht * (toNum(tvaPct)/100)).toFixed(3);
    const mfodec = +((mtnetht) * 0.01).toFixed(3);
    const timbre = 0;
    const mttc = +(mtnetht + mttva + mfodec + timbre).toFixed(3);

    const numero = await nextDevisNumber();

    const devis = await Devis.create({
      numero,
      demandeId: demande._id,
      typeDemande: type,
      client: {
        id: demande.user?._id,
        nom: `${demande.user?.prenom || ""} ${demande.user?.nom || ""}`.trim() || demande.user?.email,
        email: demande.user?.email,
        adresse: demande.user?.adresse,
        tel: demande.user?.numTel,
        codeTVA: demande.user?.company?.matriculeFiscal,
      },
      items: [{
        reference: article.reference || "",
        designation: article.designation || article.name || article.name_fr || "",
        unite: article.unite || "U",
        quantite: qte,
        puht,
        remisePct: toNum(remisePct),
        tvaPct: toNum(tvaPct),
        totalHT
      }],
      totaux: { mtht, mtnetht, mttva, fodecPct: 1, mfodec, timbre, mttc },
    });

    const { filename } = await buildDevisPDF(devis);

    let mailOk = false;
    if (sendEmail && devis.client.email) {
      const transport = makeTransport();
      await transport.sendMail({
        from: process.env.MAIL_FROM || "devis@mtr.tn",
        to: devis.client.email,
        subject: `Votre devis ${devis.numero}`,
        text: `Bonjour,\nVeuillez trouver ci-joint le devis ${devis.numero}.\nCordialement.`,
        attachments: [{ filename, path: path.resolve(process.cwd(), "storage/devis", filename) }],
      });
      mailOk = true;
    }

    // 🔗 URL ABSOLUE
    const pdfUrl = `${ORIGIN}/files/devis/${filename}`;

    return res.json({
      success:true,
      devis: { _id: devis._id, numero: devis.numero },
      pdf: pdfUrl,
      emailSent: mailOk
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success:false, message:"Erreur création devis" });
  }
};

export const getDevisByDemande = async (req, res) => {
  try {
    const { demandeId } = req.params;
    const numero = (req.query.numero || "").toString().trim().toUpperCase();

    const or = [];
    // recherche par ObjectId de demande
    if (mongoose.isValidObjectId(demandeId)) {
      or.push({ demandeId: new mongoose.Types.ObjectId(demandeId) });
    }
    // recherche par numéro de demande si présent
    if (numero) {
      or.push({ demandeNumero: numero }, { "meta.demandeNumero": numero });
    }

    if (!or.length) {
      return res.status(400).json({ success: false, message: "Paramètres manquants" });
    }

    const devis = await Devis.findOne({ $or: or }).sort({ createdAt: -1 });

    // ⛏️ → 200 avec exists:false (évite les 404 côté front)
    if (!devis) {
      return res.status(200).json({
        success: false,
        exists: false,
        message: "Aucun devis pour cette demande",
      });
    }

    const filename = `${devis.numero}.pdf`;
    const pdf = `${ORIGIN}/files/devis/${filename}`; // 🔗 URL ABSOLUE

    return res.json({
      success: true,
      exists: true,
      devis: { _id: devis._id, numero: devis.numero },
      pdf,
    });
  } catch (e) {
    console.error("getDevisByDemande:", e);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};
