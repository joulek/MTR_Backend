import jwt from "jsonwebtoken";

export default function auth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Token manquant" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Récupérer l'ID utilisateur peu importe la clé
    const userId = decoded.sub || decoded.id || decoded._id || decoded.userId;
    if (!userId) {
      return res.status(401).json({ error: "ID utilisateur manquant dans le token" });
    }

    // Normaliser les infos utilisateur
    req.user = {
      id: userId,
      role: decoded.role
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Token invalide ou expiré" });
  }
}

/**
 * Autoriser uniquement certains rôles.
 * Utilisation: router.post('/xxx', auth, only('client'), handler)
 */
export function only(...roles) {
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(401).json({ error: "Non authentifié" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Accès refusé" });
    }
    next();
  };
}