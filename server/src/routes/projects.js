import { Router } from "express";
import { getDatabase } from "../db.js";
import { ApiError, escapeRegex, notFound, optionalHttpUrl, optionalText, parseLimit, parseObjectId, requireText, sendData } from "./helpers.js";

const router = Router();
const projectFields = ["name", "description", "ecosystem", "owner", "repository"];

function toProject(document) {
  if (!document) return null;
  const { nameKey, ...project } = document;
  return project;
}

router.get("/", async (req, res) => {
  const db = getDatabase();
  const query = {};
  if (req.query.ecosystem) query.ecosystem = String(req.query.ecosystem).trim();
  if (req.query.q) {
    const search = new RegExp(escapeRegex(String(req.query.q).trim()), "i");
    query.$or = [{ name: search }, { description: search }, { owner: search }];
  }
  const projects = await db.collection("projects")
    .find(query)
    .sort({ updatedAt: -1, name: 1 })
    .limit(parseLimit(req.query.limit))
    .toArray();
  sendData(res, projects.map(toProject));
});

router.post("/", async (req, res) => {
  const db = getDatabase();
  const name = requireText(req.body.name, "Project name", 80);
  const nameKey = name.toLocaleLowerCase("en-US");
  if (await db.collection("projects").findOne({ nameKey })) {
    throw new ApiError(409, "DUPLICATE_PROJECT", "A project with that name already exists.");
  }
  const now = new Date();
  const project = {
    name,
    nameKey,
    description: optionalText(req.body.description, "Description", 500),
    ecosystem: optionalText(req.body.ecosystem, "Ecosystem", 40),
    owner: optionalText(req.body.owner, "Owner", 80) || "Unassigned",
    repository: optionalHttpUrl(req.body.repository, "Repository URL", 300),
    createdAt: now,
    updatedAt: now
  };
  const result = await db.collection("projects").insertOne(project);
  sendData(res, { ...project, _id: result.insertedId }, 201);
});

router.get("/:id", async (req, res) => {
  const db = getDatabase();
  const id = parseObjectId(req.params.id, "Project ID");
  const project = await db.collection("projects").findOne({ _id: id });
  if (!project) notFound("Project");
  sendData(res, toProject(project));
});

router.put("/:id", async (req, res) => {
  const db = getDatabase();
  const id = parseObjectId(req.params.id, "Project ID");
  const updates = {};
  for (const field of projectFields) {
    if (req.body[field] === undefined) continue;
    if (field === "name") updates.name = requireText(req.body.name, "Project name", 80);
    else if (field === "description") updates.description = optionalText(req.body.description, "Description", 500);
    else if (field === "ecosystem") updates.ecosystem = optionalText(req.body.ecosystem, "Ecosystem", 40);
    else if (field === "owner") updates.owner = optionalText(req.body.owner, "Owner", 80) || "Unassigned";
    else if (field === "repository") updates.repository = optionalHttpUrl(req.body.repository, "Repository URL", 300);
  }
  if (!Object.keys(updates).length) throw new ApiError(400, "VALIDATION_ERROR", "Provide at least one project field to update.");
  if (updates.name) {
    updates.nameKey = updates.name.toLocaleLowerCase("en-US");
    const duplicate = await db.collection("projects").findOne({ nameKey: updates.nameKey, _id: { $ne: id } });
    if (duplicate) throw new ApiError(409, "DUPLICATE_PROJECT", "A project with that name already exists.");
  }
  updates.updatedAt = new Date();
  const result = await db.collection("projects").findOneAndUpdate({ _id: id }, { $set: updates }, { returnDocument: "after" });
  const project = result?.value ?? result;
  if (!project) notFound("Project");
  sendData(res, toProject(project));
});

router.delete("/:id", async (req, res) => {
  const db = getDatabase();
  const id = parseObjectId(req.params.id, "Project ID");
  const project = await db.collection("projects").findOne({ _id: id }, { projection: { _id: 1 } });
  if (!project) notFound("Project");
  const relationshipResult = await db.collection("dependencies").deleteMany({ projectId: id });
  const result = await db.collection("projects").deleteOne({ _id: id });
  if (!result.deletedCount) notFound("Project");
  sendData(res, { deleted: true, removedDependencies: relationshipResult.deletedCount });
});

export default router;
