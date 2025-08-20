import { Router } from "express";
import {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle
} from "../controllers/article.controller.js";

const router = Router();

router.get("/", getArticles);
router.get("/:id", getArticleById);
router.post("/", createArticle);
router.put("/:id", updateArticle);
router.delete("/:id", deleteArticle);

export default router;
