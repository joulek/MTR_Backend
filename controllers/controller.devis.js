// controllers/devis.controller.js
import Devis from "../models/Devis.js";

import DemandeDevisAutre from "../models/DevisAutre.js";
import DemandeDevisCompression from "../models/DevisCompression.js";
import DemandeDevisTraction from "../models/DevisTraction.js";

import { previewDevisNumber, nextDevisNumber } from "../utils/numbering.js";
import Article from "../models/Article.js";
import { buildDevisPDF } from "../utils/pdf.devis.js";
import { makeTransport } from "../utils/mailer.js";
import path from "path";
import mongoose from "mongoose";

// 👉 BASE publique du backend (mets PUBLIC_BACKEND_URL en .env en prod)
const ORIGIN =
  process.env.PUBLIC_BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`;

const toNum = (v) => Number(String(v ?? "").replace(",", "."));

const DEMANDE_MODELS = [
  { type: "autre",       Model: DemandeDevisAutre },
  { type: "compression", Model: DemandeDevisCompression },
  { type: "traction",    Model: DemandeDevisTraction },
];

export const getNextDevisNumberPreview = async (_req, res) => {
  try {
    const numero = await previewDevisNumber();
    res.json({ success: true, numero });
  } catch (e) {
    console.error("Erreur preview devis:", e);
    res.status(500).json({ success: false, message: "Erreur preview n° devis" });
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

    // 🔗 URL ABSOLUE (sinon Next 3000 répond 404)
    const pdfUrl = `${ORIGIN}/files/devis/${filename}`;

    res.json({ success:true, devis: { _id: devis._id, numero: devis.numero }, pdf: pdfUrl, emailSent: mailOk });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success:false, message:"Erreur création devis" });
  }
};

export const getDevisByDemande = async (req, res) => {
  try {
    const { demandeId } = req.params;
    const numero = (req.query.numero || "").toString().trim().toUpperCase();

    const or = [];
    if (mongoose.isValidObjectId(demandeId)) {
      or.push({ demandeId: new mongoose.Types.ObjectId(demandeId) });
    }
    // (facultatif) si tu stockes aussi le numéro de demande dans Devis :
    if (numero) or.push({ demandeNumero: numero }, { "meta.demandeNumero": numero });

    if (!or.length) {
      return res.status(400).json({ success: false, message: "Paramètres manquants" });
    }

    const devis = await Devis.findOne({ $or: or }).sort({ createdAt: -1 });
    if (!devis) return res.status(404).json({ success: false, message: "Aucun devis pour cette demande" });

    const filename = `${devis.numero}.pdf`;
    const pdf = `${ORIGIN}/files/devis/${filename}`; // 🔗 URL ABSOLUE

    res.json({ success: true, devis: { _id: devis._id, numero: devis.numero }, pdf });
  } catch (e) {
    console.error("getDevisByDemande:", e);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};
