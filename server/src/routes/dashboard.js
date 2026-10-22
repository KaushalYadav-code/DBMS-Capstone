import { Router } from "express";
import { getDatabase } from "../db.js";
import { calculatePortfolioAnalytics } from "../intelligence/analysis.js";
import { sendData } from "./helpers.js";

const router = Router();

router.get("/", async (_req, res) => {
  const db = getDatabase();
  const [projects, packages, dependencies, vulnerabilities] = await Promise.all([
    db.collection("projects").find().sort({ name: 1 }).toArray(),
    db.collection("packages").find().sort({ name: 1, version: 1 }).toArray(),
    db.collection("dependencies").find().toArray(),
    db.collection("vulnerabilities").find().toArray()
  ]);
  sendData(res, calculatePortfolioAnalytics({ projects, packages, dependencies, vulnerabilities }));
});

export default router;
