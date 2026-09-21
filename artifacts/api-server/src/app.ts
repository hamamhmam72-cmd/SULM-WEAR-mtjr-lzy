import express, { type Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { recordRouteMetric } from "./lib/systemDiagnostics";

// تصحيح استيراد pino-http ليتوافق مع ES Modules و TypeScript
const pinoMiddleware: any = (pinoHttp as any).default || pinoHttp;

const app: Express = express();

app.use(
  pinoMiddleware({
    logger,
    serializers: {
      req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req: any) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// تحديد أنواع البيانات (Types) بوضوح لتجنب خطأ TS7006
app.use((req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  res.on("finish", () => {
    const path = req.path
      .replace(/\/\d+(?=\/|$)/g, "/:id")
      .replace(/\/SULM-[A-Za-z0-9-]+(?=\/|$)/g, "/:orderNumber")
      .replace(/\/[0-9a-f-]{32,}(?=\/|$)/gi, "/:token");
    recordRouteMetric(`${req.method} ${path}`, Date.now() - startedAt, res.statusCode >= 400);
  });
  next();
});

app.use("/api", router);

export default app;