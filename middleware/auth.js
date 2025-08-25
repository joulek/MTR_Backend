// middleware/auth.js
import jwt from "jsonwebtoken";

export default function auth(req, res, next) {
  const token =
    req.cookies?.token ||                      // 👈 même nom que dans res.cookie(...)
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  if (!token) return res.status(401).json({ message: "Non authentifié" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ message: "Session expirée" });
  }
}
export function only(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) return res.status(401).json({ error: "Non authentifié" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Accès refusé" });
    next();
  };
}
// middleware/auth.js
export function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Non authentifié" });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Non authentifié" });
  }
  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Accès réservé aux administrateurs" });
  }
  next();
}

