// utils/pdf.devisCompression.js
import PDFDocument from "pdfkit";
import dayjs from "dayjs";
import fs from "fs";
import path from "path";

/**
 * PDF "Ressorts de Compression"
 * Ordre: En-tête → Client → Schéma (2 images côte à côte) → Spécifications principales
 *        → [Exigences + Remarques regroupées s'ils existent]
 * - Logo haut-gauche
 * - Titre sur 2 lignes CENTRÉES : "Demande de devis" puis "Ressorts de Compression"
 * - N° au-dessus de la date (alignés à droite)
 * - Les titres/blocks ne se séparent jamais entre deux pages
 * - Spécifications: libellés et valeurs sur UNE SEULE LIGNE (réduction auto de la police si besoin)
 */
export function buildDevisCompressionPDF(devis = {}) {
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  const chunks = [];
  doc.on("data", (c) => chunks.push(c));

  /* ===== Styles & helpers ===== */
  const PRIMARY = "#0B2A55";
  const LIGHT   = "#F5F7FB";
  const BORDER  = "#D5D9E4";
  const TXT     = "#111";

  const LEFT    = doc.page.margins.left;
  const RIGHT   = doc.page.width - doc.page.margins.right;
  const TOP     = doc.page.margins.top;
  const BOTTOM  = doc.page.height - doc.page.margins.bottom;
  const INNER_W = RIGHT - LEFT;

  const safe = (v) =>
    v === null || v === undefined || String(v).trim() === "" ? "—" : String(v).trim();

  const tryImage = (paths = []) => {
    for (const p of paths) {
      try {
        const abs = path.resolve(process.cwd(), p);
        if (fs.existsSync(abs)) return abs;
      } catch {}
    }
    return null;
  };

  // Fit one-line helper: shrink font size (down to minSize) until it fits in `width`.
  // Keeps text on a single line (lineBreak:false).
  const fitOneLine = ({
    text,
    x,
    y,
    width,
    bold = false,
    maxSize = 10,
    minSize = 8,
  }) => {
    const fontName = bold ? "Helvetica-Bold" : "Helvetica";
    let size = maxSize;
    doc.font(fontName);
    while (size > minSize) {
      doc.fontSize(size);
      const w = doc.widthOfString(text);
      if (w <= width) break;
      size -= 0.5; // shrink step
    }
    doc.fontSize(size).text(text, x, y, { width, lineBreak: false, align: "left" });
    return size;
  };

  let y = TOP;

  const rule = (yy = y, color = BORDER) => {
    doc
      .moveTo(LEFT, yy)
      .lineTo(RIGHT, yy)
      .strokeColor(color)
      .lineWidth(1)
      .stroke();
  };

  const section = (label, yy = y, x = LEFT, w = INNER_W) => {
    const h = 22;
    doc
      .save()
      .fillColor(PRIMARY)
      .rect(x, yy, w, h)
      .fill()
      .fillColor("#fff")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text(label, x + 10, yy + 4, { width: w - 20, align: "left" })
      .restore();
    return yy + h;
  };

  const ensureSpace = (needed) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      y = TOP;
    }
  };

  /* ===== En-tête ===== */
  const logoPath = tryImage(["assets/logo.png"]);
  const logoW = 120,
    logoHMax = 60;
  if (logoPath) doc.image(logoPath, LEFT, y - 8, { fit: [logoW, logoHMax] });

  // --- Titre sur 2 lignes CENTRÉES ---
  const titleTop = y + 4;
  doc
    .fillColor(TXT)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("Demande de devis", LEFT, titleTop, { width: INNER_W, align: "center" });

  doc
    .font("Helvetica-Bold")
    .fontSize(20)
    .text("Ressorts de Compression", LEFT, titleTop + 22, {
      width: INNER_W,
      align: "center",
    });

  // Méta (N° et Date) alignées à droite, placées sous le titre
  const metaTop =
    titleTop + 22 + doc.heightOfString("Ressorts de Compression", { width: INNER_W }) + 6;

  const numero = devis?.numero ? `N° : ${devis.numero}` : devis?._id ? `ID : ${devis._id}` : "";
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(TXT)
    .text(numero, LEFT, metaTop, { width: INNER_W, align: "right" })
    .text(
      `Date : ${dayjs(devis?.createdAt || Date.now()).format("DD/MM/YYYY HH:mm")}`,
      LEFT,
      metaTop + 16,
      { width: INNER_W, align: "right" }
    );

  rule(metaTop + 28);
  y = metaTop + 38;

  /* ===== 1) Client ===== */
  y = section("Client", y);
  const u = devis?.user || {};
  const pairs = [
    ["Nom", typeof u === "string" ? u : [u.prenom, u.nom].filter(Boolean).join(" ") || safe(u._id)],
    ["Email", safe(u.email)],
    ["Tél.", safe(u.numTel)],
    ["Adresse", safe(u.adresse)],
  ];
  const rowHClient = 20,
    labelW = 70;

  ensureSpace(rowHClient * pairs.length + 14);
  doc.rect(LEFT, y, INNER_W, rowHClient * pairs.length + 8).strokeColor(BORDER).stroke();
  let cy = y + 6;
  pairs.forEach(([k, v]) => {
    fitOneLine({ text: k, x: LEFT + 8, y: cy, width: labelW, bold: true, maxSize: 10, minSize: 8 });
    fitOneLine({
      text: v,
      x: LEFT + 8 + labelW + 6,
      y: cy,
      width: INNER_W - (labelW + 26),
      bold: false,
      maxSize: 10,
      minSize: 8,
    });
    cy += rowHClient;
  });
  y = y + rowHClient * pairs.length + 18;

  /* ===== 2) Schéma (deux images côte à côte) ===== */
  const imgExtr = tryImage(["assets/compression02.png"]); // extrémités
  const imgDim = tryImage(["assets/compression01.png"]); // dimensions

  if (imgExtr || imgDim) {
    y = section("Schéma", y);

    const gap = 18;
    const colW = Math.floor((INNER_W - gap) / 2);
    const leftW = Math.min(colW, 360);
    const rightW = Math.min(colW, 360);

    ensureSpace(Math.max(leftW * 0.62, rightW * 0.62) + 30);

    if (imgExtr) doc.image(imgExtr, LEFT, y + 10, { width: leftW });
    if (imgDim) doc.image(imgDim, LEFT + colW + gap, y + 10, { width: rightW });

    const bottom = Math.max(
      imgExtr ? y + 10 + leftW * 0.62 : y,
      imgDim ? y + 10 + rightW * 0.62 : y
    );
    y = bottom + 16;
  }

  /* ===== 3) Spécifications principales ===== */
  y = section("Spécifications principales", y);
  const s = devis?.spec || {};
  const rows = [
    ["Diamètre du fil (d)", s.d, "Diamètre extérieur (DE)", s.DE],
    ["Diamètre de l’alésage (H)", s.H, "Diamètre de guide (S)", s.S],
    ["Diamètre intérieur (DI)", s.DI, "Longueur libre (Lo)", s.Lo],
    ["Nombre total de spires", s.nbSpires, "Pas", s.pas],
    ["Quantité", s.quantite ?? devis?.quantite, "Matière", s.matiere],
    ["Sens d’enroulement", s.enroulement, "Type d’extrémité du ressort", s.extremite],
  ];

  // Plus d'espace utile + pas de wrap: réduction automatique de police si nécessaire
  const rowH = 30; // un peu plus haut
  const halfW = Math.floor(INNER_W / 2);
  const padX = 6; // padding interne réduit pour gagner en largeur utile

  // On veut des labels/valeurs en une ligne:
  // - On garde deux demi-colonnes (gauche/droite)
  // - LabelWidth plutôt généreux mais on ajuste la police si besoin
  // - ValueWidth aussi, avec fitOneLine
  const labLW = 180; // largeur label (gauche)
  const labRW = 200; // largeur label (droite)
  const valLW = halfW - (labLW + padX * 3); // largeur valeur (gauche)
  const valRW = halfW - (labRW + padX * 3); // largeur valeur (droite)

  const tableTop = y;
  const tableH = rowH * rows.length;
  ensureSpace(tableH + 10);
  doc.rect(LEFT, tableTop, INNER_W, tableH).strokeColor(BORDER).lineWidth(1).stroke();

  rows.forEach((r, i) => {
    const yy = tableTop + i * rowH;
    if (i % 2 === 0) doc.save().fillColor(LIGHT).rect(LEFT, yy, INNER_W, rowH).fill().restore();

    // lignes séparatrices
    doc.moveTo(LEFT, yy).lineTo(RIGHT, yy).strokeColor(BORDER).stroke();
    doc.moveTo(LEFT + halfW, yy).lineTo(LEFT + halfW, yy + rowH).strokeColor(BORDER).stroke();

    // Gauche: label + valeur
    fitOneLine({
      text: r[0],
      x: LEFT + padX,
      y: yy + 7,
      width: labLW,
      bold: true,
      maxSize: 11,
      minSize: 8,
    });
    fitOneLine({
      text: safe(r[1]),
      x: LEFT + padX + labLW + padX,
      y: yy + 7,
      width: valLW,
      bold: false,
      maxSize: 11,
      minSize: 7.5,
    });

    // Droite: label + valeur
    fitOneLine({
      text: r[2],
      x: LEFT + halfW + padX,
      y: yy + 7,
      width: labRW,
      bold: true,
      maxSize: 11,
      minSize: 8,
    });
    fitOneLine({
      text: safe(r[3]),
      x: LEFT + halfW + padX + labRW + padX,
      y: yy + 7,
      width: valRW,
      bold: false,
      maxSize: 11,
      minSize: 7.5,
    });
  });
  doc
    .moveTo(LEFT, tableTop + tableH)
    .lineTo(RIGHT, tableTop + tableH)
    .strokeColor(BORDER)
    .stroke();
  y = tableTop + tableH + 14;

  /* ===== 4) Bloc Exigences + Remarques (groupés sur la même page) ===== */
  const blocks = [];
  if (devis?.exigences && String(devis.exigences).trim()) {
    const text = String(devis.exigences).trim();
    doc.font("Helvetica").fontSize(10);
    const h = Math.max(70, doc.heightOfString(text, { width: INNER_W - 20 }) + 16);
    blocks.push({ title: "Exigences particulières", text, h });
  }
  if (devis?.remarques && String(devis.remarques).trim()) {
    const text = String(devis.remarques).trim();
    doc.font("Helvetica").fontSize(10);
    const h = Math.max(70, doc.heightOfString(text, { width: INNER_W - 20 }) + 16);
    blocks.push({ title: "Autres remarques", text, h });
  }

  if (blocks.length) {
    const totalNeeded = blocks.reduce((sum, b) => sum + 22 + b.h + 12, 0);
    ensureSpace(totalNeeded);
    for (const b of blocks) {
      y = section(b.title, y);
      doc.save().fillColor("#fff").rect(LEFT, y, INNER_W, b.h).fill().restore();
      doc.rect(LEFT, y, INNER_W, b.h).strokeColor(BORDER).stroke();
      doc.font("Helvetica").fontSize(10).fillColor(TXT).text(b.text, LEFT + 10, y + 8, {
        width: INNER_W - 20,
      });
      y += b.h + 12;
    }
  }

  /* ===== Pied ===== */
  ensureSpace(40);
  rule(BOTTOM - 56);
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#666")
    .text("Document généré automatiquement — MTR Industry", LEFT, BOTTOM - 48, {
      width: INNER_W,
      align: "center",
    });

  doc.end();
  return new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
}
