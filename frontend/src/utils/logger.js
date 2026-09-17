/**
 * Beyond404 Centralized Client-Side Logger
 * Provides structured logging with levels, timestamps, components,
 * in-memory circular buffer, listener subscriptions, and file export.
 */

const MAX_LOGS = 500;
const logsBuffer = [];
const subscribers = new Set();

function formatTime() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

function addLog(level, scope, message, meta = null) {
  const entry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    time: formatTime(),
    timestamp: new Date().toISOString(),
    level,
    scope,
    message: typeof message === "object" ? JSON.stringify(message) : String(message),
    meta,
  };

  logsBuffer.push(entry);
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.shift();
  }

  // Console output
  const prefix = `[${entry.time}] [${level.padEnd(5)}] [${scope}]`;
  if (level === "ERROR") {
    console.error(prefix, message, meta || "");
  } else if (level === "WARN") {
    console.warn(prefix, message, meta || "");
  } else if (level === "DEBUG") {
    console.debug(prefix, message, meta || "");
  } else {
    console.log(prefix, message, meta || "");
  }

  // Notify listeners
  subscribers.forEach((cb) => {
    try {
      cb(entry, logsBuffer);
    } catch (_) {}
  });

  return entry;
}

export const logger = {
  info: (scope, msg, meta) => addLog("INFO", scope, msg, meta),
  warn: (scope, msg, meta) => addLog("WARN", scope, msg, meta),
  error: (scope, msg, meta) => addLog("ERROR", scope, msg, meta),
  debug: (scope, msg, meta) => addLog("DEBUG", scope, msg, meta),

  getLogs: () => [...logsBuffer],
  clearLogs: () => {
    logsBuffer.length = 0;
    subscribers.forEach((cb) => cb(null, []));
  },
  subscribe: (callback) => {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },
  exportLogsText: () => {
    return logsBuffer
      .map((l) => `[${l.timestamp}] [${l.level.padEnd(5)}] [${l.scope}] ${l.message}`)
      .join("\n");
  },
};

export default logger;
