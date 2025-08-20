// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import authRegisterRoutes from "./routes/auth.routes.js"; // register-client / register-admin
import authLoginRoutes from "./routes/auth.js";           // login / logout avec cookies HTTP-only
import userRoutes from "./routes/user.routes.js";
import devisTractionRoutes from "./routes/devisTraction.routes.js";
import adminDevisRoutes from "./routes/admin.devis.routes.js";
import devisTorsionRoutes from "./routes/devisTorsion.routes.js";
import devisCompressionRoutes from "./routes/devisCompression.routes.js";
import devisGrilleRoutes from "./routes/devisGrille.routes.js";
import devisFillDresseRoutes from "./routes/devisfilDresse.routes.js";
import devisAutreRoutes from "./routes/devisAutre.routes.js"; // Autres demandes de devis
import ProductRoutes  from "./routes/product.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import ArticleRoutes from "./routes/article.routes.js";
import devisRoutes from "./routes/devis.routes.js"; // Autres demandes de devis
import reclamationRoutes from "./routes/reclamation.routes.js";

dotenv.config();


const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"]
}));


app.use(express.json());
app.use(cookieParser()); // pour lire/écrire les cookies
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/myapp_db";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

app.get("/", (_, res) => res.send("API OK"));
app.use("/api/categories", categoryRoutes);
// Authentification
app.use("/api/auth", authRegisterRoutes); // Inscription
app.use("/api/auth", authLoginRoutes);    // Connexion / Déconnexion
app.use("/api/produits", ProductRoutes);
app.use("/api/articles", ArticleRoutes);
// Utilisateurs
app.use("/api/users", userRoutes);

// Soumissions client
app.use("/api/devis/traction", devisTractionRoutes);
app.use("/api/devis/torsion", devisTorsionRoutes);
app.use("/api/devis/compression", devisCompressionRoutes);
app.use("/api/devis/grille", devisGrilleRoutes);
app.use("/api/devis/filDresse", devisFillDresseRoutes);
app.use("/api/devis/autre", devisAutreRoutes); // Autres demandes de devis
app.use("/api/devis", devisRoutes); // Autres demandes de devis
app.use("/api/reclamations", reclamationRoutes);
// Admin (listing, PDF, etc.)
app.use("/api/admin", adminDevisRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// Gestion d'erreurs
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);

// Shutdown propre
const shutdown = async () => {
  console.log("\n⏹️  Shutting down...");
  await mongoose.connection.close();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
