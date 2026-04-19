import React, { useState, useCallback, useEffect, useRef } from "react";
import VideoPlayer from "./VideoPlayer";
import type { StreamSourceConfig } from "../types/stream";

const BACKEND_URL = "/api";

const yoloStreamConfig: StreamSourceConfig = {
  sourceType: "mjpeg",
  url: `${BACKEND_URL}/yolo/video`,
  options: { label: "YOLO Detection" },
};

interface ObjectState {
  object_id: string;
  last_frame: string;
  last_seen: string;
  last_update: string;
}

interface YoloLogEntry {
  timestamp: string;
  level: string;
  message: string;
}

function ObjectCard({ obj }: { obj: ObjectState }) {
  const isMissing = obj.last_frame === "none" && obj.last_seen !== "never";
  const neverSeen = obj.last_seen === "never";
  const isVisible = !isMissing && !neverSeen;

  return (
    <div
      className={`rounded-md border px-2.5 py-2 text-xs transition-all ${
        isMissing
          ? "border-red-400 dark:border-red-600 bg-red-100 dark:bg-red-900/40 ring-1 ring-red-300 dark:ring-red-700"
          : isVisible
          ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20"
          : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`font-semibold capitalize ${isMissing ? "text-red-700 dark:text-red-300" : "text-gray-900 dark:text-gray-100"}`}>
          {obj.object_id}
        </span>
        <span className={`h-2 w-2 rounded-full ${isMissing ? "bg-red-500 animate-pulse" : isVisible ? "bg-green-500" : "bg-gray-400"}`} />
      </div>
      {isMissing && (
        <div className="text-red-600 dark:text-red-400 font-medium mt-1">⚠ MISSING</div>
      )}
      <div className="text-gray-500 dark:text-gray-400 mt-0.5">
        {isVisible
          ? `Seen: ${(obj.last_seen.split("T")[1] || obj.last_seen)}`
          : neverSeen
          ? "Not detected yet"
          : `Last: ${(obj.last_seen.split("T")[1] || obj.last_seen)}`}
      </div>
    </div>
  );
}

function YoloView() {
  const [yoloRunning, setYoloRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [objects, setObjects] = useState<Record<string, ObjectState>>({});
  const [logs, setLogs] = useState<YoloLogEntry[]>([]);
  const yoloRunningRef = useRef(false);
  const logScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { yoloRunningRef.current = yoloRunning; }, [yoloRunning]);

  useEffect(() => {
    return () => {
      if (yoloRunningRef.current) {
        fetch("/api/yolo/stop", { method: "POST" }).catch(() => {});
      }
    };
  }, []);

  // Poll state every 2s while running
  useEffect(() => {
    if (!yoloRunning) return;
    const poll = async () => {
      try {
        const [objRes, logRes] = await Promise.all([
          fetch("/api/yolo/objects"),
          fetch("/api/yolo/log"),
        ]);
        if (objRes.ok) setObjects(await objRes.json());
        if (logRes.ok) setLogs(await logRes.json());
      } catch { /* ignore */ }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [yoloRunning]);

  useEffect(() => {
    const el = logScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const toggleYolo = useCallback(async () => {
    setLoading(true);
    const endpoint = yoloRunning ? "/api/yolo/stop" : "/api/yolo/start";
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      setYoloRunning(data.status === "started" || data.status === "already_running");
    } catch (e) {
      console.error("Failed to toggle YOLO:", e);
    } finally {
      setLoading(false);
    }
  }, [yoloRunning]);

  const objectList = Object.values(objects);

  return (
    <main className="pt-12 p-3 h-screen flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between py-2 flex-shrink-0">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">YOLO Object Detection</h2>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Tracking: scissors · bottle · knife — warns if missing &gt;7s</p>
        </div>
        <button
          onClick={toggleYolo}
          disabled={loading}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
            yoloRunning ? "bg-red-600 hover:bg-red-700 text-white" : "bg-purple-600 hover:bg-purple-700 text-white"
          }`}
        >
          {loading ? (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
          ) : yoloRunning ? (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
          )}
          {yoloRunning ? "Stop" : "Start Detection"}
        </button>
      </div>

      {/* Content: left video + right sidebar */}
      <div className="flex gap-3 flex-1 min-h-0">
        {/* Main video — takes most space */}
        <div className="flex-[3] min-h-0">
          {yoloRunning ? (
            <VideoPlayer title="YOLO Detection Feed" streamConfig={yoloStreamConfig} />
          ) : (
            <div className="rounded-lg shadow-sm overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col h-full">
              <div className="px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100">YOLO Detection Feed</h2>
              </div>
              <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                <div className="text-center">
                  <span className="text-3xl block mb-2">📦</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Click "Start Detection"</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="flex-[1] flex flex-col gap-2 min-h-0 min-w-[220px] max-w-[300px]">
          {/* Small preview */}
          <div className="flex-shrink-0" style={{ height: "20vh" }}>
            {yoloRunning ? (
              <VideoPlayer title="Preview" streamConfig={yoloStreamConfig} />
            ) : (
              <div className="rounded-lg shadow-sm overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col h-full">
                <div className="px-3 py-1 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <h2 className="text-[10px] font-semibold text-gray-900 dark:text-gray-100">Preview</h2>
                </div>
                <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                  <span className="text-[10px] text-gray-400">—</span>
                </div>
              </div>
            )}
          </div>

          {/* Object cards */}
          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {objectList.length > 0
              ? objectList.map((obj) => <ObjectCard key={obj.object_id} obj={obj} />)
              : ["scissors", "bottle", "knife"].map((name) => (
                  <div key={name} className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-2.5 py-2 text-xs">
                    <span className="font-semibold text-gray-400 capitalize">{name}</span>
                    <div className="text-gray-400 mt-0.5">—</div>
                  </div>
                ))}
          </div>

          {/* Detection log */}
          <div className="flex-1 min-h-0 rounded-lg shadow-sm overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="px-3 py-1 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center">
              <h2 className="text-[10px] font-semibold text-gray-900 dark:text-gray-100">Log</h2>
              <span className="ml-1 text-[10px] text-gray-400">({logs.length})</span>
            </div>
            <div ref={logScrollRef} className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {logs.length === 0 ? (
                <p className="text-[10px] text-gray-400 italic">No events…</p>
              ) : (
                logs.map((entry, i) => (
                  <div
                    key={i}
                    className={`font-mono text-[10px] leading-relaxed ${
                      entry.level === "warning" ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    [{(entry.timestamp.split("T")[1] || entry.timestamp)}] {entry.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default React.memo(YoloView);
