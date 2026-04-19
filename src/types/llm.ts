export interface LLMServiceConfig {
  type: "mock" | "openai" | "anthropic";
  endpoint?: string;
  options?: Record<string, unknown>;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
