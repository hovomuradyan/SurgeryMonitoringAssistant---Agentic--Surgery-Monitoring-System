import { useState, useCallback, useRef, useEffect } from "react";
import { ChatMessage, LLMServiceConfig } from "../types/llm";
import { createLLMService } from "../services/llm/createLLMService";
import { LLMService } from "../services/llm/LLMService";

export interface UseLLMServiceResult {
  messages: ChatMessage[];
  sendMessage: (text: string) => void;
  isLoading: boolean;
}

/**
 * Custom hook that manages an LLMService lifecycle.
 *
 * Creates a service instance via the factory when the config changes,
 * manages chat message history in local state, and cancels pending
 * requests on unmount using a cancelled flag ref.
 * The config reference is stabilized using JSON.stringify comparison
 * to avoid unnecessary service recreation on every render.
 */
export function useLLMService(config: LLMServiceConfig): UseLLMServiceResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Stabilize config reference using JSON.stringify comparison
  const configKey = JSON.stringify(config);

  // Keep a ref to the current service so sendMessage callback is stable
  const serviceRef = useRef<LLMService | null>(null);

  // Cancelled flag to prevent state updates after unmount
  const cancelledRef = useRef(false);

  useEffect(() => {
    const service = createLLMService(JSON.parse(configKey));
    serviceRef.current = service;
    cancelledRef.current = false;

    // Reset state when config changes
    setMessages([]);
    setIsLoading(false);

    return () => {
      cancelledRef.current = true;
      serviceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  const sendMessage = useCallback((text: string) => {
    if (!serviceRef.current) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    // Add user message immediately
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    serviceRef.current.sendMessage(text).then((assistantMessage) => {
      if (cancelledRef.current) return;

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    });
  }, []);

  return { messages, sendMessage, isLoading };
}
