// MTR_Backend/routes/product.routes.js
import { Router } from "express";
import { upload } from "../middleware/upload.js";
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controller.js";

const router = Router();

router.post("/", upload.array("images", 10), createProduct);
router.get("/", getProducts);
router.get("/:id", getProductById);
router.put("/:id", upload.array("images", 10), updateProduct); // maj avec images
router.delete("/:id", deleteProduct);

export default router;
