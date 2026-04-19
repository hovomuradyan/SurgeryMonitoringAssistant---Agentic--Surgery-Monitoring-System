import React, { useState, useEffect, useRef, FormEvent, useMemo } from "react";
import { useLLMService } from "../hooks/useLLMService";
import { useTextToSpeech } from "../hooks/useTextToSpeech";
import type { ChatMessage } from "../types/llm";
import type { ElevenLabsConfig } from "../services/tts/ElevenLabsTTSService";

/**
 * ElevenLabs TTS configuration.
 * Replace the empty string below with your actual ElevenLabs API key.
 * Set TTS_CONFIG to null to disable TTS entirely.
 */
const ELEVENLABS_API_KEY = "sk_ef205ad78101523358b882107576af452e039fb29d6f4892";

const TTS_CONFIG: ElevenLabsConfig | null = ELEVENLABS_API_KEY
  ? {
      apiKey: ELEVENLABS_API_KEY,
      voiceId: "NEgR5Tdirh4i83cUnrPG" // voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel (default)
      // modelId: "eleven_multilingual_v2", // default
    }
  : null;


function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      data-testid={`message-${message.role}`}
    >
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

function LoadingIndicator() {
  return (
    <div className="flex justify-start" data-testid="loading-indicator">
      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2">
        <span className="flex gap-1">
          <span className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function TextAssistancePanel() {
  const { messages, sendMessage, isLoading } = useLLMService({ type: "mock" });

  // TTS config — passed through directly, null means disabled
  const ttsConfig = useMemo<ElevenLabsConfig | null>(() => {
    return TTS_CONFIG;
  }, []);

  const { speak, stop, isSpeaking, isEnabled: ttsEnabled } =
    useTextToSpeech(ttsConfig);

  const [ttsOn, setTtsOn] = useState(true);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, isLoading]);

  // Auto-read new assistant messages
  useEffect(() => {
    if (!ttsEnabled || !ttsOn) return;

    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (messages.length > prevCount) {
      const newMessage = messages[messages.length - 1];
      if (newMessage.role === "assistant") {
        speak(newMessage.content);
      }
    }
  }, [messages, ttsEnabled, ttsOn, speak]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    sendMessage(trimmed);
    setInput("");
  };

  const toggleTts = () => {
    if (ttsOn) {
      stop();
    }
    setTtsOn((prev) => !prev);
  };

  return (
    <div className="rounded-lg shadow-md overflow-hidden bg-white dark:bg-gray-900 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Text Assistance
        </h2>
        <div className="flex items-center gap-2">
          {isSpeaking && (
            <span className="text-xs text-blue-500 dark:text-blue-400 animate-pulse">
              Speaking…
            </span>
          )}
          {ttsEnabled && (
            <button
              onClick={toggleTts}
              className={`p-1 rounded transition-colors ${
                ttsOn
                  ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                  : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
              title={ttsOn ? "Mute voice" : "Unmute voice"}
              aria-label={ttsOn ? "Mute voice" : "Unmute voice"}
              data-testid="tts-toggle"
            >
              <SpeakerIcon muted={!ttsOn} />
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 space-y-2"
        data-testid="message-scroll-container"
      >
        {messages.length === 0 && !isLoading ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            No messages yet. Start a conversation.
          </p>
        ) : (
          messages.map((msg, index) => (
            <MessageBubble key={index} message={msg} />
          ))
        )}
        {isLoading && <LoadingIndicator />}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-700"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="message-input"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="send-button"
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default React.memo(TextAssistancePanel);
