import { useState, useEffect } from "react";
import { LogEntry } from "../types/log";
import { logService } from "../services/log";

export interface UseLogEntriesResult {
  entries: LogEntry[];
}

/**
 * Custom hook that subscribes to the LogService singleton and
 * accumulates log entries in local state.
 *
 * Subscribes on mount and unsubscribes on unmount to prevent
 * memory leaks and stale state updates.
 */
export function useLogEntries(): UseLogEntriesResult {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    const unsubscribe = logService.subscribe((entry: LogEntry) => {
      setEntries((prev) => [...prev, entry]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { entries };
}
