// utils/pdf.reclamation.js
import PDFDocument from "pdfkit";

export async function buildReclamationPDF(rec) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 48 });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const title = "Réclamation client";
      const u = rec?.user || {};
      const c = rec?.commande || {};

      doc.fontSize(18).text(title, { align: "center" }).moveDown(1);

      doc.fontSize(12).text(`Réf: ${rec?._id}`);
      doc.text(`Date: ${new Date(rec?.createdAt || Date.now()).toLocaleString()}`).moveDown();

      doc.fontSize(14).text("Client", { underline:true });
      doc.fontSize(12)
        .text(`Nom     : ${(u.prenom || "") + " " + (u.nom || "")}`.trim())
        .text(`Email   : ${u.email || "-"}`)
        .text(`Tél     : ${u.numTel || "-"}`)
        .text(`Adresse : ${u.adresse || "-"}`)
        .moveDown();

      doc.fontSize(14).text("Commande", { underline:true });
      doc.fontSize(12)
        .text(`Type doc : ${c.typeDoc || "-"}`)
        .text(`Numéro    : ${c.numero || "-"}`)
        .text(`Date livr.: ${c.dateLivraison ? new Date(c.dateLivraison).toLocaleDateString() : "-"}`)
        .text(`Réf prod. : ${c.referenceProduit || "-"}`)
        .text(`Quantité  : ${c.quantite ?? "-"}`)
        .moveDown();

      doc.fontSize(14).text("Réclamation", { underline:true });
      doc.fontSize(12)
        .text(`Nature  : ${rec?.nature || "-"}`)
        .text(`Attente : ${rec?.attente || "-"}`)
        .moveDown();

      if (rec?.description) {
        doc.fontSize(14).text("Description", { underline:true });
        doc.fontSize(12).text(rec.description).moveDown();
      }

      doc.end();
    } catch (e) { reject(e); }
  });
}
