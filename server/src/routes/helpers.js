import { ObjectId } from "mongodb";

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function requireText(value, label, maxLength = 200) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, "VALIDATION_ERROR", `${label} is required.`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new ApiError(400, "VALIDATION_ERROR", `${label} must be ${maxLength} characters or fewer.`);
  }
  return text;
}

export function optionalText(value, label, maxLength = 500) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", `${label} must be text.`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new ApiError(400, "VALIDATION_ERROR", `${label} must be ${maxLength} characters or fewer.`);
  }
  return text;
}

export function optionalHttpUrl(value, label, maxLength = 300) {
  const text = optionalText(value, label, maxLength);
  if (!text) return "";
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported protocol.");
  } catch {
    throw new ApiError(400, "VALIDATION_ERROR", `${label} must be a valid HTTP or HTTPS URL.`);
  }
  return text;
}

export function parseObjectId(value, label = "ID") {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value)) {
    throw new ApiError(400, "INVALID_ID", `${label} must be a valid MongoDB ObjectId.`);
  }
  return new ObjectId(value);
}

export function optionalObjectId(value, label = "ID") {
  if (value === undefined || value === null || value === "") return null;
  return parseObjectId(value, label);
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeId(value) {
  return value instanceof ObjectId ? value.toHexString() : value;
}

export function toPublicDocument(document) {
  if (!document) return null;
  if (Array.isArray(document)) return document.map(toPublicDocument);
  const output = {};
  for (const [key, value] of Object.entries(document)) {
    output[key === "_id" ? "id" : key] = value instanceof ObjectId
      ? value.toHexString()
      : value instanceof Date
        ? value.toISOString()
        : Array.isArray(value)
          ? value.map((item) => item && typeof item === "object" ? toPublicDocument(item) : item)
          : value && typeof value === "object"
            ? toPublicDocument(value)
            : value;
  }
  return output;
}

export function sendData(res, data, status = 200) {
  return res.status(status).json({ data: toPublicDocument(data) });
}

export function notFound(label = "Record") {
  throw new ApiError(404, "NOT_FOUND", `${label} was not found.`);
}

export function requireOneOf(value, label, accepted) {
  if (!accepted.includes(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", `${label} must be one of: ${accepted.join(", ")}.`);
  }
  return value;
}

export function parseLimit(value, defaultLimit = 100, maxLimit = 500) {
  if (value === undefined) return defaultLimit;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Limit must be a positive integer.");
  }
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1) throw new ApiError(400, "VALIDATION_ERROR", "Limit must be a positive integer.");
  return Math.min(limit, maxLimit);
}
