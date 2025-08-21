// utils/pdf.devisTraction.js
import PDFDocument from "pdfkit";
import dayjs from "dayjs";

export function buildDevisTractionPDF(devis) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  /* ───────── Utils ───────── */
  // get() robuste : ignore les valeurs objets → évite "[object Object]"
  const get = (obj, paths = []) => {
    for (const p of paths) {
      const v = p.split(".").reduce((a, k) => (a && a[k] !== undefined ? a[k] : undefined), obj);
      if (v === undefined || v === null) continue;
      if (typeof v === "object") continue; // clé importante
      const s = String(v).trim();
      if (s) return s;
    }
    return "";
  };
  const pretty = (v, dash = true) => {
    const s = (v ?? "").toString().trim();
    return s ? s : dash ? "-" : "";
  };

  /* ───────── DATA ───────── */
  const { _id, createdAt, user = {}, spec = {}, exigences, remarques, type } = devis || {};

  // Type de compte : tolère plusieurs variantes
  const accountTypeRaw =
    (get(user, ["accountType", "typeCompte", "type", "profil.type", "profile.type"]) || "")
      .toString()
      .toLowerCase();

  const accountType =
    ["societe", "société", "company", "enterprise", "entreprise"].includes(accountTypeRaw)
      ? "societe"
      : ["personnel", "personal", "particulier"].includes(accountTypeRaw)
      ? "personnel"
      : "";

  // Infos génériques
  const client = {
    nom: get(user, ["nom", "lastName", "name.last", "fullname"]),
    prenom: get(user, ["prenom", "firstName", "name.first"]),
    email: get(user, ["email"]),
    tel: get(user, ["numTel", "telephone", "phone", "tel"]),
    adresse: get(user, ["adresse", "address", "location.address"]),
  };

  // ── Personnel (corrigé)
  const perso = {
    cin: get(user, ["cin", "CIN", "personal.cin", "personnel.cin"]),
    poste: get(user, [
      "personal.posteActuel",
      "personnel.posteActuel",
      "posteActuel",     // au root si présent
      "personal.poste",  // anciens champs
      "personnel.poste",
      "fonction",
      "role",
    ]),
  };

  // ── Société — chemins précis (pas de "company" nu)
  const soc = {
    nom: get(user, [
      "nomSociete",
      "company.nomSociete",
      "societe.nomSociete",
      "company.name",
      "entreprise.nom",
      "societyName",
      "company.raisonSociale",
    ]),
    matricule: get(user, [
      "matriculeFiscal",
      "company.matriculeFiscal",
      "societe.matriculeFiscal",
      "mf",
      "MF",
      "taxId",
      "fiscalId",
    ]),
    poste: get(user, [
      "company.posteActuel",
      "societe.posteActuel",
      "posteActuel",
      "fonction",
      "role",
    ]),
  };

  /* ───────── STREAM BUFFER ───────── */
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  /* ───────── STYLES ───────── */
  const C_PRIMARY = "#0b2a4a";
  const C_TEXT = "#111111";
  const C_MUTED = "#6b7280";
  const C_LINE = "#e5e7eb";

  const LEFT = doc.page.margins.left;
  const RIGHT = doc.page.width - doc.page.margins.right;
  const PAGEW = RIGHT - LEFT;

  /* ───────── ENTÊTE ───────── */
  const titleY = 24;

  doc
    .fillColor(C_TEXT)
    .font("Helvetica-Bold")
    .fontSize(19)
    .text("Demande de devis — Ressort de traction", LEFT, titleY, {
      align: "left",
      width: PAGEW,
    });

  const providedNumber = devis?.numero || devis?.reference || devis?.code;
  doc
    .font("Helvetica")
    .fontSize(10.5)
    .fillColor(C_MUTED)
    .text(
      `${formatDevisNumber(_id, createdAt, providedNumber)}  ·  ${
        createdAt ? dayjs(createdAt).format("DD/MM/YYYY HH:mm") : "-"
      }`,
      LEFT,
      titleY + 24,
      { width: PAGEW, align: "left" }
    );

  const lineY = titleY + 50;
  drawLine(doc, LEFT, RIGHT, lineY, C_PRIMARY, 1.6);
  doc.y = lineY + 18;

  /* ───────── INFORMATIONS CLIENT ───────── */
  sectionTitle(doc, "Informations client", C_PRIMARY, LEFT, PAGEW);

  const infoItems = [
    {
      label: "Type de compte",
      value: accountType ? (accountType === "societe" ? "Société" : "Personnel") : "-",
    },
    { label: "Nom", value: pretty(`${client.prenom} ${client.nom}`.trim()) },
    { label: "Email", value: pretty(client.email) },
    { label: "Téléphone", value: pretty(client.tel) },
    { label: "Adresse", value: pretty(client.adresse) },
  ];

  if (accountType === "societe") {
    infoItems.push(
      { label: "Nom de la société", value: pretty(soc.nom) },
      { label: "Matricule fiscal", value: pretty(soc.matricule) },
      { label: "Poste actuel", value: pretty(soc.poste) }
    );
  } else if (accountType === "personnel") {
    infoItems.push(
      { label: "CIN", value: pretty(perso.cin) },
      { label: "Poste actuel", value: pretty(perso.poste) }
    );
  } else {
    // fallback si accountType absent/incorrect
    if (soc.nom)       infoItems.push({ label: "Nom de la société", value: pretty(soc.nom) });
    if (soc.matricule) infoItems.push({ label: "Matricule fiscal", value: pretty(soc.matricule) });
    if (soc.poste)     infoItems.push({ label: "Poste actuel", value: pretty(soc.poste) });
    if (perso.cin)     infoItems.push({ label: "CIN", value: pretty(perso.cin) });
    if (perso.poste)   infoItems.push({ label: "Poste actuel", value: pretty(perso.poste) });
  }

  drawTwoColGrid(doc, infoItems, { LEFT, RIGHT, C_LINE, C_TEXT, C_MUTED });

  /* ───────── SPÉCIFICATIONS ───────── */
  sectionTitle(doc, "Spécifications", C_PRIMARY, LEFT, PAGEW);
  drawTwoColGrid(
    doc,
    [
      { label: "Diamètre du fil (d)", value: pretty(spec.d) },
      { label: "Diamètre extérieur (De)", value: pretty(spec.De) },
      { label: "Longueur libre (Lo)", value: pretty(spec.Lo) },
      { label: "Nombre total de spires", value: pretty(spec.nbSires || spec.nbSpires) },
      { label: "Quantité", value: pretty(spec.quantite) },
      { label: "Matière", value: pretty(spec.matiere) },
      { label: "Sens d'enroulement", value: pretty(spec.enroulement) },
      { label: "Position des anneaux", value: pretty(spec.positionAnneaux) },
      { label: "Type d'accrochage", value: pretty(spec.typeAccrochage) },
      { label: "Type de ressort", value: pretty(type) },
    ],
    { LEFT, RIGHT, C_LINE, C_TEXT, C_MUTED }
  );

  /* ───────── EXIGENCES & REMARQUES ───────── */
  sectionTitle(doc, "Exigences particulières", C_PRIMARY, LEFT, PAGEW);
  drawParagraph(doc, exigences, { LEFT, RIGHT, C_TEXT, placeholder: "-" });

  sectionTitle(doc, "Autres remarques", C_PRIMARY, LEFT, PAGEW);
  drawParagraph(doc, remarques, { LEFT, RIGHT, C_TEXT, placeholder: "-" });

  /* ───────── FOOTER ───────── */
  doc.moveDown(1.5);
  drawLine(doc, LEFT, RIGHT, doc.y, C_LINE, 1);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(C_MUTED)
    .text("Document généré automatiquement — MTR", LEFT, doc.y + 6, {
      align: "center",
      width: PAGEW,
    });

  doc.end();
  return done;
}

/* ───────────────────── UI HELPERS ───────────────────── */
function sectionTitle(doc, text, color, LEFT, PAGEW) {
  doc.moveDown(0.4);
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(color)
    .text(text, LEFT, doc.y, { width: PAGEW, align: "left" });
  drawLine(doc, LEFT, LEFT + PAGEW, doc.y + 2, "#e5e7eb", 1);
  doc.y += 10;
}

function drawTwoColGrid(doc, items, { LEFT, RIGHT, C_LINE, C_TEXT, C_MUTED }) {
  const colGap = 28;
  const colWidth = Math.floor((RIGHT - LEFT - colGap) / 2);
  const minRowH = 28;

  const rows = [];
  for (let i = 0; i < items.length; i += 2) rows.push([items[i], items[i + 1] || { label: "", value: "" }]);

  rows.forEach(([a, b]) => {
    const yStart = doc.y;

    const hA = measureCellHeight(doc, a, colWidth);
    const hB = measureCellHeight(doc, b, colWidth);
    const rowH = Math.max(minRowH, hA, hB);

    renderCell(doc, LEFT, colWidth, yStart, rowH, a, { C_TEXT, C_MUTED });
    renderCell(doc, LEFT + colWidth + colGap, colWidth, yStart, rowH, b, { C_TEXT, C_MUTED });

    drawLine(doc, LEFT, RIGHT, yStart + rowH + 4, C_LINE, 0.8);
    doc.y = yStart + rowH + 10;
  });
}

function measureCellHeight(doc, { label = "", value = "" } = {}, width) {
  const save = { x: doc.x, y: doc.y, font: doc._font, size: doc._fontSize, fill: doc._fillColor };
  const hLabel = doc.font("Helvetica").fontSize(9).heightOfString(label || "", { width });
  const hValue = doc.font("Helvetica-Bold").fontSize(11).heightOfString(String(value || ""), { width });
  doc.x = save.x;
  doc.y = save.y;
  doc._font = save.font;
  doc._fontSize = save.size;
  doc._fillColor = save.fill;
  return hLabel + hValue + 8;
}

function renderCell(doc, x, w, y, h, { label = "", value = "" } = {}, { C_TEXT, C_MUTED }) {
  const pad = 2;
  doc.font("Helvetica").fontSize(9).fillColor(C_MUTED).text(label, x, y + pad, { width: w, align: "left" });
  const afterLabelY = doc.y;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(C_TEXT).text(String(value || ""), x, afterLabelY, {
    width: w,
    align: "left",
  });
  doc.y = y + h; // fixe la hauteur
}

function drawParagraph(doc, text, { LEFT, RIGHT, C_TEXT, placeholder = "-" }) {
  const value = text && String(text).trim() ? String(text) : placeholder;
  doc.font("Helvetica").fontSize(10.5).fillColor(C_TEXT).text(value, LEFT, doc.y, {
    width: RIGHT - LEFT,
    align: "left",
  });
}

function drawLine(doc, x1, x2, y, color, w = 1) {
  doc.save().moveTo(x1, y).lineTo(x2, y).lineWidth(w).strokeColor(color).stroke().restore();
}

/* ───────────────────── DATA HELPERS ───────────────────── */
// Retourne un numéro au format DDVYY#####
function formatDevisNumber(id, createdAt, provided) {
  if (provided) {
    const s = String(provided);
    if (/^DDV\d{7}$/.test(s)) return s;
    const digits = s.replace(/\D/g, "");
    if (digits.length >= 7) return `DDV${digits.slice(-7)}`;
    const yy = dayjs(createdAt || Date.now()).format("YY");
    const serial = digits.padStart(5, "0").slice(-5);
    return `DDV${yy}${serial}`;
  }

  const yy = dayjs(createdAt || Date.now()).format("YY");
  let digitsFromId = String(id || "").replace(/\D/g, "");
  if (digitsFromId.length >= 5) digitsFromId = digitsFromId.slice(-5);
  else {
    const src = String(id || "");
    let h = 0;
    for (let i = 0; i < src.length; i++) h = (h * 33 + src.charCodeAt(i)) >>> 0;
    digitsFromId = String(h % 100000).padStart(5, "0");
  }
  return `DDV${yy}${digitsFromId}`;
}
