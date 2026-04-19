/**
 * Service that connects to the backend SSE endpoint and dispatches
 * agent events (alerts and logs) to registered handlers.
 */

export interface AgentEvent {
  type: "alert" | "log" | "report";
  timestamp: string;
  severity: string;
  message: string;
  period?: string;
  summary?: string;
}

type EventHandler = (event: AgentEvent) => void;

export class AgentEventService {
  private eventSource: EventSource | null = null;
  private handlers: EventHandler[] = [];
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.eventSource) return;

    this.eventSource = new EventSource(this.url);

    this.eventSource.onmessage = (event) => {
      try {
        const data: AgentEvent = JSON.parse(event.data);
        for (const handler of this.handlers) {
          handler(data);
        }
      } catch (e) {
        console.warn("[AgentEventService] Failed to parse event:", e);
      }
    };

    this.eventSource.onerror = () => {
      console.warn("[AgentEventService] Connection error, will auto-reconnect");
    };
  }

  onEvent(handler: EventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.handlers = [];
  }
}
