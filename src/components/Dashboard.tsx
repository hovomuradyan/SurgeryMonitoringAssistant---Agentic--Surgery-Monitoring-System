import React, { useState, useCallback, useEffect, useRef } from "react";
import VideoPlayer from "./VideoPlayer";
import AgentLogPanel from "./AgentLogPanel";
import AgentAlertPanel from "./AgentAlertPanel";
import { useAgentEvents } from "../hooks/useAgentEvents";
import { useTextToSpeech } from "../hooks/useTextToSpeech";
import type { StreamSourceConfig } from "../types/stream";
import type { ElevenLabsConfig } from "../services/tts/ElevenLabsTTSService";

const BACKEND_URL = "/api";

const streamConfig1: StreamSourceConfig = {
  sourceType: "mjpeg",
  url: `${BACKEND_URL}/video`,
  options: { label: "OR Camera" },
};

const ELEVENLABS_API_KEY = "sk_ef205ad78101523358b882107576af452e039fb29d6f4892";
const ttsConfig: ElevenLabsConfig | null = ELEVENLABS_API_KEY
  ? { apiKey: ELEVENLABS_API_KEY }
  : null;

function AgentControlButton({ running, onToggle }: { running: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        running ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"
      }`}
    >
      {running ? (
        <>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          Stop Agent
        </>
      ) : (
        <>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
          Start Agent
        </>
      )}
    </button>
  );
}

function SpeakerToggle({ enabled, muted, onToggle, isSpeaking }: { enabled: boolean; muted: boolean; onToggle: () => void; isSpeaking: boolean }) {
  if (!enabled) return null;
  return (
    <div className="flex items-center gap-2">
      {isSpeaking && <span className="text-xs text-blue-500 animate-pulse">Speaking…</span>}
      <button
        onClick={onToggle}
        className={`p-1.5 rounded transition-colors ${!muted ? "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30" : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
        title={muted ? "Unmute alerts" : "Mute alerts"}
        aria-label={muted ? "Unmute alerts" : "Mute alerts"}
      >
        {muted ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
        )}
      </button>
    </div>
  );
}

function Dashboard() {
  const [agentRunning, setAgentRunning] = useState(false);
  const [ttsMuted, setTtsMuted] = useState(false);
  const prevAlertCountRef = useRef(0);
  const agentRunningRef = useRef(false);

  // Only connect SSE when agent is running — lightweight otherwise
  const { alerts, logs } = useAgentEvents(
    agentRunning ? `${BACKEND_URL}/events` : ""
  );

  const { speak, stop: stopSpeech, isSpeaking, isEnabled: ttsEnabled } = useTextToSpeech(ttsConfig);

  // Keep ref in sync for cleanup
  useEffect(() => {
    agentRunningRef.current = agentRunning;
  }, [agentRunning]);

  // Auto-stop agent when component unmounts (tab switch)
  useEffect(() => {
    return () => {
      if (agentRunningRef.current) {
        fetch("/api/agent/stop", { method: "POST" }).catch(() => {});
      }
    };
  }, []);

  // Auto-read new alerts via TTS
  useEffect(() => {
    if (!ttsEnabled || ttsMuted) return;
    const prevCount = prevAlertCountRef.current;
    prevAlertCountRef.current = alerts.length;
    if (alerts.length > prevCount) {
      const newAlert = alerts[alerts.length - 1];
      const prefix = newAlert.severity === "critical" ? "Critical alert." : "Warning.";
      speak(`${prefix} ${newAlert.message}`);
    }
  }, [alerts, ttsEnabled, ttsMuted, speak]);

  const toggleAgent = useCallback(async () => {
    const endpoint = agentRunning ? "/api/agent/stop" : "/api/agent/start";
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      setAgentRunning(data.status === "started" || data.status === "already_running");
    } catch (e) {
      console.error("Failed to toggle agent:", e);
    }
  }, [agentRunning]);

  const toggleMute = useCallback(() => {
    if (!ttsMuted) stopSpeech();
    setTtsMuted((prev) => !prev);
  }, [ttsMuted, stopSpeech]);

  return (
    <main className="pt-14 p-3 h-screen flex flex-col overflow-hidden">
      <div className="flex flex-col md:flex-row gap-3 flex-1 min-h-0">
        <div className="flex flex-col gap-2 md:w-1/2">
          <VideoPlayer title="OR Camera" streamConfig={streamConfig1} />
          <div className="flex items-center gap-3">
            <AgentControlButton running={agentRunning} onToggle={toggleAgent} />
            <SpeakerToggle enabled={ttsEnabled} muted={ttsMuted} onToggle={toggleMute} isSpeaking={isSpeaking} />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {agentRunning ? "Agent is analyzing frames…" : "Press Start to begin safety analysis"}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:w-1/2 min-h-0 flex-1">
          <div className="flex-1 min-h-0">
            <AgentAlertPanel alerts={alerts} />
          </div>
          <div className="flex-1 min-h-0">
            <AgentLogPanel logs={logs} />
          </div>
        </div>
      </div>
    </main>
  );
}

export default React.memo(Dashboard);
