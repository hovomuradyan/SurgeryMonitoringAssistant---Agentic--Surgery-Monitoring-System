import type { LogEntry, LogLevel, FormattedLogEntry } from "../../types/log";

const VALID_LOG_LEVELS: readonly LogLevel[] = [
  "info",
  "warn",
  "error",
  "debug",
];

const LOG_FORMAT_REGEX =
  /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[(info|warn|error|debug)\] (.+)$/;

/**
 * Pads a number to two digits.
 */
function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Formats a Date to "YYYY-MM-DD HH:mm:ss" in UTC.
 */
function formatTimestamp(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

/**
 * Produces the formatted string for a log entry.
 * Format: [YYYY-MM-DD HH:mm:ss] [LEVEL] message
 */
export function formatLogEntry(entry: LogEntry): string {
  return `[${formatTimestamp(entry.timestamp)}] [${entry.level}] ${entry.message}`;
}

/**
 * Validates a LogEntry and returns a FormattedLogEntry with the `formatted` string added.
 * Throws TypeError for malformed input.
 */
export function parseLogEntry(entry: LogEntry): FormattedLogEntry {
  if (entry == null || typeof entry !== "object") {
    throw new TypeError("LogEntry must be a non-null object");
  }

  if (!(entry.timestamp instanceof Date) || isNaN(entry.timestamp.getTime())) {
    throw new TypeError("LogEntry.timestamp must be a valid Date");
  }

  if (!VALID_LOG_LEVELS.includes(entry.level)) {
    throw new TypeError(
      `LogEntry.level must be one of: ${VALID_LOG_LEVELS.join(", ")}`
    );
  }

  if (typeof entry.message !== "string" || entry.message.length === 0) {
    throw new TypeError("LogEntry.message must be a non-empty string");
  }

  return {
    timestamp: entry.timestamp,
    level: entry.level,
    message: entry.message,
    formatted: formatLogEntry(entry),
  };
}

/**
 * Parses a formatted log string back into a LogEntry.
 * Expected format: [YYYY-MM-DD HH:mm:ss] [LEVEL] message
 * Throws a descriptive error for malformed strings.
 */
export function parseFormattedLogEntry(formatted: string): LogEntry {
  if (typeof formatted !== "string") {
    throw new Error("Input must be a string");
  }

  const match = formatted.match(LOG_FORMAT_REGEX);
  if (!match) {
    throw new Error(
      `Malformed log string. Expected format: [YYYY-MM-DD HH:mm:ss] [LEVEL] message. Received: "${formatted}"`
    );
  }

  const [, timestampStr, level, message] = match;
  const timestamp = new Date(timestampStr.replace(" ", "T") + "Z");

  if (isNaN(timestamp.getTime())) {
    throw new Error(`Invalid timestamp in log string: "${timestampStr}"`);
  }

  return {
    timestamp,
    level: level as LogLevel,
    message,
  };
}
