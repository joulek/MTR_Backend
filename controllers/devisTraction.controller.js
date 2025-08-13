// controllers/devisTraction.controller.js
import DevisTraction from "../models/DevisTraction.js";
import Counter from "../models/Counter.js";
import { buildDevisTractionPDF } from "../utils/pdf.devisTraction.js";
import { makeTransport } from "../utils/mailer.js";

const toNum = (val) => Number(String(val ?? "").replace(",", "."));
const formatDevisNumber = (year, seq) => `DDV${String(year).slice(-2)}${String(seq).padStart(5, "0")}`;

export const createDevisTraction = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Utilisateur non authentifié" });
    }

    const {
      d, De, Lo, nbSpires, quantite,
      matiere, enroulement, positionAnneaux, typeAccrochage,
      exigences, remarques
    } = req.body;

    const spec = {
      d: toNum(d),
      De: toNum(De),
      Lo: toNum(Lo),
      nbSpires: toNum(nbSpires),
      quantite: toNum(quantite),
      matiere, enroulement, positionAnneaux, typeAccrochage
    };

    const documents = (req.files || []).map(f => ({
      filename: f.originalname, mimetype: f.mimetype, data: f.buffer
    }));

    // ✅ Générer le prochain numéro DDVYY#####
    const year = new Date().getFullYear();
    const counterId = `devis:${year}`;
    const c = await Counter.findOneAndUpdate(
      { _id: counterId },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    ).lean();
    const numero = formatDevisNumber(year, c.seq); // ex: DDV2500001

    // 1) Enregistrer en base (sans PDF pour répondre vite)
    const devis = await DevisTraction.create({
      numero,
      user: req.user.id,
      type: "traction",
      spec,
      exigences,
      remarques,
      documents
    });

    // 2) Répondre tout de suite au front (UI rapide)
    res.status(201).json({ success: true, devisId: devis._id, numero: devis.numero });

    // 3) Générer PDF + envoyer email + stocker PDF **après** la réponse (non bloquant)
   // 3) Générer PDF + envoyer email + stocker PDF **après** la réponse (non bloquant)
setImmediate(async () => {
  // petit util pour fiabiliser la conversion binaire
  const toBuffer = (maybeBinary) => {
    if (!maybeBinary) return null;
    if (Buffer.isBuffer(maybeBinary)) return maybeBinary;
    if (maybeBinary.buffer && Buffer.isBuffer(maybeBinary.buffer)) {
      return Buffer.from(maybeBinary.buffer);
    }
    try { return Buffer.from(maybeBinary); } catch { return null; }
  };

  try {
    const full = await DevisTraction.findById(devis._id)
      .populate("user", "nom prenom email numTel adresse company personal")
      .lean(); // lean pour perf: on manipulera de vrais Buffer via toBuffer

    // 1) Génération PDF de la DEMANDE
    //    (si buildDevisTractionPDF attend un doc mongoose, tu peux enlever .lean() ci-dessus)
    const pdfBuffer = await buildDevisTractionPDF(full);

    // 2) Stocker le PDF dans 'demandePdf'
    await DevisTraction.findByIdAndUpdate(
      devis._id,
      { $set: { demandePdf: { data: pdfBuffer, contentType: "application/pdf" } } },
      { new: true }
    );

    // 3) Préparer la liste des pièces jointes
    const attachments = [];

    // a) PDF généré
    attachments.push({
      filename: `devis-traction-${full._id}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    });

    // b) Documents associés uploadés par le client
    const docs = Array.isArray(full.documents) ? full.documents : [];
    // (Optionnel) limite totale à 15 Mo pour éviter les erreurs SMTP
    const MAX_TOTAL = 15 * 1024 * 1024;
    let total = pdfBuffer.length;

    for (const doc of docs) {
      const name = (doc?.filename || "").trim();
      const buf  = toBuffer(doc?.data);
      const type = doc?.mimetype || "application/octet-stream";

      // skip fichiers temporaires Office "~$" ou vides
      if (!name || name.startsWith("~$")) continue;
      if (!buf || buf.length === 0) continue;

      // respect d'un plafond de taille total
      if (total + buf.length > MAX_TOTAL) {
        console.warn("[MAIL] Pièce jointe ignorée (taille totale > 15 Mo):", name);
        continue;
      }

      attachments.push({
        filename: name,
        content: buf,
        contentType: type,
      });
      total += buf.length;
    }

    // 4) Corps du mail
    const transporter = makeTransport();
    const fullName    = [full.user?.prenom, full.user?.nom].filter(Boolean).join(" ") || "Client";
    const clientEmail = full.user?.email || "-";
    const clientTel   = full.user?.numTel || "-";
    const clientAdr   = full.user?.adresse || "-";

    // petit helper taille lisible
    const human = (n=0)=> {
      const u=["B","KB","MB","GB"]; let i=0, v=n;
      while (v>=1024 && i<u.length-1) { v/=1024; i++; }
      return `${v.toFixed(v<10&&i>0?1:0)} ${u[i]}`;
    };

    const docsList =
      attachments.slice(1) // on exclut le 1er (le PDF généré)
        .map(a => `- ${a.filename} (${human(a.content.length)})`)
        .join("\n") || "(aucun document client)";

    const textBody = `Nouvelle demande de devis – Ressort de Traction

Numéro: ${full.numero}
Date: ${new Date(full.createdAt).toLocaleString()}

Infos client
- Nom: ${fullName}
- Email: ${clientEmail}
- Téléphone: ${clientTel}
- Adresse: ${clientAdr}

Pièces jointes:
- PDF de la demande: devis-traction-${full._id}.pdf (${human(pdfBuffer.length)})
Documents client:
${docsList}
`;

    const htmlBody = `
<h2>Nouvelle demande de devis – Ressort de Traction</h2>
<ul>
  <li><b>Numéro:</b> ${full.numero}</li>
  <li><b>Date:</b> ${new Date(full.createdAt).toLocaleString()}</li>
</ul>

<h3>Infos client</h3>
<ul>
  <li><b>Nom:</b> ${fullName}</li>
  <li><b>Email:</b> ${clientEmail}</li>
  <li><b>Téléphone:</b> ${clientTel}</li>
  <li><b>Adresse:</b> ${clientAdr}</li>
</ul>

<h3>Pièces jointes</h3>
<ul>
  <li>PDF de la demande: <code>devis-traction-${full._id}.pdf</code> (${human(pdfBuffer.length)})</li>
</ul>

<h3>Documents client</h3>
<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${docsList}</pre>
`;

    // 5) Envoi du mail avec toutes les PJ
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL,
      replyTo: clientEmail !== "-" ? clientEmail : undefined,
      subject: `Nouvelle demande de devis ${full.numero} (Traction)`,
      text: textBody,
      html: htmlBody,
      attachments,
    });
  } catch (err) {
    console.error("Post-send PDF/email failed:", err);
  }
});


  } catch (e) {
    console.error("createDevisTraction:", e);
    res.status(400).json({ success: false, message: e.message || "Données invalides" });
  }
};
