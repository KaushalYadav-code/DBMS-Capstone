export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      cache: "no-store",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
  } catch {
    const openedFromFile = typeof window !== "undefined" && window.location.protocol === "file:";
    throw new Error(openedFromFile
      ? "This page was opened directly from a file. Run npm start in the server folder, then open the HTTP address printed by DepGraph."
      : "Cannot reach the DepGraph API. Confirm the local server is running and retry.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || (payload.database === "disconnected"
      ? "MongoDB is not connected. Start the local MongoDB service and retry."
      : `Request failed (${response.status}).`));
  }
  return payload.data === undefined ? payload : payload.data;
}
