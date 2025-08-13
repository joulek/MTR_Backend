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

    // ✅ Générer le prochain numéro DVYY#####
    const year = new Date().getFullYear();
    const counterId = `devis:${year}`;
    const c = await Counter.findOneAndUpdate(
      { _id: counterId },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    ).lean();
    const numero = formatDevisNumber(year, c.seq); // ex: DV2500001

    // 1) Enregistrer en base (avec numero)
    let devis = await DevisTraction.create({
      numero,
      user: req.user.id,
      type: "traction",
      spec,
      exigences,
      remarques,
      documents
    });

    // 1bis) Peupler les infos client pour l'email/PDF
    devis = await DevisTraction.findById(devis._id)
      .populate("user", "nom prenom email numTel adresse company personal");

    // 2) Générer le PDF
    const pdfBuffer = await buildDevisTractionPDF(devis);

    // 3) Email admin (texte + HTML) avec le numéro
    const transporter = makeTransport();
    const attachments = [
      { filename: `devis-traction-${devis._id}.pdf`, content: pdfBuffer },
    ];

    const fullName = [devis.user?.prenom, devis.user?.nom].filter(Boolean).join(" ") || "Client";
    const clientEmail = devis.user?.email || "-";
    const clientTel   = devis.user?.numTel || "-";
    const clientAdr   = devis.user?.adresse || "-";
    const clientType  = devis.user?.company ? "Entreprise" : (devis.user?.personal ? "Particulier" : "-");

    const specTxt = `
Type: ${devis.type}
d: ${spec.d ?? "-"}
De: ${spec.De ?? "-"}
Lo: ${spec.Lo ?? "-"}
Spire(s): ${spec.nbSpires ?? "-"}
Quantité: ${spec.quantite ?? "-"}
Matière: ${spec.matiere ?? "-"}
Enroulement: ${spec.enroulement ?? "-"}
Position anneaux: ${spec.positionAnneaux ?? "-"}
Accrochage: ${spec.typeAccrochage ?? "-"}
`.trim();

    const textBody =
`Nouvelle demande de devis – Ressort de Traction

Numéro: ${devis.numero}
Date: ${new Date(devis.createdAt).toLocaleString()}

Infos client
- Nom: ${fullName}
- Email: ${clientEmail}
- Téléphone: ${clientTel}
- Adresse: ${clientAdr}

Voir la pièce jointe (PDF).`;

    const htmlBody = `
<h2>Nouvelle demande de devis – Ressort de Traction</h2>
<ul>
  <li><b>Numéro:</b> ${devis.numero}</li>
  <li><b>Date:</b> ${new Date(devis.createdAt).toLocaleString()}</li>
</ul>

<h3>Infos client</h3>
<ul>
  <li><b>Nom:</b> ${fullName}</li>
  <li><b>Email:</b> ${clientEmail}</li>
  <li><b>Téléphone:</b> ${clientTel}</li>
  <li><b>Adresse:</b> ${clientAdr}</li>
</ul>

<p>Voir la pièce jointe (PDF).</p>
`;

    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL,
      replyTo: clientEmail !== "-" ? clientEmail : undefined,
      subject: `Nouvelle demande de devis ${devis.numero} (Traction)`,
      text: textBody,
      html: htmlBody,
      attachments
    });

    // Réponse OK
    res.status(201).json({ success: true, devisId: devis._id, numero: devis.numero });

  } catch (e) {
    console.error("createDevisTraction:", e);
    res.status(400).json({ success: false, message: e.message || "Données invalides" });
  }
};