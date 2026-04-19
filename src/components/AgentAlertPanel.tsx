import React, { useEffect, useRef } from "react";
import type { AgentEvent } from "../services/agent/AgentEventService";

interface AgentAlertPanelProps {
  alerts: AgentEvent[];
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") {
    return <span className="text-lg" role="img" aria-label="critical">🚨</span>;
  }
  return <span className="text-lg" role="img" aria-label="warning">⚠️</span>;
}

function AgentAlertPanel({ alerts }: AgentAlertPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [alerts]);

  return (
    <div className="rounded-lg shadow-md overflow-hidden bg-white dark:bg-gray-900 flex flex-col h-full">
      <div className="flex items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Safety Alerts
        </h2>
        {alerts.length > 0 && (
          <span className="ml-2 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-100 dark:bg-red-900/40 text-xs font-bold text-red-700 dark:text-red-400">
            {alerts.length}
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2"
        data-testid="alert-scroll-container"
      >
        {alerts.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            No safety alerts. Monitoring…
          </p>
        ) : (
          alerts.map((alert, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                alert.severity === "critical"
                  ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  : "bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
              }`}
              data-testid="alert-entry"
            >
              <SeverityIcon severity={alert.severity} />
              <div className="flex-1 min-w-0">
                <div
                  className={`font-medium ${
                    alert.severity === "critical"
                      ? "text-red-700 dark:text-red-400"
                      : "text-yellow-700 dark:text-yellow-400"
                  }`}
                >
                  {alert.message}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {alert.timestamp} · {alert.severity.toUpperCase()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default React.memo(AgentAlertPanel);
