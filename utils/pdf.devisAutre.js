// utils/pdf.devisAutre.js
import PDFDocument from "pdfkit";
import dayjs from "dayjs";

export function buildDevisAutrePDF(devis) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  const {
    _id,
    numero,
    createdAt,
    user,
    spec = {},
    exigences,
    remarques,
    type,
  } = devis;

  // Accumuler le flux PDF dans un Buffer
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  doc.on("end", () => {});

  /* ====== En-tête ====== */
  doc.fontSize(18).text("Demande de devis – Autre article", { align: "center" });
  doc.moveDown(0.5);

  doc.fontSize(10);
  if (numero) doc.text(`N°: ${numero}`, { align: "right" });
  else doc.text(`ID: ${_id}`, { align: "right" });
  doc.text(`Date: ${dayjs(createdAt).format("YYYY-MM-DD HH:mm")}`, { align: "right" });
  doc.moveDown();

  /* ====== Infos client ====== */
  doc.fontSize(12).text("Informations client", { underline: true });
  doc.moveDown(0.3);
  const clientLine =
    typeof user === "string"
      ? `Client: ${user}`
      : `Client: ${[user?.prenom, user?.nom].filter(Boolean).join(" ") || "-"}`
        + ` | Email: ${user?.email || "-"}`
        + ` | Tél: ${user?.numTel || "-"}`;
  doc.fontSize(10).text(clientLine);
  doc.moveDown();

  /* ====== Spécifications ====== */
  const row = (k, v) => doc.fontSize(10).text(`${k}: ${v ?? "-"}`);

  doc.fontSize(12).text("Spécifications", { underline: true });
  doc.moveDown(0.3);
  row("Type", type || "autre");
  row("Titre", spec.titre);
  doc.moveDown(0.2);

  // Description sur plusieurs lignes
  doc.fontSize(10).text("Description :", { continued: false });
  doc.moveDown(0.2);
  doc
    .fontSize(10)
    .text(spec.description || "-", {
      align: "left",
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });
  doc.moveDown();

  /* ====== Exigences / Remarques ====== */
  doc.fontSize(12).text("Exigences particulières", { underline: true });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .text(exigences || "-", {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });
  doc.moveDown();

  doc.fontSize(12).text("Autres remarques", { underline: true });
  doc.moveDown(0.3);
  doc
    .fontSize(10)
    .text(remarques || "-", {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });

  // Fin du document
  doc.end();

  // Retourner un Buffer (même contrat que les autres builders)
  return new Promise((resolve) => {
    const buf = [];
    doc.on("data", (d) => buf.push(d));
    doc.on("end", () => resolve(Buffer.concat(buf)));
  });
}
