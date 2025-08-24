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

  /* ---------------- CONSTS ---------------- */
  const PAGE_LEFT = 40;
  const TABLE_W = 515;
  const PAGE_RIGHT = PAGE_LEFT + TABLE_W;
  const safe = (s = "") => String(s || "");
  const fmt = (v, d = 2) => Number(v ?? 0).toFixed(d);

  /* ---------------- LOGO + DATE/NUM ---------------- */
  const logoPath = path.resolve(process.cwd(), "assets/logo.png");
  const topY = PAGE_LEFT;

  try {
    doc.image(logoPath, PAGE_LEFT, topY - 10, { width: 90, height: 90, fit: [90, 90] });
  } catch {
    /* ignore si logo manquant */
  }

  const headRightX = PAGE_RIGHT - 220;
  doc.font("Helvetica").fontSize(10).text("Date", headRightX, topY);
  doc.font("Helvetica-Bold").fontSize(12).text(dayjs(devis.createdAt).format("DD/MM/YYYY"), headRightX, topY + 14);

  doc.font("Helvetica").fontSize(10).text("Numéro de Devis", headRightX, topY + 40);
  doc.font("Helvetica-Bold").fontSize(12).text(safe(devis.numero), headRightX, topY + 54);

  /* ---------------- INFOS SOCIÉTÉ & CLIENT ---------------- */
  const company = {
    nom: "Manufacture Tunisienne des Ressorts",
    adresse1: "ZI EL ONS Route de Tunis KM 10",
    ville: "Sfax, Tunisie",
    tel: "Tél: 74 850 999 / 74 863 888",
    email: "Email: mtrsfax@gmail.com",
  };

  // juste sous le logo
  let ly = topY + 85;
  doc.font("Helvetica-Bold").fontSize(11).text(company.nom, PAGE_LEFT, ly);
  ly += 16;
  doc.font("Helvetica").fontSize(10).text(company.adresse1, PAGE_LEFT, ly);
  ly += 14;
  doc.text(company.ville, PAGE_LEFT, ly);
  ly += 14;
  doc.text(company.tel, PAGE_LEFT, ly);
  ly += 14;
  doc.text(company.email, PAGE_LEFT, ly);
  ly += 14;

  // client à droite
  const clientX = PAGE_RIGHT - 230;
  let cy = topY + 85;
  doc.font("Helvetica-Bold").fontSize(11).text("Nom du client", clientX, cy);
  cy += 16;
  doc.font("Helvetica").fontSize(10).text(safe(devis.client?.nom), clientX, cy, { width: 230 });
  cy += 14;
  if (devis.client?.adresse) {
    doc.text(safe(devis.client.adresse), clientX, cy, { width: 230 });
    cy += 14;
  }
  if (devis.client?.tel) {
    doc.text("Téléphone: " + safe(devis.client.tel), clientX, cy);
    cy += 14;
  }
  if (devis.client?.email) {
    doc.text("Email: " + safe(devis.client.email), clientX, cy);
    cy += 14;
  }
  if (devis.client?.codeTVA) {
    doc.text("Code TVA: " + safe(devis.client.codeTVA), clientX, cy);
    cy += 14;
  }

  /* ---------------- OBJET ---------------- */
  const objetY = Math.max(ly, cy) + 16;
  doc.font("Helvetica-Bold").fontSize(10).text("Objet :", PAGE_LEFT, objetY);
  doc
    .font("Helvetica")
    .fontSize(10)
    .text(safe(devis.objet || "Devis - Offre de Prix Client"), PAGE_LEFT + 42, objetY);

  /* ---------------- TABLEAU ---------------- */
  const tableX = PAGE_LEFT;
  let tableY = objetY + 18;

  const cols = [
    { key: "designation", label: "Description", w: 230, align: "left" },
    { key: "unite", label: "Unité", w: 45, align: "left" },
    { key: "quantite", label: "Quantité", w: 55, align: "right" },
    { key: "puht", label: "Prix Unitaire HT", w: 85, align: "right" },
    { key: "tvaPct", label: "TVA", w: 45, align: "right" },
    { key: "totalHT", label: "Total HT", w: 55, align: "right" },
  ];
  const colXs = [tableX];
  for (let i = 0; i < cols.length; i++) colXs.push(colXs[i] + cols[i].w);

  const headerH = 24;

  // header bleu marine
  doc
    .save()
    .rect(tableX, tableY, TABLE_W, headerH)
    .fill("#003366")
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(10);
  for (let i = 0; i < cols.length; i++) {
    doc.text(cols[i].label, colXs[i] + 6, tableY + 7, { width: cols[i].w - 12, align: cols[i].align });
  }
  doc.restore();

  doc.strokeColor("#003366").rect(tableX, tableY, TABLE_W, headerH).stroke();
  for (let i = 1; i < colXs.length; i++) {
    doc.moveTo(colXs[i], tableY).lineTo(colXs[i], tableY + headerH).stroke();
  }
  tableY += headerH;

  // lignes
  doc.font("Helvetica").fontSize(10).fillColor("#000");
  const baseRowH = 22;

  (devis.items || []).forEach((it, idx) => {
    const descH = doc.heightOfString(safe(it.designation), { width: cols[0].w - 12 });
    const dynH = Math.max(baseRowH, 6 + descH + 6);
    if (idx % 2 === 0) doc.save().rect(tableX, tableY, TABLE_W, dynH).fill("#F3F3F8").restore();

    doc.strokeColor("#C8C8D8").rect(tableX, tableY, TABLE_W, dynH).stroke();
    for (let i = 1; i < colXs.length; i++) doc.moveTo(colXs[i], tableY).lineTo(colXs[i], tableY + dynH).stroke();

    doc.text(safe(it.designation), colXs[0] + 6, tableY + 6, { width: cols[0].w - 12, align: "left" });
    doc.text(safe(it.unite || ""), colXs[1] + 6, tableY + 6, { width: cols[1].w - 12, align: "left" });
    doc.text(String(it.quantite ?? ""), colXs[2] + 6, tableY + 6, { width: cols[2].w - 12, align: "right" });
    doc.text(fmt(it.puht, 2), colXs[3] + 6, tableY + 6, { width: cols[3].w - 12, align: "right" });
    doc.text((it.tvaPct ?? 0) + " %", colXs[4] + 6, tableY + 6, { width: cols[4].w - 12, align: "right" });
    doc.text(fmt(it.totalHT, 2), colXs[5] + 6, tableY + 6, { width: cols[5].w - 12, align: "right" });

    tableY += dynH;
  });

  /* ---------------- RÉCAP (ENCADRÉ À DROITE) ---------------- */
  const recapX = PAGE_RIGHT - 220;
  const recapW = 220;
  let ry = tableY + 14;

  const boxLine = (label, val, bold = false, fill = "#F2F2F2") => {
    doc.save().rect(recapX, ry, recapW, 22).fill(fill).restore();
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
    doc.text(label, recapX + 8, ry + 6, { width: recapW - 100, align: "left" });
    doc.text(val, recapX + 8, ry + 6, { width: recapW - 16, align: "right" });
    doc.strokeColor("#D0D0D0").rect(recapX, ry, recapW, 22).stroke();
    ry += 22;
  };

  const t = devis.totaux || {};
  boxLine("Montant Total HT", fmt(t.mtht, 2));
  boxLine("Remise HT", fmt((t.mtht ?? 0) - (t.mtnetht ?? 0), 2));
  boxLine("Total Net HT", fmt(t.mtnetht, 2));
  boxLine("Total TVA", fmt(t.mttva, 2));
  if (t.fodecPct) boxLine(`FODEC ${t.fodecPct}%`, fmt(t.mfodec, 2));
  boxLine("Montant Total TTC", fmt(t.mttc, 2), true, "#E9E9EF");



  /* ---------------- FIN ---------------- */
  doc.end();
  return { filename, fullpath };
}
