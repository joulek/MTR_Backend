// routes/auth.routes.js
import { Router } from "express";
import { registerClient, registerAdmin, login } from "../controllers/authController.js";
const router = Router();
router.post("/register-client", registerClient);
router.post("/register-admin", registerAdmin);
router.post("/login", login);
export default router;
