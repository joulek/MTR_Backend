// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import devisTractionRoutes from "./routes/devisTraction.routes.js";
import adminDevisRoutes   from "./routes/admin.devis.routes.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());

// ⚠️ ENLÈVE cette ligne (ne la remplace pas par /(.*) ou autre)
// app.options("*", cors());   // <-- à supprimer

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/myapp_db";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

app.get("/", (_, res) => res.send("API OK"));
app.use("/api/auth", authRoutes);   // pas de regex ici
app.use("/api/users", userRoutes);  // pas de regex ici

// => pour les soumissions client (ce que ton proxy Next appelle)
app.use("/api/devis/traction", devisTractionRoutes);

// => pour l’admin (listing, PDF, etc.)
app.use("/api/admin", adminDevisRoutes);


app.use((req, res) => res.status(404).json({ error: "Route not found" }));

app.use((err, req, res, next) => {
  console.error("🔥 Error:", err);
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);

const shutdown = async () => {
  console.log("\n⏹️  Shutting down...");
  await mongoose.connection.close();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
