export type StreamStatus = "connecting" | "live" | "error" | "stopped";

export type StreamSourceType = "mock" | "mjpeg" | "websocket" | "webrtc";

export interface StreamSourceConfig {
  sourceType: StreamSourceType;
  url?: string;
  options?: Record<string, unknown>;
}

export type FrameHandler = (frameSrc: string) => void;
