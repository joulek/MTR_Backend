// routes/auth.routes.js
import { Router } from "express";
import { registerClient, registerAdmin } from "../controllers/authController.js";

const router = Router();

// POST /api/auth/register-client
router.post("/register-client", registerClient);

// POST /api/auth/register-admin
router.post("/register-admin", registerAdmin);

export default router;
