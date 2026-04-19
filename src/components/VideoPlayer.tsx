import React, { useMemo } from "react";
import { StreamSourceConfig, StreamStatus } from "../types/stream";
import { useVideoStream } from "../hooks/useVideoStream";

interface VideoPlayerProps {
  title: string;
  streamConfig: StreamSourceConfig;
}

const statusConfig: Record<
  StreamStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  live: { label: "Live", dotClass: "bg-green-500", textClass: "text-green-700 dark:text-green-400" },
  connecting: { label: "Connecting", dotClass: "bg-yellow-500", textClass: "text-yellow-700 dark:text-yellow-400" },
  error: { label: "Error", dotClass: "bg-red-500", textClass: "text-red-700 dark:text-red-400" },
  stopped: { label: "Stopped", dotClass: "bg-gray-400", textClass: "text-gray-500 dark:text-gray-400" },
};

function StatusBadge({ status }: { status: StreamStatus }) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${config.textClass}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${config.dotClass}`} />
      {config.label}
    </span>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-800">
      {children}
    </div>
  );
}

function VideoPlayer({ title, streamConfig }: VideoPlayerProps) {
  const { status, frameSrc } = useVideoStream(streamConfig);

  const content = useMemo(() => {
    switch (status) {
      case "live":
        return frameSrc ? (
          <img
            src={frameSrc}
            alt={`${title} video feed`}
            className="absolute inset-0 w-full h-full object-contain"
          />
        ) : (
          <Overlay>
            <span className="text-sm text-gray-500 dark:text-gray-400">Connecting…</span>
          </Overlay>
        );
      case "connecting":
        return (
          <Overlay>
            <svg className="animate-spin h-6 w-6 text-yellow-500 mb-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="text-xs text-gray-500 dark:text-gray-400">Connecting…</span>
          </Overlay>
        );
      case "error":
        return (
          <Overlay>
            <span className="text-lg mb-1">⚠️</span>
            <span className="text-xs text-red-600 dark:text-red-400">Stream Error — Retrying…</span>
          </Overlay>
        );
      default:
        return (
          <Overlay>
            <span className="text-xs text-gray-500 dark:text-gray-400">Stream stopped</span>
          </Overlay>
        );
    }
  }, [status, frameSrc, title]);

  return (
    <div className="rounded-lg shadow-sm overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</h2>
        <StatusBadge status={status} />
      </div>
      <div className="relative flex-1 bg-black min-h-0">{content}</div>
    </div>
  );
}

export default React.memo(VideoPlayer);
