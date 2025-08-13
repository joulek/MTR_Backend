// utils/pdf.devisFilDresse.js
import PDFDocument from "pdfkit";
import dayjs from "dayjs";

export function buildDevisFilDressePDF(devis) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  doc.on("end", () => {});

  const { _id, numero, createdAt, user, spec = {}, exigences, remarques } = devis;

  doc.fontSize(18).text("Demande de devis – Fil dressé", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`N°: ${numero || _id}`, { align: "right" });
  doc.text(`Date: ${dayjs(createdAt).format("YYYY-MM-DD HH:mm")}`, { align: "right" });
  doc.moveDown();

  doc.fontSize(12).text("Informations client", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10).text(`Client: ${typeof user === "string" ? user : (user?._id || "-")}`);
  doc.moveDown();

  const row = (k, v) => doc.fontSize(10).text(`${k}: ${v ?? "-"}`);

  doc.fontSize(12).text("Spécifications", { underline: true });
  doc.moveDown(0.3);
  row("Longueur", `${spec.longueurValeur ?? "-"} ${spec.longueurUnite ?? ""}`);
  row("Diamètre", spec.diametre);
  row("Quantité", `${spec.quantiteValeur ?? "-"} ${spec.quantiteUnite ?? ""}`);
  row("Matière", spec.matiere);
  doc.moveDown();

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
    doc.on("data", (d) => buf.push(d));
    doc.on("end", () => resolve(Buffer.concat(buf)));
  });
}
