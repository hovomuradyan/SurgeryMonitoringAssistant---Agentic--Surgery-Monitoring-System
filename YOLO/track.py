import argparse
import json
import threading
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import cv2
from ultralytics import YOLO

latest_frame = None
frame_lock = threading.Lock()


def stream_server(port):
    from flask import Flask, Response

    app = Flask(__name__)

    def generate():
        while True:
            with frame_lock:
                frame = latest_frame
            if frame is None:
                time.sleep(0.01)
                continue
            _, buf = cv2.imencode(".jpg", frame)
            yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n")

    @app.route("/")
    def index():
        return '<img src="/video">'

    @app.route("/video")
    def video():
        return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")

    app.run(host="0.0.0.0", port=port, threaded=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="0", help="Camera index or stream URL")
    parser.add_argument("--log", help="Path to output JSON log file")
    parser.add_argument("--config", help='JSON file: {"person": 3, "bottle": 7}')
    parser.add_argument("--stream", action="store_true", help="Serve annotated frames over HTTP")
    parser.add_argument("--port", type=int, default=5000)
    args = parser.parse_args()

    model = YOLO("yolov8n.pt")
    try:
        model.to("mps")
    except Exception:
        pass  # Fall back to CPU
    class_limits = {}
    if args.config:
        class_limits = json.loads(Path(args.config).read_text())

    class_ids = [i for i, n in model.names.items() if n in class_limits] if class_limits else None

    try:
        source = int(args.source)
    except ValueError:
        source = args.source

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open source: {source}")

    if args.stream:
        threading.Thread(target=stream_server, args=(args.port,), daemon=True).start()
        print(f"Streaming at http://localhost:{args.port}")

    log_path = Path(args.log) if args.log else None
    log_buffer = []
    last_flush = time.time()
    prev_time = 0
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            if args.stream:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue
            break

        results = model.track(frame, tracker="bytetrack.yaml", persist=True, verbose=False, classes=class_ids)

        result = results[0]
        if class_limits and result.boxes is not None:
            keep, per_class = [], defaultdict(int)
            for i, box in enumerate(result.boxes):
                cls_name = result.names[int(box.cls)]
                limit = class_limits.get(cls_name)
                if limit and per_class[cls_name] >= limit:
                    continue
                per_class[cls_name] += 1
                keep.append(i)
            result.boxes = result.boxes[keep]

        annotated = result.plot()

        now = time.time()
        fps = 1.0 / (now - prev_time) if prev_time else 0
        prev_time = now

        cv2.putText(annotated, f"FPS: {fps:.1f}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        if args.stream:
            with frame_lock:
                global latest_frame
                latest_frame = annotated.copy()

        if log_path is not None:
            detections = []
            for box in (result.boxes if result.boxes is not None else []):
                cls_name = result.names[int(box.cls)]
                detections.append({
                    "id": int(box.id) if box.id is not None else None,
                    "class": cls_name,
                    "confidence": round(float(box.conf), 3),
                    "bbox": [round(v, 1) for v in box.xyxy[0].tolist()],
                })

            if detections:
                log_buffer.append({
                    "timestamp": datetime.now().isoformat(timespec="seconds"),
                    "detections": detections,
                })

            if now - last_flush >= 5.0:
                if log_buffer:
                    existing = json.loads(log_path.read_text()) if log_path.exists() else []
                    log_path.write_text(json.dumps(existing + log_buffer, indent=2))
                    log_buffer.clear()
                last_flush = now

        if not args.stream:
            cv2.imshow("YOLO + ByteTrack", annotated)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

        frame_idx += 1

    if log_path is not None and log_buffer:
        existing = json.loads(log_path.read_text()) if log_path.exists() else []
        log_path.write_text(json.dumps(existing + log_buffer, indent=2))

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
