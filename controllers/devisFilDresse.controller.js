// controllers/devisFilDresse.controller.js
import DevisFilDresse from "../models/DevisFilDresse.js";
import Counter from "../models/Counter.js";
import { buildDevisFilDressePDF } from "../utils/pdf.devisFilDresse.js";
import { makeTransport } from "../utils/mailer.js";

const toNum = (val) => Number(String(val ?? "").replace(",", "."));
const formatDevisNumber = (year, seq) =>
  `DDV${String(year).slice(-2)}${String(seq).padStart(5, "0")}`;

/**
 * POST /api/devis/filDresse
 * - nécessite auth (req.user.id)
 * - accepte des fichiers (req.files) -> documents
 */
export const createDevisFilDresse = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res
        .status(401)
        .json({ success: false, message: "Utilisateur non authentifié" });
    }

    // Champs attendus depuis le form
    const {
      longueurValeur,
      longueurUnite, // "mm" | "m"
      diametre,
      quantiteValeur,
      quantiteUnite, // "pieces" | "kg"
      matiere,       // "Acier galvanisé" | "Acier Noir" | "Acier ressort" | "Acier inoxydable"
      exigences,
      remarques,
    } = req.body;

    // Normalisation numérique + structuration conforme au schéma
    const spec = {
      longueurValeur: toNum(longueurValeur),
      longueurUnite,
      diametre: toNum(diametre),

      quantiteValeur: toNum(quantiteValeur),
      quantiteUnite,

      matiere,
    };

    // Fichiers joints du client (depuis multer)
    const documents = (req.files || []).map((f) => ({
      filename: f.originalname,
      mimetype: f.mimetype,
      data: f.buffer,
    }));

    // Génération du numéro séquentiel par année
    const year = new Date().getFullYear();
    const counterId = `devis:${year}`;
    const c = await Counter.findOneAndUpdate(
      { _id: counterId },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    ).lean();
    const numero = formatDevisNumber(year, c.seq); // ex: DDV2500001

    // 1) Création en base (sans PDF pour une réponse rapide)
    const devis = await DevisFilDresse.create({
      numero,
      user: req.user.id,
      type: "fil",
      spec,
      exigences,
      remarques,
      documents,
    });

    // 2) Réponse immédiate
    res.status(201).json({
      success: true,
      devisId: devis._id,
      numero: devis.numero,
    });

    // 3) Suite asynchrone: PDF + email + stockage PDF
    setImmediate(async () => {
      // util binaire (Mongo/lean)
      const toBuffer = (maybeBinary) => {
        if (!maybeBinary) return null;
        if (Buffer.isBuffer(maybeBinary)) return maybeBinary;
        if (maybeBinary.buffer && Buffer.isBuffer(maybeBinary.buffer)) {
          return Buffer.from(maybeBinary.buffer);
        }
        try {
          return Buffer.from(maybeBinary);
        } catch {
          return null;
        }
      };

      try {
        // Récup complète
        const full = await DevisFilDresse.findById(devis._id)
          .populate("user", "nom prenom email numTel adresse company personal")
          .lean();

        // Générer le PDF spécifique "fil dressé"
        const pdfBuffer = await buildDevisFilDressePDF(full);

        // Stocker le PDF dans le doc
        await DevisFilDresse.findByIdAndUpdate(
          devis._id,
          {
            $set: {
              demandePdf: { data: pdfBuffer, contentType: "application/pdf" },
            },
          },
          { new: true }
        );

        // Construire les PJ (PDF + docs client <= 15 Mo)
        const attachments = [
          {
            filename: `devis-filDresse-${full._id}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ];

        const MAX_TOTAL = 15 * 1024 * 1024; // 15 Mo
        let total = pdfBuffer.length;

        const docs = Array.isArray(full.documents) ? full.documents : [];
        for (const doc of docs) {
          const name = (doc?.filename || "").trim();
          const buf = toBuffer(doc?.data);
          const type = doc?.mimetype || "application/octet-stream";

          if (!name || name.startsWith("~$")) continue; // ignorer fichiers temp Office
          if (!buf || buf.length === 0) continue;
          if (total + buf.length > MAX_TOTAL) {
            console.warn(
              "[MAIL] PJ ignorée (taille totale > 15 Mo):",
              name
            );
            continue;
          }

          attachments.push({ filename: name, content: buf, contentType: type });
          total += buf.length;
        }

        // Infos mail
        const transporter = makeTransport();
        const fullName =
          [full.user?.prenom, full.user?.nom].filter(Boolean).join(" ") ||
          "Client";
        const clientEmail = full.user?.email || "-";
        const clientTel = full.user?.numTel || "-";
        const clientAdr = full.user?.adresse || "-";

        const human = (n = 0) => {
          const u = ["B", "KB", "MB", "GB"];
          let i = 0,
            v = n;
          while (v >= 1024 && i < u.length - 1) {
            v /= 1024;
            i++;
          }
          return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
        };

        const docsList =
          attachments
            .slice(1) // skip le PDF généré
            .map((a) => `- ${a.filename} (${human(a.content.length)})`)
            .join("\n") || "(aucun document client)";

        const textBody = `Nouvelle demande de devis – Fil dressé

Numéro: ${full.numero}
Date: ${new Date(full.createdAt).toLocaleString()}

Infos client
- Nom: ${fullName}
- Email: ${clientEmail}
- Téléphone: ${clientTel}
- Adresse: ${clientAdr}

Spécifications:
- Longueur: ${full.spec?.longueurValeur} ${full.spec?.longueurUnite}
- Diamètre: ${full.spec?.diametre}
- Quantité: ${full.spec?.quantiteValeur} ${full.spec?.quantiteUnite}
- Matière: ${full.spec?.matiere}

Pièces jointes:
- PDF de la demande: devis-filDresse-${full._id}.pdf (${human(pdfBuffer.length)})
Documents client:
${docsList}
`;

        const htmlBody = `
<h2>Nouvelle demande de devis – Fil dressé</h2>
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

<h3>Spécifications</h3>
<ul>
  <li><b>Longueur:</b> ${full.spec?.longueurValeur} ${full.spec?.longueurUnite}</li>
  <li><b>Diamètre:</b> ${full.spec?.diametre}</li>
  <li><b>Quantité:</b> ${full.spec?.quantiteValeur} ${full.spec?.quantiteUnite}</li>
  <li><b>Matière:</b> ${full.spec?.matiere}</li>
</ul>

<h3>Pièces jointes</h3>
<ul>
  <li>PDF de la demande: <code>devis-filDresse-${full._id}.pdf</code> (${human(
            pdfBuffer.length
          )})</li>
</ul>

<h3>Documents client</h3>
<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;">${docsList}</pre>
`;

        await transporter.sendMail({
          from: process.env.SMTP_USER,
          to: process.env.ADMIN_EMAIL,
          replyTo: clientEmail !== "-" ? clientEmail : undefined,
          subject: `Nouvelle demande de devis ${full.numero} (Fil dressé)`,
          text: textBody,
          html: htmlBody,
          attachments,
        });
      } catch (err) {
        console.error("Post-send PDF/email failed (filDresse):", err);
      }
    });
  } catch (e) {
    console.error("createDevisFilDresse:", e);
    res
      .status(400)
      .json({ success: false, message: e.message || "Données invalides" });
  }
};
