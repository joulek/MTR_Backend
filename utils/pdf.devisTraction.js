import PDFDocument from "pdfkit";
import dayjs from "dayjs";

export function buildDevisTractionPDF(devis) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks = [];
  doc.on("data", c => chunks.push(c));
  doc.on("end", () => {});

  const { _id, createdAt, user, spec = {}, exigences, remarques, type } = devis;

  // Header
  doc.fontSize(18).text("Demande de devis – Ressort de Traction", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10).text(`N°: ${_id}`, { align: "right" });
  doc.text(`Date: ${dayjs(createdAt).format("YYYY-MM-DD HH:mm")}`, { align: "right" });
  doc.moveDown();

  // Infos client
  doc.fontSize(12).text("Informations client", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10)
     .text(`ID client: ${user}`,)
     .moveDown();

  // Spécifications
  doc.fontSize(12).text("Spécifications", { underline: true });
  doc.moveDown(0.3);
  const row = (k, v) => doc.fontSize(10).text(`${k}: ${v ?? "-"}`);
  row("Type", type);
  row("Diamètre du fil (d)", spec.d);
  row("Diamètre extérieur (De)", spec.De);
  row("Longueur libre (Lo)", spec.Lo);
  row("Nombre total de spires", spec.nbSpires);
  row("Quantité", spec.quantite);
  row("Matière", spec.matiere);
  row("Sens d’enroulement", spec.enroulement);
  row("Position des anneaux", spec.positionAnneaux);
  row("Type d’accrochage", spec.typeAccrochage);
  doc.moveDown();

  // Exigences & Remarques
  doc.fontSize(12).text("Exigences particulières", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10).text(exigences || "-");
  doc.moveDown();

  doc.fontSize(12).text("Autres remarques", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10).text(remarques || "-");

  doc.end();

  return new Promise((resolve) => {
    const buf = [];
    doc.on("data", d => buf.push(d));
    doc.on("end", () => resolve(Buffer.concat(buf)));
  });
}
