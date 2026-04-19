import { FrameHandler, StreamSourceConfig, StreamStatus } from "../../types/stream";
import { VideoStreamService } from "./VideoStreamService";

/**
 * MJPEG stream service that connects to an MJPEG-over-HTTP endpoint.
 *
 * MJPEG streams work natively in <img> tags — the browser handles
 * frame decoding automatically. This service sets the frame source
 * to the stream URL and manages connection status via an Image probe.
 */
export class MjpegStreamService implements VideoStreamService {
  private status: StreamStatus = "stopped";
  private frameHandlers: FrameHandler[] = [];
  private statusHandlers: Array<(status: StreamStatus) => void> = [];
  private readonly url: string;
  private probeImage: HTMLImageElement | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly retryDelay: number;

  constructor(config: StreamSourceConfig) {
    if (!config.url) {
      throw new Error("MjpegStreamService requires a url in StreamSourceConfig");
    }
    this.url = config.url;
    this.retryDelay = (config.options?.retryDelay as number) ?? 3000;

    // Auto-play on initialization
    this.start();
  }

  start(): void {
    if (this.status === "connecting" || this.status === "live") {
      return;
    }

    this.setStatus("connecting");
    this.connect();
  }

  stop(): void {
    this.cleanup();
    this.setStatus("stopped");
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

  private connect(): void {
    this.probeImage = new Image();

    // Add cache-busting param so each connection is fresh
    const bustUrl = this.url + (this.url.includes("?") ? "&" : "?") + "_t=" + Date.now();

    this.probeImage.onload = () => {
      if (this.status === "connecting") {
        this.setStatus("live");
        for (const handler of this.frameHandlers) {
          handler(bustUrl);
        }
      }
    };

    this.probeImage.onerror = () => {
      if (this.status === "stopped") return;
      this.setStatus("error");
      this.scheduleRetry();
    };

    this.probeImage.src = bustUrl;

    setTimeout(() => {
      if (this.status === "connecting") {
        this.setStatus("live");
        for (const handler of this.frameHandlers) {
          handler(bustUrl);
        }
      }
    }, 2000);
  }

  private scheduleRetry(): void {
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.status === "error") {
        this.setStatus("connecting");
        this.connect();
      }
    }, this.retryDelay);
  }

  private cleanup(): void {
    if (this.probeImage) {
      this.probeImage.onload = null;
      this.probeImage.onerror = null;
      this.probeImage.src = "";
      this.probeImage = null;
    }
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}
