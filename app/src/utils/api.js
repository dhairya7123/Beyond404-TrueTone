/**
 * Beyond404 Backend URI & API Configuration Service
 * Provides centralized management of the backend gateway URI (Cloudflare Tunnel,
 * local server, remote host, etc.), URL normalization, WebSocket URL generation,
 * and connection health testing.
 */

const STORAGE_KEY = "beyond404_backend_uri";

/**
 * Normalizes an arbitrary user-entered URI into a well-formed HTTP/HTTPS URL
 * without trailing slashes.
 */
export function normalizeBackendUri(rawUri) {
  if (!rawUri) return "";
  let uri = rawUri.trim();

  // Strip trailing slashes
  uri = uri.replace(/\/+$/, "");

  // If protocol is missing, deduce http vs https
  if (!/^https?:\/\//i.test(uri)) {
    if (
      uri.startsWith("localhost") ||
      uri.startsWith("127.0.0.1") ||
      uri.startsWith("10.0.2.2") ||
      /^192\.168\./.test(uri) ||
      /^10\./.test(uri)
    ) {
      uri = `http://${uri}`;
    } else {
      uri = `https://${uri}`;
    }
  }

  return uri;
}

/**
 * Retrieves the currently active backend URI from persistent localStorage.
 * Fallbacks to empty string or current host if nothing is stored.
 */
export function getBackendUri() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return normalizeBackendUri(saved);
    }
  } catch (_) {}
  return "";
}

/**
 * Sets and persists a new backend URI in localStorage, and triggers a window event
 * so all active components can synchronize immediately.
 */
export function setBackendUri(newUri) {
  const normalized = normalizeBackendUri(newUri);
  try {
    if (normalized) {
      localStorage.setItem(STORAGE_KEY, normalized);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (_) {}

  // Dispatch event for reactive listeners
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("backend-uri-changed", { detail: normalized })
    );
  }

  return normalized;
}

/**
 * Resolves a given endpoint path against the configured backend URI.
 * If endpoint is already an absolute URL, returns it as-is.
 */
export function apiUrl(endpoint, customBase) {
  if (!endpoint) return "";
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  const base = customBase !== undefined ? normalizeBackendUri(customBase) : getBackendUri();
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  if (base) {
    return `${base}${path}`;
  }

  // Fallback to relative path (working with Vite proxy during web dev)
  return path;
}

/**
 * Generates the full WebSocket URL corresponding to the backend URI.
 * Automatically maps http -> ws and https -> wss.
 */
export function getWsUrl(userId, customBase) {
  const base = customBase !== undefined ? normalizeBackendUri(customBase) : getBackendUri();

  if (base) {
    try {
      const parsed = new URL(base);
      const wsProto = parsed.protocol === "https:" ? "wss:" : "ws:";
      return `${wsProto}//${parsed.host}/ws?userId=${encodeURIComponent(userId || "")}`;
    } catch (_) {
      const wsBase = base.replace(/^https:\/\//i, "wss://").replace(/^http:\/\//i, "ws://");
      return `${wsBase}/ws?userId=${encodeURIComponent(userId || "")}`;
    }
  }

  // Fallback for browser dev mode
  if (typeof window !== "undefined") {
    const wsProto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsHost = window.location.port
      ? `${window.location.hostname}:8080`
      : window.location.host;
    return `${wsProto}//${wsHost}/ws?userId=${encodeURIComponent(userId || "")}`;
  }

  return `ws://localhost:8080/ws?userId=${encodeURIComponent(userId || "")}`;
}

/**
 * Performs a connectivity check against the given backend URI.
 * Returns { ok: boolean, message: string, usersCount?: number, status?: number }
 */
export async function testBackendConnection(rawUri, timeoutMs = 8000) {
  const uri = normalizeBackendUri(rawUri);
  if (!uri) {
    return { ok: false, message: "Backend URI is empty. Please enter a valid URL." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const target = `${uri}/api/users`;
    const res = await fetch(target, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
      },
    });

    clearTimeout(timer);

    if (res.ok) {
      try {
        const data = await res.json();
        const count = Array.isArray(data.users) ? data.users.length : 0;
        return {
          ok: true,
          status: res.status,
          usersCount: count,
          message: `Connected successfully! Gateway active with ${count} registered users.`,
        };
      } catch (_) {
        return {
          ok: true,
          status: res.status,
          message: "Connected successfully! Gateway responded with HTTP 200.",
        };
      }
    } else {
      return {
        ok: false,
        status: res.status,
        message: `Gateway responded with HTTP error ${res.status}: ${res.statusText}`,
      };
    }
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      return {
        ok: false,
        message: `Connection timed out after ${timeoutMs / 1000}s. Check if tunnel is active.`,
      };
    }
    return {
      ok: false,
      message: `Failed to connect: ${err.message || "Network unreachable"}`,
    };
  }
}

/**
 * Standard fetch wrapper that automatically routes to the configured backend URI.
 */
export async function apiFetch(endpoint, options = {}) {
  const fullUrl = apiUrl(endpoint);
  return fetch(fullUrl, options);
}
