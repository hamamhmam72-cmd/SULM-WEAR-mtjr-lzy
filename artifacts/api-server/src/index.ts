import app from "./app";
import { logger } from "./lib/logger";
import { runSystemDiagnostics } from "./lib/systemDiagnostics";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const diagnostics = await runSystemDiagnostics();
if (diagnostics.status === "critical") {
  logger.error(
    { failedChecks: diagnostics.checks.filter((check) => check.status === "critical").map((check) => check.key) },
    "Startup integrity diagnostics reported critical findings",
  );
} else {
  logger.info({ status: diagnostics.status }, "Startup integrity diagnostics completed");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
