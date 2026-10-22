import { MongoClient } from "mongodb";

let client;
let database;

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
  const databaseName = process.env.DB_NAME || "depgraph";
  client = new MongoClient(uri, {
    appName: "DepGraph",
    serverSelectionTimeoutMS: 5000
  });

  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    database = client.db(databaseName);
    await migrateLegacyDocuments(database);
    await createIndexes(database);
    return database;
  } catch (error) {
    database = undefined;
    await client.close().catch(() => {});
    client = undefined;
    throw error;
  }
}

export function getDatabase() {
  if (!database) {
    const error = new Error("MongoDB is not connected.");
    error.code = "DB_UNAVAILABLE";
    error.status = 503;
    throw error;
  }
  return database;
}

export function isDatabaseConnected() {
  return Boolean(database);
}

export async function pingDatabase() {
  if (!client || !database) return false;
  await client.db("admin").command({ ping: 1 });
  return true;
}

export async function closeDatabase() {
  database = undefined;
  if (client) await client.close();
  client = undefined;
}

async function migrateLegacyDocuments(db) {
  const now = new Date();

  await db.collection("projects").updateMany(
    { nameKey: { $exists: false }, name: { $type: "string" } },
    [{ $set: { nameKey: { $toLower: { $trim: { input: "$name" } } } } }]
  );

  await db.collection("dependencies").updateMany(
    { packageId: { $exists: true } },
    [{ $set: {
      targetPackageId: { $ifNull: ["$targetPackageId", "$packageId"] },
      sourcePackageId: { $ifNull: ["$sourcePackageId", { $ifNull: ["$parentPackageId", null] }] },
      versionConstraint: { $ifNull: ["$versionConstraint", { $ifNull: ["$requestedRange", ""] }] },
      dependencyType: {
        $cond: [
          { $in: ["$dependencyType", ["development", "optional", "peer", "transitive"]] },
          "transitive",
          "direct"
        ]
      },
      reviewStatus: {
        $ifNull: ["$reviewStatus", { $cond: [{ $eq: ["$versionStatus", "review"] }, "review", "current"] }]
      },
      createdAt: { $ifNull: ["$createdAt", now] },
      updatedAt: { $ifNull: ["$updatedAt", now] }
    } }]
  );

  await db.collection("vulnerabilities").updateMany(
    { $or: [{ identifier: { $exists: false } }, { recommendedAction: { $exists: false } }] },
    [{ $set: {
      identifier: { $ifNull: ["$identifier", { $ifNull: ["$advisoryId", { $concat: ["DG-LEGACY-", { $toString: "$_id" }] }] }] },
      description: { $ifNull: ["$description", ""] },
      recommendedAction: { $ifNull: ["$recommendedAction", { $ifNull: ["$recommendation", ""] }] },
      affectedVersions: { $ifNull: ["$affectedVersions", ""] },
      status: { $ifNull: ["$status", "Open"] },
      createdAt: { $ifNull: ["$createdAt", now] },
      updatedAt: { $ifNull: ["$updatedAt", now] }
    } }]
  );
}

async function dropLegacyIndex(collection, fieldNames) {
  let indexes;
  try {
    indexes = await collection.listIndexes().toArray();
  } catch (error) {
    if (error.codeName === "NamespaceNotFound") return;
    throw error;
  }
  const oldIndex = indexes.find((index) => {
    if (!index.unique) return false;
    const fields = Object.keys(index.key || {});
    return fields.length === fieldNames.length && fields.every((field, index) => field === fieldNames[index]);
  });
  if (oldIndex) await collection.dropIndex(oldIndex.name);
}

async function ensureIndex(collection, key, options) {
  let indexes = [];
  try {
    indexes = await collection.listIndexes().toArray();
  } catch (error) {
    if (error.codeName !== "NamespaceNotFound") throw error;
  }
  const existing = indexes.find((index) => JSON.stringify(index.key) === JSON.stringify(key));
  if (existing && Boolean(existing.unique) === Boolean(options.unique)) return existing.name;
  return collection.createIndex(key, options);
}

async function createIndexes(db) {
  const projects = db.collection("projects");
  const packages = db.collection("packages");
  const dependencies = db.collection("dependencies");
  const vulnerabilities = db.collection("vulnerabilities");

  await dropLegacyIndex(dependencies, ["projectId", "packageId"]);
  await dropLegacyIndex(vulnerabilities, ["advisoryId"]);

  await Promise.all([
    ensureIndex(projects, { nameKey: 1 }, { unique: true, name: "project_name_key_unique" }),
    ensureIndex(projects, { ecosystem: 1 }, { name: "project_ecosystem" }),
    ensureIndex(packages, { name: 1, version: 1, ecosystem: 1 }, { unique: true, name: "package_identity_unique" }),
    ensureIndex(packages, { ecosystem: 1, license: 1 }, { name: "package_ecosystem_license" }),
    ensureIndex(dependencies, { projectId: 1, sourcePackageId: 1, targetPackageId: 1 }, { unique: true, name: "dependency_edge_unique" }),
    ensureIndex(dependencies, { projectId: 1, targetPackageId: 1 }, { name: "dependency_project_target" }),
    ensureIndex(dependencies, { sourcePackageId: 1 }, { name: "dependency_source" }),
    ensureIndex(vulnerabilities, { identifier: 1 }, { unique: true, name: "vulnerability_identifier_unique" }),
    ensureIndex(vulnerabilities, { packageId: 1, status: 1 }, { name: "vulnerability_package_status" }),
    ensureIndex(vulnerabilities, { severity: 1, status: 1 }, { name: "vulnerability_severity_status" })
  ]);
}
