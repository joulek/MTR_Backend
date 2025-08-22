import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import dayjs from "dayjs";

export async function buildDevisPDF(devis, outDir = "storage/devis") {
  fs.mkdirSync(outDir, { recursive: true });
  const filename = `${devis.numero}.pdf`;
  const fullpath = path.join(outDir, filename);

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  doc.pipe(fs.createWriteStream(fullpath));

  // --- En-tête société (à adapter) ---
  doc.fontSize(14).text("Manufacture Tunisienne des Ressorts", { align: "left" });
  doc.fontSize(9).moveDown(0.2)
    .text("ZI EL ONS Route de Tunis KM 10 - Sfax, Tunisie")
    .text("Tél: 74 850 999 / 74 863 888   |   E-mail: mtrsfax@gmail.com")
    .text("Code TVA: 1327477/EAM 000");
  doc.moveDown(0.8);
  doc.fontSize(18).text("Devis - Offre de Prix Client", { align: "center" });
  doc.moveDown(0.3);

  // --- Bloc infos devis & client ---
  const leftX = 40, rightX = 320;
  doc.fontSize(10);
  doc.text(`NUMÉRO : ${devis.numero}`, leftX, 120);
  doc.text(`DU : ${dayjs(devis.createdAt).format("DD/MM/YYYY")}`, leftX, 136);

  doc.text(`Client : ${devis.client.nom}`, rightX, 120);
  if (devis.client.adresse) doc.text(`Adresse : ${devis.client.adresse}`, rightX, 136, { width: 240 });
  if (devis.client.tel) doc.text(`Tél. : ${devis.client.tel}`, rightX, 168);
  if (devis.client.codeTVA) doc.text(`Code TVA : ${devis.client.codeTVA}`, rightX, 184);

  doc.moveDown(2);

  // --- Tableau des lignes ---
  const startY = 220;
  const cols = [
    { label: "Référence", w: 80 },
    { label: "Libellé",    w: 220 },
    { label: "Qté",        w: 40, align:"right" },
    { label: "PU HT",      w: 70, align:"right" },
    { label: "Remise %",   w: 60, align:"right" },
    { label: "PT HT",      w: 70, align:"right" },
  ];
  let y = startY;

  // header
  doc.rect(40, y, 515, 22).stroke();
  let x = 45;
  cols.forEach(c => { doc.font("Helvetica-Bold").text(c.label, x, y+6, { width:c.w-5, align:c.align||"left" }); x += c.w; });
  y += 24;

  // rows
  doc.font("Helvetica");
  devis.items.forEach(it => {
    x = 45;
    const row = [
      it.reference || "",
      it.designation || "",
      String(it.quantite),
      it.puht.toFixed(3),
      (it.remisePct||0).toFixed(2),
      (it.totalHT||0).toFixed(3),
    ];
    doc.rect(40, y, 515, 22).stroke();
    for (let i=0;i<cols.length;i++){
      const align = cols[i].align || (i>=2 ? "right" : "left");
      doc.text(row[i], x, y+6, { width: cols[i].w-6, align });
      x += cols[i].w;
    }
    y += 22;
  });

  // --- Totaux ---
  y += 10;
  const boxX = 335, boxW = 220;
  const line = (label, val) => {
    doc.text(label, boxX, y, { width: boxW-90, align: "left" });
    doc.text(val,   boxX, y, { width: boxW, align: "right" });
    y += 16;
  };
  doc.font("Helvetica-Bold").text("Récapitulatif", boxX, y); y += 16; doc.font("Helvetica");
  line("Montant HT",        devis.totaux.mtht.toFixed(3));
  line("Remise",            (devis.totaux.mtht - devis.totaux.mtnetht).toFixed(3));
  line("Net HT",            devis.totaux.mtnetht.toFixed(3));
  line("TVA",               devis.totaux.mttva.toFixed(3));
  line(`FODEC ${devis.totaux.fodecPct}%`, (devis.totaux.mfodec||0).toFixed(3));
  if (devis.totaux.timbre) line("Timbre fiscal", devis.totaux.timbre.toFixed(3));
  doc.font("Helvetica-Bold"); line("Montant TTC", devis.totaux.mttc.toFixed(3));

  doc.end();
  return { filename, fullpath };
}
