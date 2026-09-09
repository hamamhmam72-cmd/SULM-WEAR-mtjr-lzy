import { Router, type IRouter } from "express";
import { serveProductObject } from "../lib/adminObjectStorage";

const router: IRouter = Router();

router.get("/storage/objects/catalog/:objectId", async (req, res): Promise<void> => {
  try {
    await serveProductObject(req.params.objectId, res);
  } catch (error) {
    req.log.error({ err: error, objectId: req.params.objectId }, "Product media download failed");
    if (!res.headersSent) res.status(503).json({ error: "Media is temporarily unavailable" });
  }
});

export default router;