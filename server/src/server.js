import "dotenv/config";
import app from "./app.js";
import { closeDatabase, connectDatabase } from "./db.js";

const port = Number.parseInt(process.env.PORT || "3000", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port.");

const address = `http://127.0.0.1:${port}`;
const server = app.listen(port, "127.0.0.1", () => {
  console.info(`DepGraph HTTP server is listening at ${address}.`);
  console.info("Waiting for MongoDB; /api/health reports disconnected until its connection succeeds.");
});
let stopping = false;

function safeErrorMessage(error) {
  const message = String(error?.message || "No connection detail was provided.");
  return message
    .replace(/mongodb(?:\+srv)?:\/\/[^\s'"<>]+/gi, "[MongoDB URI redacted]")
    .replace(/((?:password|pwd)\s*[=:]\s*)[^\s,;]+/gi, "$1[redacted]")
    .slice(0, 400);
}

async function connectWithRetry() {
  while (!stopping) {
    try {
      await connectDatabase();
      console.info(`DepGraph is ready at ${address}; MongoDB connected to database "${process.env.DB_NAME || "depgraph"}".`);
      return;
    } catch (error) {
      console.warn(`MongoDB connection failed (${error.name || "connection error"}): ${safeErrorMessage(error)}. The API remains not ready; retrying in 5 seconds.`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}
void connectWithRetry();

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.info(`${signal} received; closing DepGraph.`);
  server.close(async () => {
    await closeDatabase().catch(() => {});
    process.exit(0);
  });
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
