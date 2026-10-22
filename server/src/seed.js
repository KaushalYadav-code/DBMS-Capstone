import "dotenv/config";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabase, connectDatabase, getDatabase } from "./db.js";

const sampleProjects = [
  { name: "Payments API", description: "Node.js service for checkout and payment processing.", owner: "Platform team", ecosystem: "npm" },
  { name: "Customer Portal", description: "Customer account dashboard and self-service workflows.", owner: "Web team", ecosystem: "npm" },
  { name: "Mobile SDK", description: "Shared client library for mobile application teams.", owner: "Mobile team", ecosystem: "npm" },
  { name: "Data Services", description: "Python services for internal reporting and analytics.", owner: "Data team", ecosystem: "PyPI" }
];

const samplePackages = [
  { name: "express", version: "4.18.2", comparisonVersion: "4.18.3", ecosystem: "npm", license: "MIT", project: "Payments API", status: "review", versionConstraint: "^4.18.2", description: "Minimal web framework for Node.js." },
  { name: "mongoose", version: "8.4.1", comparisonVersion: "8.5.0", ecosystem: "npm", license: "MIT", project: "Payments API", versionConstraint: "^8.4.1", description: "MongoDB object modeling for Node.js." },
  { name: "lodash", version: "4.17.20", comparisonVersion: "4.17.21", ecosystem: "npm", license: "MIT", project: "Payments API", status: "review", versionConstraint: "^4.17.20", description: "Utility library for common JavaScript operations." },
  { name: "axios", version: "1.6.8", comparisonVersion: "1.7.0", ecosystem: "npm", license: "MIT", project: "Customer Portal", versionConstraint: "^1.6.8", description: "Promise-based HTTP client." },
  { name: "react", version: "18.2.0", comparisonVersion: "18.3.0", ecosystem: "npm", license: "MIT", project: "Customer Portal", versionConstraint: "^18.2.0", description: "Library for building user interfaces." },
  { name: "vite", version: "5.2.8", comparisonVersion: "5.3.0", ecosystem: "npm", license: "MIT", project: "Customer Portal", status: "review", versionConstraint: "^5.2.8", description: "Frontend build tool and development server." },
  { name: "jsonwebtoken", version: "9.0.2", comparisonVersion: "9.0.2", ecosystem: "npm", license: "MIT", project: "Mobile SDK", versionConstraint: "^9.0.2", description: "JSON Web Token implementation for Node.js." },
  { name: "fastapi", version: "0.110.0", comparisonVersion: "0.111.0", ecosystem: "PyPI", license: "MIT", project: "Data Services", versionConstraint: "^0.110.0", description: "Python framework for building APIs." },
  { name: "pydantic", version: "2.6.4", comparisonVersion: "2.7.0", ecosystem: "PyPI", license: "MIT", project: "Data Services", versionConstraint: "^2.6.4", description: "Data validation using Python type annotations." }
];

const sampleFindings = [
  { identifier: "DG-DEMO-001", packageName: "lodash", packageVersion: "4.17.20", severity: "High", affectedVersions: "demo range: < 4.17.21", recommendedAction: "Demonstration record only. Review a trusted advisory source and plan an update." },
  { identifier: "DG-DEMO-002", packageName: "express", packageVersion: "4.18.2", severity: "Medium", affectedVersions: "demo range: 4.18.x", recommendedAction: "Demonstration record only. Check upstream release notes before upgrading." },
  { identifier: "DG-DEMO-003", packageName: "vite", packageVersion: "5.2.8", severity: "Medium", affectedVersions: "demo range: 5.2.x", recommendedAction: "Demonstration record only. Review the changelog and plan a tested update." }
];

export async function seedDemonstrationData() {
  const db = getDatabase();
  const now = new Date();
  const projectsByName = new Map();
  for (const sample of sampleProjects) {
    const nameKey = sample.name.toLocaleLowerCase("en-US");
    const record = await db.collection("projects").findOneAndUpdate(
      { nameKey },
      { $set: { ...sample, nameKey, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true, returnDocument: "after" }
    );
    projectsByName.set(sample.name, record?.value ?? record);
  }

  const packagesByKey = new Map();
  for (const item of samplePackages) {
    const { project: projectName, status, versionConstraint, ...packageData } = item;
    const record = await db.collection("packages").findOneAndUpdate(
      { name: packageData.name, version: packageData.version, ecosystem: packageData.ecosystem },
      { $set: { ...packageData, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true, returnDocument: "after" }
    );
    const pkg = record?.value ?? record;
    packagesByKey.set(`${packageData.name}@${packageData.version}`, pkg);
    const project = projectsByName.get(projectName);
    const dependency = {
      projectId: project._id,
      sourcePackageId: null,
      targetPackageId: pkg._id,
      dependencyType: "direct",
      versionConstraint: versionConstraint || packageData.version,
      reviewStatus: status || "current",
      updatedAt: now
    };
    await db.collection("dependencies").updateOne(
      { projectId: dependency.projectId, sourcePackageId: null, targetPackageId: dependency.targetPackageId },
      { $set: dependency, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
  }

  for (const finding of sampleFindings) {
    const { packageName, packageVersion, ...data } = finding;
    const pkg = packagesByKey.get(`${packageName}@${packageVersion}`);
    await db.collection("vulnerabilities").updateOne(
      { identifier: data.identifier },
      { $set: { ...data, packageId: pkg._id, description: "Demonstration data only; not a verified advisory or scan result.", verificationStatus: "sample", status: "Open", updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
  }
  return { projects: sampleProjects.length, packages: samplePackages.length, vulnerabilities: sampleFindings.length };
}

if (process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  try {
    await connectDatabase();
    const counts = await seedDemonstrationData();
    console.info(`Seed complete (repeatable): ${counts.projects} projects, ${counts.packages} packages, ${counts.vulnerabilities} demonstration vulnerability notes.`);
  } catch (error) {
    console.error(`Database seed failed (${error.name || "error"}). Check the local MongoDB service and environment configuration.`);
    process.exitCode = 1;
  } finally {
    await closeDatabase().catch(() => {});
  }
}
