// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import fs from "fs";
import multer from "multer";

// ------- Routes -------
import authRegisterRoutes from "./routes/auth.routes.js";     // register-client / register-admin
import auth from "./routes/auth.js";               // login / logout (cookies HTTP-only)
import authRoutes from "./routes/auth.routes.js";             // autres endpoints d'auth si présents
import userRoutes from "./routes/user.routes.js";
import devisTractionRoutes from "./routes/devisTraction.routes.js";
import adminDevisRoutes from "./routes/admin.devis.routes.js";
import devisTorsionRoutes from "./routes/devisTorsion.routes.js";
import devisCompressionRoutes from "./routes/devisCompression.routes.js";
import devisGrilleRoutes from "./routes/devisGrille.routes.js";
import devisFillDresseRoutes from "./routes/devisFilDresse.routes.js";
import devisAutreRoutes from "./routes/devisAutre.routes.js";
import ProductRoutes from "./routes/product.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import ArticleRoutes from "./routes/article.routes.js";
import reclamationRoutes from "./routes/reclamation.routes.js";
import mesDemandesDevisRoutes from "./routes/mesDemandesDevis.js";
import devisRoutes from "./routes/devis.routes.js";
import clientOrderRoutes from "./routes/client.order.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";

dotenv.config();

// --------------------------------- App ---------------------------------
const app = express();
app.set("trust proxy", 1); // cookies Secure derrière proxy Render

// --------------------------- Constantes / Dossiers ----------------------
const FRONTEND_URL = process.env.FRONTEND_URL || "https://mtr-frontend-n4b0.onrender.com";
const LOCAL_FRONTEND = "http://localhost:3000";
const CORS_ORIGINS = (process.env.CORS_ORIGINS || `${FRONTEND_URL},${LOCAL_FRONTEND}`)
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.resolve(process.cwd(), "uploads");
const FILES_DEVIS_DIR = process.env.FILES_DEVIS_DIR || path.resolve(process.cwd(), "storage/devis");

// S'assure que les dossiers existent (évite 500 si introuvables)
for (const dir of [UPLOADS_DIR, FILES_DEVIS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ------------------------------ Middlewares -----------------------------
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(cookieParser());

// Parseurs (AVANT les routes)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Fichiers statiques (AVANT toute auth)
app.use("/uploads", express.static(UPLOADS_DIR, {
  fallthrough: false,
  maxAge: "365d",
  setHeaders(res) { res.setHeader("Cache-Control", "public, max-age=31536000, immutable"); },
}));
app.use("/files/devis", express.static(FILES_DEVIS_DIR));

// Health checks (pratique pour Render/monitoring)
app.get("/health", (_, res) => res.status(200).send("ok"));
app.get("/api/health", (_, res) => res.status(200).json({ ok: true }));

// ------------------------------- MongoDB --------------------------------
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/mtr_db";
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

// -------------------------------- Routes --------------------------------
app.get("/", (_, res) => res.send("API OK"));

// Catégories / Produits / Articles
app.use("/api/categories", categoryRoutes);
app.use("/api/produits", ProductRoutes);
app.use("/api/articles", ArticleRoutes);

// Authentification
app.use("/api/auth", authRegisterRoutes);  // inscription
app.use("/api/auth", auth);     // login / logout
app.use("/api/auth", authRoutes);          // autres endpoints si définis
app.use("/api/users", userRoutes);         // profil / me / admin users
app.use("/api/admin/users", userRoutes);   // si tu exposes aussi côté /admin

// Devis (soumissions client)
app.use("/api/devis/traction", devisTractionRoutes);
app.use("/api/devis/torsion", devisTorsionRoutes);
app.use("/api/devis/compression", devisCompressionRoutes);
app.use("/api/devis/grille", devisGrilleRoutes);
app.use("/api/devis/filDresse", devisFillDresseRoutes);
app.use("/api/devis/autre", devisAutreRoutes);
app.use("/api/devis", devisRoutes);

// Réclamations (avec pièces jointes)
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024, files: 10 } });
app.use("/api/reclamations", auth, upload.array("piecesJointes"), reclamationRoutes);

// Commandes client, contact, dashboard, "mes demandes"
app.use("/api/order", clientOrderRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", mesDemandesDevisRoutes);

// ----------------------------- 404 & Errors -----------------------------
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const msg = err.message || "Server error";
  console.error("🔥 Error:", err);
  res.status(status).json({ error: msg });
});

// --------------------------------- Start --------------------------------
const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// -------------------------- Graceful shutdown ---------------------------
const shutdown = async () => {
  console.log("\n⏹️  Shutting down...");
  try { await mongoose.connection.close(); } catch {}
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
