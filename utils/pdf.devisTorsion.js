import PDFDocument from "pdfkit";
import dayjs from "dayjs";

export function buildDevisTorsionPDF(devis) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  // on bufferise le flux PDF
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  doc.on("end", () => {});

  const {
    _id,
    numero,                 // si dispo on l’affiche aussi
    createdAt,
    user,
    spec = {},
    exigences,
    remarques,
    type,
  } = devis;

  /* ====== en-tête ====== */
  doc.fontSize(18).text("Demande de devis – Ressort de Torsion", { align: "center" });
  doc.moveDown(0.5);

  doc.fontSize(10);
  if (numero) doc.text(`N°: ${numero}`, { align: "right" });
  else doc.text(`ID: ${_id}`, { align: "right" });
  doc.text(`Date: ${dayjs(createdAt).format("YYYY-MM-DD HH:mm")}`, { align: "right" });
  doc.moveDown();

  /* ====== infos client ====== */
  doc.fontSize(12).text("Informations client", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10).text(`Client: ${typeof user === "string" ? user : (user?._id || "-")}`);
  doc.moveDown();

  /* ====== spécifications ====== */
  const row = (k, v) => doc.fontSize(10).text(`${k}: ${v ?? "-"}`);

  doc.fontSize(12).text("Spécifications", { underline: true });
  doc.moveDown(0.3);

  row("Type", type || "torsion");
  row("Diamètre du fil (d)", spec.d);
  row("Diamètre extérieur (De)", spec.De);
  row("Longueur du corps (Lc)", spec.Lc);
  row("Angle entre les branches (°)", spec.angle);
  row("Nombre total de spires", spec.nbSpires);
  row("Longueur branche 1 (L1)", spec.L1);
  row("Longueur branche 2 (L2)", spec.L2);
  row("Quantité", spec.quantite);
  row("Matière", spec.matiere);
  row("Sens d’enroulement", spec.enroulement);

  doc.moveDown();

  /* ====== exigences / remarques ====== */
  doc.fontSize(12).text("Exigences particulières", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10).text(exigences || "-");
  doc.moveDown();

  doc.fontSize(12).text("Autres remarques", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10).text(remarques || "-");

  // FIN
  doc.end();

  // retourne un Buffer (même contrat que ta version traction)
  return new Promise((resolve) => {
    const buf = [];
    doc.on("data", (d) => buf.push(d));
    doc.on("end", () => resolve(Buffer.concat(buf)));
  });
}
