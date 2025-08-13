// utils/pdf.devisGrille.js
import PDFDocument from "pdfkit";
import dayjs from "dayjs";

export function buildDevisGrillePDF(devis) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  const { _id, numero, createdAt, user, spec = {}, exigences, remarques } = devis;

  // bufferiser
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  doc.on("end", () => {});

  // header
  doc.fontSize(18).text("Demande de devis – Grille métallique", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(10);
  if (numero) doc.text(`N°: ${numero}`, { align: "right" });
  else doc.text(`ID: ${_id}`, { align: "right" });
  doc.text(`Date: ${dayjs(createdAt).format("YYYY-MM-DD HH:mm")}`, { align: "right" });
  doc.moveDown();

  // client
  doc.fontSize(12).text("Informations client", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10).text(
    `Client: ${typeof user === "string" ? user : (user?._id || "-")}`
  );
  doc.moveDown();

  // spec
  const row = (k, v) => doc.fontSize(10).text(`${k}: ${v ?? "-"}`);
  doc.fontSize(12).text("Spécifications", { underline: true });
  doc.moveDown(0.3);

  row("Dimensions (L × l)", `${spec.L} × ${spec.l}`);
  row("Nb tiges longitudinales", spec.nbLong);
  row("Nb tiges transversales", spec.nbTrans);
  row("Pas longitudinal (pas1)", spec.pas1);
  row("Pas transversal (pas2)", spec.pas2);
  row("Ø fil tiges (D2)", spec.D2);
  row("Ø fil cadre (D1)", spec.D1);
  row("Quantité", spec.quantite);
  row("Matière", spec.matiere);
  row("Finition", spec.finition);

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
