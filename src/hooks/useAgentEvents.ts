import { useState, useEffect, useRef } from "react";
import {
  AgentEventService,
  AgentEvent,
} from "../services/agent/AgentEventService";

export interface UseAgentEventsResult {
  alerts: AgentEvent[];
  logs: AgentEvent[];
  connected: boolean;
}

/**
 * Hook that connects to the backend SSE endpoint and splits
 * incoming events into alerts and logs.
 *
 * Pass an empty string for eventsUrl to skip connecting (lightweight mode).
 */
export function useAgentEvents(eventsUrl: string): UseAgentEventsResult {
  const [alerts, setAlerts] = useState<AgentEvent[]>([]);
  const [logs, setLogs] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const serviceRef = useRef<AgentEventService | null>(null);

  useEffect(() => {
    // Don't connect if no URL — lightweight mode
    if (!eventsUrl) {
      setConnected(false);
      return;
    }

    const service = new AgentEventService(eventsUrl);
    serviceRef.current = service;

    const unsubscribe = service.onEvent((event: AgentEvent) => {
      if (event.type === "alert") {
        setAlerts((prev) => [...prev, event]);
      } else {
        setLogs((prev) => [...prev, event]);
      }
    });

    service.connect();
    setConnected(true);

    return () => {
      unsubscribe();
      service.disconnect();
      serviceRef.current = null;
      setConnected(false);
    };
  }, [eventsUrl]);

  return { alerts, logs, connected };
}
