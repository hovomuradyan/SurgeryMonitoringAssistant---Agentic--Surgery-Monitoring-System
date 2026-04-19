import React, { useEffect, useRef } from "react";
import type { AgentEvent } from "../services/agent/AgentEventService";

const severityColors: Record<string, string> = {
  info: "text-blue-600 dark:text-blue-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  critical: "text-red-600 dark:text-red-400",
  error: "text-red-600 dark:text-red-400",
  debug: "text-gray-500 dark:text-gray-400",
};

interface AgentLogPanelProps {
  logs: AgentEvent[];
}

function AgentLogPanel({ logs }: AgentLogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded-lg shadow-md overflow-hidden bg-white dark:bg-gray-900 flex flex-col h-full">
      <div className="flex items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Agent Logs
        </h2>
        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
          ({logs.length})
        </span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-0.5"
        data-testid="log-scroll-container"
      >
        {logs.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            Waiting for agent observations…
          </p>
        ) : (
          logs.map((entry, index) => (
            <div
              key={index}
              className={`font-mono text-xs leading-relaxed ${
                severityColors[entry.severity] ?? severityColors.info
              }`}
              data-testid="log-entry"
            >
              [{entry.timestamp}] [{entry.severity.toUpperCase()}]{" "}
              {entry.type === "report" ? entry.summary : entry.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default React.memo(AgentLogPanel);
