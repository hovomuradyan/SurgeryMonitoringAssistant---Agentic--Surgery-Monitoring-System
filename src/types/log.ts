export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
}

export interface FormattedLogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  formatted: string;
}
