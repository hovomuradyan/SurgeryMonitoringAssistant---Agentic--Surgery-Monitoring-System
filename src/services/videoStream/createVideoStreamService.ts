import { StreamSourceConfig } from "../../types/stream";
import { VideoStreamService } from "./VideoStreamService";
import { MockVideoStreamService } from "./MockVideoStreamService";
import { MjpegStreamService } from "./MjpegStreamService";

/**
 * Factory function that creates a VideoStreamService based on the provided config.
 * Returns a MockVideoStreamService for sourceType "mock".
 * Returns a MjpegStreamService for sourceType "mjpeg".
 * Throws a descriptive error for unsupported source types.
 */
export function createVideoStreamService(
  config: StreamSourceConfig
): VideoStreamService {
  switch (config.sourceType) {
    case "mock":
      return new MockVideoStreamService(config);
    case "mjpeg":
      return new MjpegStreamService(config);
    default:
      throw new Error(
        `Unsupported video stream source type: "${config.sourceType}". ` +
          `Supported types: "mock", "mjpeg". To add support for "${config.sourceType}", ` +
          `implement a VideoStreamService for that source type and register it in this factory.`
      );
  }
}
