import DevisCompression from "../models/DevisCompression.js";
import DevisTraction from "../models/DevisTraction.js";
import DevisTorsion from "../models/DevisTorsion.js";
import DevisFilDresse from "../models/DevisFilDresse.js";
import DevisGrille from "../models/DevisGrille.js";
import DevisAutre from "../models/DevisAutre.js";

const MODELS = [
  DevisCompression,
  DevisTraction,
  DevisTorsion,
  DevisFilDresse,
  DevisGrille,
  DevisAutre,
];

/**
 * GET /api/devis/numeros-all
 * Params (optionnel):
 *   - q=DV25     (filtre partiel insensible)
 *   - limit=500  (défaut 500, max 5000)
 *   - withType=true (retourne aussi le type d’origine)
 */
export const getAllDevisNumeros = async (req, res) => {
  try {
    const { q, withType } = req.query;
    const limit = Math.min(parseInt(req.query.limit || "500", 10), 5000);
    const regex = q ? new RegExp(q, "i") : null;

    // lance toutes les requêtes en parallèle
    const results = await Promise.all(
      MODELS.map((M) =>
        M.find(regex ? { numero: regex } : {}, "numero type").lean()
      )
    );

    // aplatis
    const flat = results.flat();

    // dédoublonne par "numero"
    const byNumero = new Map();
    for (const d of flat) {
      if (!byNumero.has(d.numero)) byNumero.set(d.numero, d);
    }
    let data = Array.from(byNumero.values());

    // tri alphabétique sur le numéro
    data.sort((a, b) => String(a.numero).localeCompare(String(b.numero), "fr"));

    // limite
    data = data.slice(0, limit);

    // payload final
    const payload =
      withType === "true"
        ? data.map((d) => ({ numero: d.numero, type: d.type }))
        : data.map((d) => ({ numero: d.numero }));

    // logs utiles côté serveur (à enlever en prod)
    console.log("[/api/devis/numeros-all] count:", payload.length);

    res.json({ success: true, data: payload });
  } catch (err) {
    console.error("Erreur getAllDevisNumeros:", err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};
