// controllers/userController.js
import User from "../models/User.js";
// controllers/adminUsers.controller.js
import crypto from "crypto";

const ttlHours = 48; // lien valable 48h
import { makeTransport } from "../utils/mailer.js";
/** Récupérer l'utilisateur connecté */
export const me = async (req, res) => {
  // ⚠️ lire l'id depuis req.user.id (middleware auth)
  const user = await User.findById(req.user?.id);
  if (!user)
    return res.status(404).json({ message: "Utilisateur introuvable" });
  res.json(user.toJSON());
};

/** Modifier le profil de l'utilisateur connecté */
export const updateMe = async (req, res) => {
  try {
    const allowed = [
      "nom",
      "prenom",
      "numTel",
      "adresse",
      "personal",
      "company",
    ];
    const payload = {};
    for (const key of allowed) {
      if (key in req.body) payload[key] = req.body[key];
    }

    // ⚠️ lire l'id depuis req.user.id (middleware auth)
    const user = await User.findByIdAndUpdate(req.user?.id, payload, {
      new: true,
    });
    if (!user)
      return res.status(404).json({ message: "Utilisateur introuvable" });
    res.json(user.toJSON());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Liste des utilisateurs (admin) */
export const listUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users.map((u) => u.toJSON()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// controllers/admin.users.controller.js

export const inviteUser = async (req, res) => {
  try {
    const {
      nom,
      prenom,
      email,
      numTel,
      adresse,
      accountType = "personnel",
      role = "client",
      personal,
      company,
    } = req.body || {};

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "email est obligatoire" });
    }

    // موجود مسبقًا؟
    const exists = await User.findOne({ email }).lean();
    if (exists) {
      return res
        .status(409)
        .json({ success: false, message: "Utilisateur existe déjà" });
    }

    // إنشاء المستخدم بدون كلمة سر
    const user = await User.create({
      nom,
      prenom,
      email,
      numTel,
      adresse,
      accountType,
      role,
      personal,
      company,
      password: null,
    });

    // توكن الدعوة + انتهاء
    const token = crypto.randomBytes(24).toString("hex");
    const expireAt = new Date(Date.now() + ttlHours * 3600 * 1000);

    await User.findByIdAndUpdate(user._id, {
      $set: { resetPassword: { token, expireAt, reason: "invite" } },
    });

    // رابط تعيين كلمة السر (يرجع دائمًا للفرونت كـ fallback)
    const appUrl = process.env.APP_FRONT_URL || "http://localhost:3000";
    const locale = "fr";
    const setPwdLink = `${appUrl}/${locale}/set-password?uid=${user._id}&token=${token}`;

    // إرسال الإيميل عبر الإعدادات الحالية (Gmail أو غيره)
    let emailResult = { sent: false };
    try {
      const transport = makeTransport();
      const from = process.env.MAIL_FROM || process.env.SMTP_USER; // مثال Gmail: "MTR Industry <your@gmail.com>"

      await transport.sendMail({
        from,
        to: email,
        subject: "Activez votre compte MTR Industry",
        text: `Bonjour ${prenom || ""} ${nom || ""},
Un administrateur vous a créé un compte sur MTR Industry.

Cliquez sur ce lien pour définir votre mot de passe (valable ${ttlHours}h) :
${setPwdLink}

Cordialement.`,
        html: `
          <p>Bonjour <b>${prenom || ""} ${nom || ""}</b>,</p>
          <p>Un administrateur vous a créé un compte sur <b>MTR Industry</b>.</p>
          <p>Cliquez sur ce bouton pour définir votre mot de passe (valable ${ttlHours}h) :</p>
          <p><a href="${setPwdLink}" style="display:inline-block;background:#0B1E3A;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">Définir mon mot de passe</a></p>
          <p>Si le bouton ne s'affiche pas, copiez/collez ce lien :</p>
          <p><code>${setPwdLink}</code></p>
        `,
      });

      emailResult.sent = true;
    } catch (e) {
      console.error(
        "inviteUser mail error (SMTP):",
        e?.response || e?.message || e
      );
      emailResult = { sent: false, error: e?.message || "SMTP error" };
      // نواصل عادي: نرجع setPwdLink للفرونت باش تنجم تبعثه يدويًا
    }

    return res
      .status(201)
      .json({
        success: true,
        userId: user._id,
        setPwdLink,
        email: emailResult,
      });
  } catch (e) {
    console.error("inviteUser:", e);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
};
