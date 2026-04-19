import React, { useEffect, useRef } from "react";
import { useLogEntries } from "../hooks/useLogEntries";
import { formatLogEntry } from "../services/log";
import type { LogLevel } from "../types/log";

const levelColorMap: Record<LogLevel, string> = {
  info: "text-blue-600 dark:text-blue-400",
  warn: "text-yellow-600 dark:text-yellow-400",
  error: "text-red-600 dark:text-red-400",
  debug: "text-gray-500 dark:text-gray-400",
};

function LogPanel() {
  const { entries } = useLogEntries();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [entries]);

  return (
    <div className="rounded-lg shadow-md overflow-hidden bg-white dark:bg-gray-900 flex flex-col h-full">
      <div className="flex items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          System Logs
        </h2>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-0.5"
        data-testid="log-scroll-container"
      >
        {entries.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            No log entries yet.
          </p>
        ) : (
          entries.map((entry, index) => (
            <div
              key={index}
              className={`font-mono text-xs leading-relaxed ${levelColorMap[entry.level]}`}
              data-testid="log-entry"
            >
              {formatLogEntry(entry)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default React.memo(LogPanel);
