import { FrameHandler, StreamStatus } from "../../types/stream";

export interface VideoStreamService {
  start(): void;
  stop(): void;
  onFrame(handler: FrameHandler): void;
  onStatusChange(handler: (status: StreamStatus) => void): void;
  getStatus(): StreamStatus;
}
