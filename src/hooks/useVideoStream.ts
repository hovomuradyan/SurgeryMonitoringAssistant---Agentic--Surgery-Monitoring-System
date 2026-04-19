import { useState, useEffect, useCallback, useRef } from "react";
import { StreamSourceConfig, StreamStatus } from "../types/stream";
import { createVideoStreamService } from "../services/videoStream/createVideoStreamService";
import { VideoStreamService } from "../services/videoStream/VideoStreamService";

export interface UseVideoStreamResult {
  status: StreamStatus;
  frameSrc: string | null;
  start: () => void;
  stop: () => void;
}

/**
 * Custom hook that manages a VideoStreamService lifecycle.
 *
 * Creates a service instance via the factory when the config changes,
 * subscribes to frame and status updates, and cleans up on unmount.
 * The config reference is stabilized using JSON.stringify comparison
 * to avoid unnecessary service recreation on every render.
 */
export function useVideoStream(
  config: StreamSourceConfig
): UseVideoStreamResult {
  const [status, setStatus] = useState<StreamStatus>("stopped");
  const [frameSrc, setFrameSrc] = useState<string | null>(null);

  // Stabilize config reference using JSON.stringify comparison
  const configKey = JSON.stringify(config);

  // Keep a ref to the current service so start/stop callbacks are stable
  const serviceRef = useRef<VideoStreamService | null>(null);

  useEffect(() => {
    const service = createVideoStreamService(JSON.parse(configKey));
    serviceRef.current = service;

    // Register handlers
    service.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    service.onFrame((frame) => {
      setFrameSrc(frame);
    });

    // The service auto-plays on construction, so sync initial status
    setStatus(service.getStatus());

    return () => {
      service.stop();
      serviceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey]);

  const start = useCallback(() => {
    serviceRef.current?.start();
  }, []);

  const stop = useCallback(() => {
    serviceRef.current?.stop();
  }, []);

  return { status, frameSrc, start, stop };
}
