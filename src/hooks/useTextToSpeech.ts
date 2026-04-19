import { useRef, useCallback, useEffect, useState } from "react";
import {
  ElevenLabsTTSService,
  ElevenLabsConfig,
} from "../services/tts/ElevenLabsTTSService";

export interface UseTextToSpeechResult {
  /** Queue text to be spoken. Messages play sequentially, never overlapping. */
  speak: (text: string) => void;
  /** Stop current playback and clear the queue. */
  stop: () => void;
  /** Whether audio is currently playing or queued. */
  isSpeaking: boolean;
  /** Whether TTS is enabled (API key is configured). */
  isEnabled: boolean;
}

export function useTextToSpeech(
  config: ElevenLabsConfig | null
): UseTextToSpeechResult {
  const serviceRef = useRef<ElevenLabsTTSService | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isEnabled = config !== null && !!config.apiKey;

  useEffect(() => {
    if (!isEnabled) {
      serviceRef.current = null;
      return;
    }

    const service = new ElevenLabsTTSService(config);
    serviceRef.current = service;

    // Update React state when the service's busy state changes
    service.setOnStateChange(() => {
      setIsSpeaking(service.isBusy);
    });

    return () => {
      service.abort();
      serviceRef.current = null;
      setIsSpeaking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnabled, config?.apiKey, config?.voiceId]);

  const speak = useCallback((text: string) => {
    serviceRef.current?.enqueue(text);
  }, []);

  const stop = useCallback(() => {
    serviceRef.current?.stopAll();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, isEnabled };
}
