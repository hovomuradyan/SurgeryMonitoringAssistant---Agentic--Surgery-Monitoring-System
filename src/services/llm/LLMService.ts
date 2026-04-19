import { ChatMessage } from "../../types/llm";

export interface LLMService {
  sendMessage(message: string): Promise<ChatMessage>;
}
