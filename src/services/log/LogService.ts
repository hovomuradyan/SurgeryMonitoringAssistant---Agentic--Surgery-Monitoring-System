import type { LogEntry } from "../../types/log";

type LogSubscriber = (entry: LogEntry) => void;

class LogService {
  private subscribers: Set<LogSubscriber> = new Set();

  /**
   * Subscribes a callback to receive log entries.
   * Returns an unsubscribe function that removes the callback.
   */
  subscribe(callback: LogSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Publishes a log entry to all current subscribers.
   */
  log(entry: LogEntry): void {
    this.subscribers.forEach((callback) => callback(entry));
  }
}

/** Singleton LogService instance shared across the application. */
export const logService = new LogService();
