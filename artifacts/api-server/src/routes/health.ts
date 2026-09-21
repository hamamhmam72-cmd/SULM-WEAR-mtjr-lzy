import { Router, type IRouter, Request, Response } from "express";

const router: IRouter = Router();

router.get("/health", (req: Request, res: Response): void => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

export default router;