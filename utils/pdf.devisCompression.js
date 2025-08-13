// utils/pdf.devisCompression.js
import PDFDocument from "pdfkit";
import dayjs from "dayjs";

export function buildDevisCompressionPDF(devis) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  // bufferiser le flux PDF
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  doc.on("end", () => {});

  const {
    _id,
    numero,               // si dispo
    createdAt,
    user,
    spec = {},
    exigences,
    remarques,
    type,
  } = devis;

  /* ====== En-tête ====== */
  doc.fontSize(18).text("Demande de devis – Ressort de Compression", { align: "center" });
  doc.moveDown(0.5);

  doc.fontSize(10);
  if (numero) doc.text(`N°: ${numero}`, { align: "right" });
  else doc.text(`ID: ${_id}`, { align: "right" });
  doc.text(`Date: ${dayjs(createdAt).format("YYYY-MM-DD HH:mm")}`, { align: "right" });
  doc.moveDown();

  /* ====== Informations client ====== */
  doc.fontSize(12).text("Informations client", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10).text(
    `Client: ${
      typeof user === "string"
        ? user
        : [user?.prenom, user?.nom].filter(Boolean).join(" ") || user?._id || "-"
    }`
  );
  if (user && typeof user !== "string") {
    const email = user?.email || "-";
    const tel   = user?.numTel || "-";
    const adr   = user?.adresse || "-";
    doc.text(`Email: ${email}`);
    doc.text(`Téléphone: ${tel}`);
    doc.text(`Adresse: ${adr}`);
  }
  doc.moveDown();

  /* ====== Spécifications ====== */
  const row = (k, v) => doc.fontSize(10).text(`${k}: ${v ?? "-"}`);

  doc.fontSize(12).text("Spécifications", { underline: true });
  doc.moveDown(0.3);

  row("Type", type || "compression");
  row("Diamètre du fil (d)",        spec.d);
  row("Diamètre extérieur (DE)",    spec.DE);
  row("Alésage (H)",                spec.H);
  row("Guide (S)",                  spec.S);
  row("Diamètre intérieur (DI)",    spec.DI);
  row("Longueur libre (Lo)",        spec.Lo);
  row("Nombre total de spires",     spec.nbSpires);
  row("Pas",                        spec.pas);
  row("Quantité",                   spec.quantite);
  row("Matière",                    spec.matiere);
  row("Sens d’enroulement",         spec.enroulement);
  row("Type d’extrémité",           spec.extremite);

  doc.moveDown();

  /* ====== Exigences / Remarques ====== */
  doc.fontSize(12).text("Exigences particulières", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10).text(exigences || "-");
  doc.moveDown();

  doc.fontSize(12).text("Autres remarques", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10).text(remarques || "-");

  // FIN
  doc.end();

  // → retourne un Buffer
  return new Promise((resolve) => {
    const buf = [];
    doc.on("data", (d) => buf.push(d));
    doc.on("end", () => resolve(Buffer.concat(buf)));
  });
}
