import { FrameHandler, StreamSourceConfig, StreamStatus } from "../../types/stream";
import { VideoStreamService } from "./VideoStreamService";

interface MockOptions {
  /** Delay in ms before transitioning from "connecting" to "live" */
  connectionDelay?: number;
  /** Interval in ms between frame emissions while "live" */
  frameInterval?: number;
  /** Interval in ms between simulated errors while "live" */
  errorInterval?: number;
  /** Delay in ms before auto-retrying after an error */
  retryDelay?: number;
}

const DEFAULT_OPTIONS: Required<MockOptions> = {
  connectionDelay: 1500,
  frameInterval: 100,
  errorInterval: 15000,
  retryDelay: 2000,
};

/**
 * Mock implementation of VideoStreamService that simulates a video stream
 * lifecycle with configurable delays, frame generation, periodic errors,
 * and automatic retry.
 */
export class MockVideoStreamService implements VideoStreamService {
  private status: StreamStatus = "stopped";
  private frameHandlers: FrameHandler[] = [];
  private statusHandlers: Array<(status: StreamStatus) => void> = [];

  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private frameTimer: ReturnType<typeof setInterval> | null = null;
  private errorTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  private frameCounter = 0;
  private readonly options: Required<MockOptions>;

  constructor(config: StreamSourceConfig) {
    const rawOptions = (config.options ?? {}) as MockOptions;
    this.options = {
      connectionDelay: rawOptions.connectionDelay ?? DEFAULT_OPTIONS.connectionDelay,
      frameInterval: rawOptions.frameInterval ?? DEFAULT_OPTIONS.frameInterval,
      errorInterval: rawOptions.errorInterval ?? DEFAULT_OPTIONS.errorInterval,
      retryDelay: rawOptions.retryDelay ?? DEFAULT_OPTIONS.retryDelay,
    };

    // Auto-play on initialization
    this.start();
  }

  start(): void {
    if (this.status === "connecting" || this.status === "live") {
      return;
    }

    this.setStatus("connecting");
    console.log("[MockVideoStream] Connecting...");

    this.connectionTimer = setTimeout(() => {
      this.connectionTimer = null;
      this.goLive();
    }, this.options.connectionDelay);
  }

  stop(): void {
    this.clearAllTimers();
    this.setStatus("stopped");
    console.log("[MockVideoStream] Stopped");
  }

  onFrame(handler: FrameHandler): void {
    this.frameHandlers.push(handler);
  }

  onStatusChange(handler: (status: StreamStatus) => void): void {
    this.statusHandlers.push(handler);
  }

  getStatus(): StreamStatus {
    return this.status;
  }

  // --- Private helpers ---

  private setStatus(newStatus: StreamStatus): void {
    this.status = newStatus;
    for (const handler of this.statusHandlers) {
      handler(newStatus);
    }
  }

  private goLive(): void {
    this.setStatus("live");
    console.log("[MockVideoStream] Live");

    // Start producing frames
    this.frameTimer = setInterval(() => {
      this.emitFrame();
    }, this.options.frameInterval);

    // Schedule periodic errors
    this.errorTimer = setInterval(() => {
      this.simulateError();
    }, this.options.errorInterval);
  }

  private emitFrame(): void {
    this.frameCounter++;
    const frameSrc = this.generateFrame(this.frameCounter);
    for (const handler of this.frameHandlers) {
      handler(frameSrc);
    }
  }

  private generateFrame(frameNumber: number): string {
    // Generate an SVG data URL with animated content (changing colors + timestamp)
    const hue = frameNumber % 360;
    const timestamp = new Date().toISOString().slice(11, 23);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">
      <rect width="320" height="240" fill="hsl(${hue}, 70%, 30%)"/>
      <text x="160" y="110" text-anchor="middle" fill="white" font-size="16" font-family="monospace">Frame ${frameNumber}</text>
      <text x="160" y="140" text-anchor="middle" fill="white" font-size="12" font-family="monospace">${timestamp}</text>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }

  private simulateError(): void {
    if (this.status !== "live") {
      return;
    }

    // Stop frame production and error scheduling
    this.clearFrameAndErrorTimers();

    this.setStatus("error");
    console.log("[MockVideoStream] Error: simulated stream interruption");

    // Auto-retry after delay
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.retry();
    }, this.options.retryDelay);
  }

  private retry(): void {
    if (this.status !== "error") {
      return;
    }

    console.log("[MockVideoStream] Retrying...");
    this.setStatus("connecting");

    this.connectionTimer = setTimeout(() => {
      this.connectionTimer = null;
      this.goLive();
    }, this.options.connectionDelay);
  }

  private clearFrameAndErrorTimers(): void {
    if (this.frameTimer !== null) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
    if (this.errorTimer !== null) {
      clearInterval(this.errorTimer);
      this.errorTimer = null;
    }
  }

  private clearAllTimers(): void {
    this.clearFrameAndErrorTimers();
    if (this.connectionTimer !== null) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}
