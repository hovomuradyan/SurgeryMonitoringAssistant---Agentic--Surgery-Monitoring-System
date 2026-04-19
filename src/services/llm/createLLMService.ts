import { LLMServiceConfig } from "../../types/llm";
import { LLMService } from "./LLMService";
import { MockLLMService } from "./MockLLMService";

/**
 * Factory function that creates an LLMService based on the provided config.
 * Returns a MockLLMService for type "mock".
 * Throws a descriptive error for unsupported types.
 */
export function createLLMService(config: LLMServiceConfig): LLMService {
  switch (config.type) {
    case "mock":
      return new MockLLMService(config);
    default:
      throw new Error(
        `Unsupported LLM service type: "${config.type}". ` +
          `Supported types: "mock". To add support for "${config.type}", ` +
          `implement an LLMService for that type and register it in this factory.`
      );
  }
}
