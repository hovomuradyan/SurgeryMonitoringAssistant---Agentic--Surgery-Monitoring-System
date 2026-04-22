"""
Web server wrapper for the surgical safety agent.

Endpoints:
  GET  /video        — MJPEG stream of the video source
  GET  /events       — Server-Sent Events stream of agent observations
  POST /agent/start  — Start LLM analysis
  POST /agent/stop   — Stop LLM analysis
  GET  /agent/status — Check if agent is running
  GET  /health       — Health check
"""

import argparse
import base64
import json
import os
import queue
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

import anthropic
import cv2
import numpy as np
from dotenv import load_dotenv
from flask import Flask, Response, jsonify
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app)

# --- Shared state ---
latest_frame = None
latest_frame_raw = None
frame_lock = threading.Lock()
event_queues: list[queue.Queue] = []
event_queues_lock = threading.Lock()

# Agent control
agent_running = False
agent_should_stop = threading.Event()
agent_thread_ref = None
agent_lock = threading.Lock()

# Config (set in main)
_source = "test.mp4"
_log_path = Path("events.json")
_interval = 3.0


MODEL = "us.anthropic.claude-sonnet-4-5-20250929-v1:0"

SYSTEM_PROMPT = """You are an autonomous surgical safety monitor watching a live OR camera.

You combine TWO specialist perspectives in a single analysis:

STERILITY CHECK:
- Sterile field integrity (draped surfaces, sterile zones)
- Surface disinfection and contamination events
- Instrument and material placement
- Contact between sterile and non-sterile items or surfaces
- Foreign objects on sterile surfaces

COMPLIANCE CHECK:
- PPE compliance (gloves, gown, mask, cap — presence and correct wear)
- Body positioning and movement within permitted zones
- Gowning and gloving technique and sequence
- Procedure step order and correctness
- Unauthorized personnel or zone violations

Rules:
- Use tools only. Never produce free-form text.
- Scan the ENTIRE frame. Log every distinct issue — do not stop at one.
- CRITICAL: Check recent event history first. Do NOT re-log issues already recorded.
- Only log issues that are NEW or have materially changed since last logged.
- Keep each observation under 12 words. Be terse and specific.
- If nothing new is wrong, call nothing.
- Do NOT alert for ambiguous or partially visible situations. Only alert when the violation is clearly visible.

Severity:
- info: routine activity, no concern
- warning: visible protocol deviation (wrong attire, item in wrong zone, missed step) — also call alert_team
- critical: active sterile breach, sharps danger, contamination — always call alert_team"""

TOOLS = [
    {
        "name": "log_event",
        "description": "Log a detected observation to the permanent event record",
        "input_schema": {
            "type": "object",
            "properties": {
                "severity": {"type": "string", "enum": ["info", "warning", "critical"]},
                "observation": {"type": "string"},
            },
            "required": ["severity", "observation"],
        },
    },
    {
        "name": "alert_team",
        "description": "Immediately alert the surgical team to a safety issue",
        "input_schema": {
            "type": "object",
            "properties": {
                "message": {"type": "string"},
                "severity": {"type": "string", "enum": ["warning", "critical"]},
            },
            "required": ["message", "severity"],
        },
    },
    {
        "name": "generate_report",
        "description": "Generate a summary report of recent observations",
        "input_schema": {
            "type": "object",
            "properties": {
                "period": {"type": "string"},
                "summary": {"type": "string"},
            },
            "required": ["period", "summary"],
        },
    },
]


def broadcast_event(event: dict):
    data = json.dumps(event)
    with event_queues_lock:
        for q in event_queues:
            try:
                q.put_nowait(data)
            except queue.Full:
                pass


def frame_to_b64(frame):
    h, w = frame.shape[:2]
    if w > 1280:
        frame = cv2.resize(frame, (1280, int(h * 1280 / w)))
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return base64.standard_b64encode(buf).decode()


def execute_tool(name, inp, log_path):
    ts = datetime.now().isoformat(timespec="seconds")

    if name == "log_event":
        entry = {
            "timestamp": ts,
            "severity": inp["severity"],
            "observation": inp["observation"],
            "action_taken": inp.get("action_taken", ""),
        }
        existing = json.loads(log_path.read_text()) if log_path.exists() else []
        log_path.write_text(json.dumps(existing + [entry], indent=2))
        print(f"[LOG/{entry['severity'].upper()}] {entry['observation']}")
        sys.stdout.flush()
        broadcast_event({
            "type": "log",
            "timestamp": ts,
            "severity": inp["severity"],
            "message": inp["observation"],
        })
        return entry

    elif name == "alert_team":
        print(f"\n{'=' * 50}")
        print(f"ALERT [{inp['severity'].upper()}]: {inp['message']}")
        print(f"{'=' * 50}\n")
        sys.stdout.flush()
        broadcast_event({
            "type": "alert",
            "timestamp": ts,
            "severity": inp["severity"],
            "message": inp["message"],
        })
        return {"alerted": True}

    elif name == "generate_report":
        print(f"\n--- REPORT ({inp['period']}) ---\n{inp['summary']}\n---\n")
        sys.stdout.flush()
        broadcast_event({
            "type": "report",
            "timestamp": ts,
            "period": inp["period"],
            "summary": inp["summary"],
        })
        return {"report": inp["summary"]}

    return {"error": f"unknown tool: {name}"}


def video_reader(source):
    """Dedicated thread: reads video at native FPS, updates latest_frame."""
    global latest_frame, latest_frame_raw

    try:
        source_val = int(source)
    except ValueError:
        source_val = source

    cap = cv2.VideoCapture(source_val)
    if not cap.isOpened():
        print(f"ERROR: Cannot open video source: {source_val}")
        return

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frame_delay = 1.0 / fps
    print(f"[video_reader] Streaming at {fps:.1f} FPS from {source}")
    sys.stdout.flush()

    while True:
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 50])
        with frame_lock:
            latest_frame = jpeg.tobytes()
            latest_frame_raw = frame.copy()

        time.sleep(frame_delay)

    cap.release()


def agent_loop(log_path, interval, stop_event):
    """Background thread: single-call agent with combined sterility + compliance prompt."""
    global agent_running

    client = anthropic.AnthropicBedrock()
    recent_events = []

    print("[agent] Analysis started")
    sys.stdout.flush()
    broadcast_event({
        "type": "log",
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "severity": "info",
        "message": "Agent analysis started",
    })

    while not stop_event.is_set():
        with frame_lock:
            frame = latest_frame_raw.copy() if latest_frame_raw is not None else None

        if frame is None:
            time.sleep(1)
            continue

        if np.mean(frame) < 10:
            time.sleep(interval)
            continue

        history_text = ""
        if recent_events:
            lines = "\n".join(
                f"- [{e['timestamp']}] {e['severity'].upper()}: {e['observation']}"
                for e in recent_events[-20:]
            )
            history_text = f"\n\nRecent event history:\n{lines}"

        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": frame_to_b64(frame),
                        },
                    },
                    {
                        "type": "text",
                        "text": f"Analyze this frame for both sterility and compliance issues. Only log issues not already in history.{history_text}",
                    },
                ],
            }
        ]

        try:
            while not stop_event.is_set():
                response = client.messages.create(
                    model=MODEL,
                    max_tokens=2048,
                    system=[{
                        "type": "text",
                        "text": SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }],
                    tools=TOOLS,
                    messages=messages,
                )

                if response.stop_reason != "tool_use":
                    break

                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        result = execute_tool(block.name, block.input, log_path)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": json.dumps(result),
                        })
                        if block.name == "log_event":
                            recent_events.append({
                                "timestamp": datetime.now().isoformat(timespec="seconds"),
                                "severity": block.input["severity"],
                                "observation": block.input["observation"],
                            })

                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results})

        except Exception as e:
            print(f"Agent error: {e}")
            sys.stdout.flush()
            broadcast_event({
                "type": "log",
                "timestamp": datetime.now().isoformat(timespec="seconds"),
                "severity": "error",
                "message": f"Agent error: {str(e)[:100]}",
            })
            for _ in range(10):
                if stop_event.is_set():
                    break
                time.sleep(1)

        for _ in range(int(interval)):
            if stop_event.is_set():
                break
            time.sleep(1)

    print("[agent] Analysis stopped")
    sys.stdout.flush()
    broadcast_event({
        "type": "log",
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "severity": "info",
        "message": "Agent analysis stopped",
    })
    agent_running = False


# --- Flask routes ---

@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/video")
def video_feed():
    def generate():
        while True:
            with frame_lock:
                frame = latest_frame
            if frame is not None:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
                )
            time.sleep(0.016)  # ~60 FPS cap

    return Response(
        generate(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/events")
def events():
    def generate():
        q = queue.Queue(maxsize=100)
        with event_queues_lock:
            event_queues.append(q)
        try:
            while True:
                try:
                    data = q.get(timeout=30)
                    yield f"data: {data}\n\n"
                except queue.Empty:
                    yield ": keepalive\n\n"
        finally:
            with event_queues_lock:
                event_queues.remove(q)

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.route("/agent/start", methods=["POST"])
def agent_start():
    global agent_running, agent_should_stop, agent_thread_ref

    with agent_lock:
        if agent_running:
            return jsonify({"status": "already_running"})

        agent_should_stop = threading.Event()
        agent_running = True
        t = threading.Thread(
            target=agent_loop,
            args=(_log_path, _interval, agent_should_stop),
            daemon=True,
        )
        t.start()
        agent_thread_ref = t

    return jsonify({"status": "started"})


@app.route("/agent/stop", methods=["POST"])
def agent_stop():
    global agent_running

    with agent_lock:
        if not agent_running:
            return jsonify({"status": "not_running"})
        agent_should_stop.set()

    return jsonify({"status": "stopping"})


@app.route("/agent/status")
def agent_status():
    return jsonify({"running": agent_running})


# --- YOLO control ---
yolo_running_flag = False
yolo_stop_event = threading.Event()
yolo_thread_ref = None
yolo_annotated_frame = None
yolo_frame_lock = threading.Lock()

# Tracked objects: scissors (76), bottle (39), knife (43)
TRACKED_OBJECTS = {"scissors": 76, "bottle": 39, "knife": 43}
TRACKED_CLASS_IDS = list(TRACKED_OBJECTS.values())
MISSING_THRESHOLD_SEC = 7.0

# Phone camera URL for YOLO detection
YOLO_CAMERA_URL = "http://10.165.99.79:8080/video"

# Object tracking state — shared with endpoints
yolo_object_state = {}
yolo_state_lock = threading.Lock()
yolo_log_entries = []
yolo_log_lock = threading.Lock()

# Raw camera frame for the left video (non-annotated)
yolo_raw_frame = None
yolo_raw_lock = threading.Lock()


def init_object_state():
    """Initialize tracking state for all monitored objects."""
    now = datetime.now().isoformat(timespec="seconds")
    state = {}
    for name in TRACKED_OBJECTS:
        state[name] = {
            "object_id": name,
            "last_frame": "none",
            "last_seen": "never",
            "last_update": now,
        }
    return state


def save_object_state(state, path):
    """Write tracking state to JSON file."""
    path.write_text(json.dumps({"objects": state}, indent=2))


def add_yolo_log(message, level="info"):
    """Add an entry to the YOLO log and broadcast via SSE."""
    ts = datetime.now().isoformat(timespec="seconds")
    entry = {"timestamp": ts, "level": level, "message": message}
    with yolo_log_lock:
        yolo_log_entries.append(entry)
    broadcast_event({
        "type": "log" if level != "warning" else "alert",
        "timestamp": ts,
        "severity": level,
        "message": message,
    })
    print(f"[yolo/{level.upper()}] {message}")
    sys.stdout.flush()


def yolo_detection_loop(stop_event):
    """Background thread: reads from phone camera, runs YOLO detection.
    
    Architecture: camera reader runs in a sub-thread at full FPS,
    YOLO grabs the latest frame when ready — no blocking.
    """
    global yolo_annotated_frame, yolo_running_flag, yolo_object_state, yolo_raw_frame

    yolo_dir = Path(__file__).parent.parent / "YOLO"
    model_path = yolo_dir / "yolov8n.pt"
    state_path = Path(__file__).parent / "yolo_objects.json"

    if not model_path.exists():
        print(f"[yolo] ERROR: Model not found at {model_path}")
        sys.stdout.flush()
        yolo_running_flag = False
        return

    sys.path.insert(0, str(yolo_dir))
    from ultralytics import YOLO

    model = YOLO(str(model_path))
    model.to("cpu")

    # --- Camera reader sub-thread ---
    cam_frame = None
    cam_lock = threading.Lock()
    cam_connected = threading.Event()

    def camera_reader():
        nonlocal cam_frame
        import urllib.request

        while not stop_event.is_set():
            try:
                stream = urllib.request.urlopen(YOLO_CAMERA_URL, timeout=10)
                cam_connected.set()
                buf = b""
                while not stop_event.is_set():
                    chunk = stream.read(8192)
                    if not chunk:
                        break
                    buf += chunk
                    # Parse JPEG frames from MJPEG boundary
                    while True:
                        start = buf.find(b"\xff\xd8")
                        end = buf.find(b"\xff\xd9", start + 2 if start >= 0 else 0)
                        if start == -1 or end == -1 or end <= start:
                            break
                        jpg = buf[start:end + 2]
                        buf = buf[end + 2:]
                        decoded = cv2.imdecode(
                            np.frombuffer(jpg, dtype=np.uint8), cv2.IMREAD_COLOR
                        )
                        if decoded is not None:
                            # Update raw frame for left video
                            _, raw_jpeg = cv2.imencode(
                                ".jpg", decoded, [cv2.IMWRITE_JPEG_QUALITY, 75]
                            )
                            with cam_lock:
                                cam_frame = decoded
                            with yolo_raw_lock:
                                yolo_raw_frame = raw_jpeg.tobytes()
            except Exception as e:
                print(f"[yolo] Camera read error: {e}")
                sys.stdout.flush()
                time.sleep(1)

    cam_thread = threading.Thread(target=camera_reader, daemon=True)
    cam_thread.start()

    # Wait for first frame
    if not cam_connected.wait(timeout=10):
        print(f"[yolo] ERROR: Cannot connect to camera at {YOLO_CAMERA_URL}")
        sys.stdout.flush()
        add_yolo_log(f"Cannot connect to camera at {YOLO_CAMERA_URL}", "warning")
        yolo_running_flag = False
        return

    # Initialize tracking state
    with yolo_state_lock:
        yolo_object_state = init_object_state()
        save_object_state(yolo_object_state, state_path)

    warned_missing = set()
    last_state_update = time.time()

    print(f"[yolo] Detection started — camera: {YOLO_CAMERA_URL}")
    sys.stdout.flush()
    add_yolo_log("YOLO detection started — tracking scissors, bottle, knife")

    while not stop_event.is_set():
        # Grab latest frame from camera thread (non-blocking)
        with cam_lock:
            frame = cam_frame.copy() if cam_frame is not None else None

        if frame is None:
            time.sleep(0.05)
            continue

        try:
            # Resize for faster inference
            h, w = frame.shape[:2]
            if w > 640:
                scale = 640 / w
                frame = cv2.resize(frame, (640, int(h * scale)))

            results = model.track(
                frame, persist=True, verbose=False,
                tracker=str(yolo_dir / "bytetrack.yaml"),
                classes=TRACKED_CLASS_IDS,
            )
            result = results[0]

            # Limit to 1 detection per class
            if result.boxes is not None and len(result.boxes) > 0:
                keep = []
                seen_classes = set()
                for i, box in enumerate(result.boxes):
                    cls_name = result.names[int(box.cls)]
                    if cls_name not in seen_classes:
                        seen_classes.add(cls_name)
                        keep.append(i)
                if keep:
                    result.boxes = result.boxes[keep]

            annotated = result.plot()

            # Encode both frames
            _, jpeg = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 50])
            with yolo_frame_lock:
                yolo_annotated_frame = jpeg.tobytes()

            # Determine which objects are detected in this frame
            detected_now = set()
            if result.boxes is not None:
                for box in result.boxes:
                    cls_name = result.names[int(box.cls)]
                    if cls_name in TRACKED_OBJECTS:
                        detected_now.add(cls_name)

            # Update state every ~2 seconds to keep it lightweight
            now = time.time()
            if now - last_state_update >= 2.0:
                last_state_update = now
                ts = datetime.now().isoformat(timespec="seconds")

                with yolo_state_lock:
                    for name in TRACKED_OBJECTS:
                        obj = yolo_object_state[name]
                        if name in detected_now:
                            obj["last_frame"] = "frame1"
                            obj["last_seen"] = ts
                            obj["last_update"] = ts
                            # Clear warning if object reappears
                            if name in warned_missing:
                                warned_missing.discard(name)
                                add_yolo_log(f"{name} detected again", "info")
                        else:
                            # Object not in current frame
                            if obj["last_frame"] != "none":
                                obj["last_frame"] = "none"
                                obj["last_update"] = ts

                            # Check if missing for > threshold
                            if obj["last_seen"] != "never":
                                last_seen_dt = datetime.fromisoformat(obj["last_seen"])
                                elapsed = (datetime.now() - last_seen_dt).total_seconds()
                                if elapsed > MISSING_THRESHOLD_SEC and name not in warned_missing:
                                    warned_missing.add(name)
                                    add_yolo_log(
                                        f"⚠️ {name.upper()} missing from view for {int(elapsed)}s",
                                        "warning",
                                    )
                            elif name not in warned_missing:
                                # Never seen at all
                                warned_missing.add(name)
                                add_yolo_log(f"{name} not yet detected", "info")

                    save_object_state(yolo_object_state, state_path)

        except Exception as e:
            print(f"[yolo] Detection error: {e}")
            sys.stdout.flush()
            time.sleep(1)

        # No sleep between frames — let YOLO inference be the bottleneck

    # Save final state
    with yolo_state_lock:
        save_object_state(yolo_object_state, state_path)

    add_yolo_log("YOLO detection stopped")
    print("[yolo] Detection stopped")
    sys.stdout.flush()
    yolo_running_flag = False


@app.route("/yolo/start", methods=["POST"])
def yolo_start():
    global yolo_running_flag, yolo_stop_event, yolo_thread_ref, yolo_log_entries

    if yolo_running_flag:
        return jsonify({"status": "already_running"})

    # Clear previous logs
    with yolo_log_lock:
        yolo_log_entries.clear()

    yolo_stop_event = threading.Event()
    yolo_running_flag = True
    t = threading.Thread(target=yolo_detection_loop, args=(yolo_stop_event,), daemon=True)
    t.start()
    yolo_thread_ref = t
    return jsonify({"status": "started"})


@app.route("/yolo/stop", methods=["POST"])
def yolo_stop():
    global yolo_running_flag, yolo_annotated_frame

    if not yolo_running_flag:
        return jsonify({"status": "not_running"})
    yolo_stop_event.set()
    # Clear stale frames so next start doesn't flash old content
    with yolo_frame_lock:
        yolo_annotated_frame = None
    return jsonify({"status": "stopped"})


@app.route("/yolo/objects")
def yolo_objects():
    """Return current object tracking state."""
    with yolo_state_lock:
        return jsonify(yolo_object_state)


@app.route("/yolo/log")
def yolo_log():
    """Return YOLO detection log entries."""
    with yolo_log_lock:
        return jsonify(yolo_log_entries)


@app.route("/yolo/video2")
def yolo_video2():
    """Placeholder for second camera (surgeon table)."""
    def generate():
        while True:
            with yolo_frame_lock:
                frame = yolo_annotated_frame
            if frame is not None:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
                )
            time.sleep(0.016)

    return Response(
        generate(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


@app.route("/yolo/video")
def yolo_video():
    """MJPEG stream of YOLO-annotated frames."""
    def generate():
        while True:
            with yolo_frame_lock:
                frame = yolo_annotated_frame
            if frame is not None:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame + b"\r\n"
                )
            time.sleep(0.016)

    return Response(
        generate(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
    )


def main():
    global _source, _log_path, _interval

    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="test.mp4", help="Video source")
    parser.add_argument("--log", default="events.json", help="Event log path")
    parser.add_argument("--interval", type=float, default=3.0, help="Seconds between frames")
    parser.add_argument("--port", type=int, default=5000, help="Server port")
    args = parser.parse_args()

    _source = args.source
    _log_path = Path(args.log)
    _interval = args.interval

    # Start video reader
    reader_thread = threading.Thread(target=video_reader, args=(args.source,), daemon=True)
    reader_thread.start()

    print(f"Server starting on port {args.port}...")
    app.run(host="0.0.0.0", port=args.port, threaded=True)


if __name__ == "__main__":
    main()
