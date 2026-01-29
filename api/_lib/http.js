/**
 * HTTP utilities for Vercel serverless functions
 */

export function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

export function sendError(res, err) {
  const status = err?.statusCode || 500;
  const message = err?.message || "Internal Server Error";
  sendJson(res, status, { error: message });
}

export function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        const err = new Error("Invalid JSON body");
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

export function onlyMethods(req, allowed) {
  if (!allowed.includes(req.method)) {
    const err = new Error(`Method ${req.method} not allowed`);
    err.statusCode = 405;
    return err;
  }
  return null;
}
