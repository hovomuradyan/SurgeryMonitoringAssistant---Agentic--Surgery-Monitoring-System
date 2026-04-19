import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import VideoPlayer from "./VideoPlayer";
import type { StreamSourceConfig } from "../types/stream";

const BACKEND_URL = "/api";

// Left (large): Surgeon Table — second camera (placeholder for now)
const surgeonTableConfig: StreamSourceConfig = {
  sourceType: "mjpeg",
  url: `${BACKEND_URL}/yolo/video2`,
  options: { label: "Surgeon Table" },
};

// Right (small): Instrument Table — YOLO detection from phone camera
const instrumentTableConfig: StreamSourceConfig = {
  sourceType: "mjpeg",
  url: `${BACKEND_URL}/yolo/video`,
  options: { label: "Instrument Table" },
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

function formatTime(ts: string): string {
  if (ts === "never") return "—";
  const t = ts.split("T")[1];
  return t || ts;
}

function ObjectCard({ obj }: { obj: ObjectState }) {
  const isMissing = obj.last_frame === "none" && obj.last_seen !== "never";
  const neverSeen = obj.last_seen === "never";
  const isVisible = !isMissing && !neverSeen;

  const frameLabel =
    obj.last_frame === "frame1" ? "Instrument Table" :
    obj.last_frame === "frame2" ? "Surgeon Table" :
    "Not visible";

  return (
    <div className={`rounded-md border px-3 py-2 transition-all ${
      isMissing
        ? "border-red-400 dark:border-red-600 bg-red-100 dark:bg-red-900/40 ring-1 ring-red-300 dark:ring-red-700"
        : isVisible
        ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/15"
        : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
    }`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${isMissing ? "bg-red-500 animate-pulse" : isVisible ? "bg-green-500" : "bg-gray-400"}`} />
          <span className={`text-xs font-bold capitalize ${isMissing ? "text-red-700 dark:text-red-300" : "text-gray-900 dark:text-gray-100"}`}>
            {obj.object_id}
          </span>
        </div>
        {isMissing && <span className="text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-200 dark:bg-red-800/50 px-1.5 py-0.5 rounded">MISSING</span>}
        {isVisible && <span className="text-[10px] font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800/30 px-1.5 py-0.5 rounded">VISIBLE</span>}
      </div>
      <div className="grid grid-cols-2 gap-x-3 text-[10px] text-gray-500 dark:text-gray-400">
        <div>
          <span className="text-gray-400 dark:text-gray-500">Location</span>
          <div className="font-medium text-gray-700 dark:text-gray-300">{frameLabel}</div>
        </div>
        <div>
          <span className="text-gray-400 dark:text-gray-500">Last seen</span>
          <div className="font-mono font-medium text-gray-700 dark:text-gray-300">{formatTime(obj.last_seen)}</div>
        </div>
      </div>
    </div>
  );
}

function YoloView() {
  const [yoloRunning, setYoloRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [objects, setObjects] = useState<Record<string, ObjectState>>({});
  const [logs, setLogs] = useState<YoloLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState("all");
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
  }, [logs, logFilter]);

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

  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return logs;
    return logs.filter((l) => l.message.toLowerCase().includes(logFilter));
  }, [logs, logFilter]);

  const placeholderVideo = (title: string, subtitle?: string) => (
    <div className="rounded-lg shadow-sm overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col h-full">
      <div className="px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h2 className="text-xs font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      </div>
      <div className="flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
        <div className="text-center">
          <span className="text-2xl block mb-1">📦</span>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">{subtitle || "Click Start Detection"}</p>
        </div>
      </div>
    </div>
  );

  return (
    <main className="pt-12 p-3 h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between py-1.5 flex-shrink-0">
        <div>
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">Instrument Tracking</h2>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            Tracking scissors · bottle · knife — surgeon table (left) · instrument table (right)
          </p>
        </div>
        <button
          onClick={toggleYolo}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 ${
            yoloRunning ? "bg-red-600 hover:bg-red-700 text-white" : "bg-purple-600 hover:bg-purple-700 text-white"
          }`}
        >
          {loading ? (
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
          ) : yoloRunning ? (
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          ) : (
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21" /></svg>
          )}
          {yoloRunning ? "Stop" : "Start Detection"}
        </button>
      </div>

      {/* Content: large left video, smaller right column */}
      <div className="flex gap-2 flex-1 min-h-0">
        {/* Left: Surgeon Table (large) */}
        <div className="flex-[5] min-h-0">
          {yoloRunning
            ? <VideoPlayer title="Surgeon Table" streamConfig={surgeonTableConfig} />
            : placeholderVideo("Surgeon Table", "Camera URL not configured yet")}
        </div>

        {/* Right column: Instrument Table video + cards + log */}
        <div className="flex-[3] flex flex-col gap-2 min-h-0 min-w-[220px] max-w-[340px]">
          {/* Instrument Table — YOLO detection (smaller) */}
          <div className="flex-[3] min-h-0">
            {yoloRunning
              ? <VideoPlayer title="Instrument Table — YOLO" streamConfig={instrumentTableConfig} />
              : placeholderVideo("Instrument Table — YOLO")}
          </div>

          {/* Object tracking cards */}
          <div className="flex flex-col gap-1 flex-shrink-0">
            {objectList.length > 0
              ? objectList.map((obj) => <ObjectCard key={obj.object_id} obj={obj} />)
              : ["scissors", "bottle", "knife"].map((name) => (
                  <div key={name} className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-3 py-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-gray-400" />
                      <span className="font-bold text-gray-400 capitalize">{name}</span>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">Waiting…</div>
                  </div>
                ))}
          </div>

          {/* Detection log with filter */}
          <div className="flex-[2] min-h-0 rounded-lg shadow-sm overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="px-2 py-1 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <h2 className="text-[10px] font-semibold text-gray-900 dark:text-gray-100">Log</h2>
                <span className="text-[10px] text-gray-400">({filteredLogs.length})</span>
              </div>
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="text-[10px] bg-transparent border border-gray-200 dark:border-gray-700 rounded px-1 py-0.5 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="all">All</option>
                <option value="scissors">Scissors</option>
                <option value="bottle">Bottle</option>
                <option value="knife">Knife</option>
              </select>
            </div>
            <div ref={logScrollRef} className="flex-1 overflow-y-auto p-1.5 space-y-px">
              {filteredLogs.length === 0 ? (
                <p className="text-[10px] text-gray-400 italic p-1">No events…</p>
              ) : (
                filteredLogs.map((entry, i) => (
                  <div
                    key={i}
                    className={`font-mono text-[10px] leading-snug px-1 py-0.5 rounded ${
                      entry.level === "warning"
                        ? "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    <span className="text-gray-400 dark:text-gray-500">{formatTime(entry.timestamp)}</span>{" "}
                    {entry.message}
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
