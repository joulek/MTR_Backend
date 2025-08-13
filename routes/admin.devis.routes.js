// routes/admin.devis.routes.js
import { Router } from "express";
import auth, { only } from "../middleware/auth.js";
import DevisTraction from "../models/DevisTraction.js";
import { buildDevisTractionPDF } from "../utils/pdf.devisTraction.js";
const router = Router();

// GET /api/admin/devis/traction
router.get("/devis/traction", auth, only("admin"), async (req, res) => {
  try {
    const items = await DevisTraction.find({})
      .populate("user", "prenom nom email numTel")
      .sort("-createdAt")
      .lean();

    res.json({ success: true, items });
  } catch (e) {
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});
router.get("/devis/traction/:id/pdf", auth, only("admin"), async (req, res) => {
  try {
    const devis = await DevisTraction.findById(req.params.id)
      .populate("user", "prenom nom email numTel adresse");
    if (!devis) return res.status(404).send("Devis introuvable");

    const pdfBuffer = await buildDevisTractionPDF(devis);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=devis-traction-${devis._id}.pdf`);
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (e) {
    console.error("admin pdf devis:", e);
    res.status(500).send("Erreur génération PDF");
  }
});

export default router;
