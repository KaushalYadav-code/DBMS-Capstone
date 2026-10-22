import express from "express";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { getDatabase, pingDatabase } from "./db.js";
import dashboardRoutes from "./routes/dashboard.js";
import dependencyRoutes from "./routes/dependencies.js";
import graphRoutes from "./routes/graph.js";
import packageRoutes from "./routes/packages.js";
import projectRoutes from "./routes/projects.js";
import vulnerabilityRoutes from "./routes/vulnerabilities.js";
import { ApiError } from "./routes/helpers.js";

const app = express();
const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use((req, _res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method) && req.path.startsWith("/api/") && (!req.body || typeof req.body !== "object" || Array.isArray(req.body))) {
    return next(new ApiError(400, "VALIDATION_ERROR", "Request body must be a JSON object."));
  }
  return next();
});

app.get("/api/health", async (_req, res) => {
  let connected = false;
  try {
    connected = await pingDatabase();
  } catch {}
  let databaseName = null;
  if (connected) {
    try { databaseName = getDatabase().databaseName; } catch {}
  }
  res.status(connected ? 200 : 503).json({
    ok: connected,
    database: connected ? "connected" : "disconnected",
    databaseName
  });
});
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/graph", graphRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/dependencies", dependencyRoutes);
app.use("/api/vulnerabilities", vulnerabilityRoutes);

app.use("/css", express.static(resolve(projectRoot, "css"), { dotfiles: "deny", index: false }));
app.use("/js", express.static(resolve(projectRoot, "js"), { dotfiles: "deny", index: false }));

app.use("/api", (_req, _res, next) => next(new ApiError(404, "NOT_FOUND", "API endpoint was not found.")));
app.get("/", (_req, res) => res.sendFile(resolve(projectRoot, "index.html")));
app.use((_req, res) => res.status(404).send("Page not found."));

app.use((error, _req, res, _next) => {
  if (error?.code === 11000) {
    return res.status(409).json({ code: "DUPLICATE_RECORD", error: "A record with those unique fields already exists." });
  }
  if (error?.name === "ValidationError" || error?.name === "CastError" || error?.type === "entity.parse.failed") {
    return res.status(400).json({ code: "INVALID_REQUEST", error: error.message || "Invalid request." });
  }
  const status = Number.isInteger(error?.status) ? error.status : ["MongoServerSelectionError", "MongoNetworkError", "MongoNotConnectedError"].includes(error?.name) ? 503 : 500;
  if (status >= 500 && status !== 503) console.error("DepGraph request failed:", error?.name || "Error");
  const message = error?.status ? error.message : status === 503 ? "MongoDB is currently unavailable. Check the local MongoDB service and retry." : "The server could not complete the request.";
  return res.status(status).json({ code: error?.code || (status === 503 ? "DB_UNAVAILABLE" : "SERVER_ERROR"), error: message });
});

export default app;
