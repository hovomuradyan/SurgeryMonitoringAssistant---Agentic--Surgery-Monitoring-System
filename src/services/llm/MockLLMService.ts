import { ChatMessage, LLMServiceConfig } from "../../types/llm";
import { LLMService } from "./LLMService";

interface MockLLMOptions {
  /** Minimum delay in ms before returning a response */
  minDelay?: number;
  /** Maximum delay in ms before returning a response */
  maxDelay?: number;
}

const DEFAULT_OPTIONS: Required<MockLLMOptions> = {
  minDelay: 500,
  maxDelay: 1500,
};

const CANNED_RESPONSES: string[] = [
  "I can help you with that! Could you provide more details about what you're looking for?",
  "That's an interesting question. Based on the available data, here's what I can tell you.",
  "Sure, let me look into that for you. The system is currently operating within normal parameters.",
  "I've analyzed the video feeds and everything appears to be functioning correctly.",
  "The logs indicate normal activity. Is there a specific event you'd like me to investigate?",
  "I'd recommend checking the connection settings if you're experiencing any issues with the stream.",
  "Based on the current metrics, all systems are running smoothly.",
  "Let me summarize the recent activity for you. No anomalies have been detected.",
  "That's a great observation. I'll keep monitoring the feeds for any changes.",
  "I've noted your request. The dashboard is updating in real-time with the latest information.",
];

/**
 * Mock implementation of LLMService that returns canned responses
 * after a configurable delay, cycling through a predefined set of responses.
 */
export class MockLLMService implements LLMService {
  private readonly options: Required<MockLLMOptions>;
  private responseIndex = 0;

  constructor(config: LLMServiceConfig) {
    const rawOptions = (config.options ?? {}) as MockLLMOptions;
    this.options = {
      minDelay: rawOptions.minDelay ?? DEFAULT_OPTIONS.minDelay,
      maxDelay: rawOptions.maxDelay ?? DEFAULT_OPTIONS.maxDelay,
    };
  }

  async sendMessage(_message: string): Promise<ChatMessage> {
    const delay = this.getRandomDelay();
    await this.sleep(delay);

    const content = CANNED_RESPONSES[this.responseIndex % CANNED_RESPONSES.length];
    this.responseIndex++;

    return {
      role: "assistant",
      content,
      timestamp: new Date(),
    };
  }

  private getRandomDelay(): number {
    const { minDelay, maxDelay } = this.options;
    return Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
