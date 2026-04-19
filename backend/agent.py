import argparse
import base64
import json
import time
from datetime import datetime
from pathlib import Path

import anthropic
import cv2
import numpy as np
from dotenv import load_dotenv

load_dotenv()

client = anthropic.AnthropicBedrock()

SYSTEM_PROMPT = """You are a surgical scrub technique monitor watching a live OR camera. Your primary job is to narrate what is happening (info logs) and flag specific technique violations when you clearly see them.

CADENCE: Log a brief info observation about current activity on EVERY frame. Only flag a violation (warning/critical) when you clearly see one — roughly every few frames at most.

TECHNIQUE VIOLATIONS TO WATCH FOR (flag as warning or critical):
- Towel discarded incorrectly after drying (should be dropped into a designated area, not tossed)
- Gown opened with sterile side facing the person (sterile side should face away)
- Gown not tied after donning
- Towel or item dropped below the sterile field / below waist level
- Gauze not counted in descending order during counts
- Arms or hands dropping below waist level while scrubbed
- Coughing or sneezing into hand (should turn away from field)
- Instruments removed from tray during count (should be counted in the tray)
- Counting too fast or in a disorganized manner
- Hands not on the top plane when moving basin stand or equipment
- Hands not wrapped and tucked behind drape when opening it
- Circulator leaning over or making contact with sterile field
- Non-scrubbed person reaching across sterile area
- Breaking sterile technique by touching non-sterile surfaces while scrubbed

ROUTINE OBSERVATIONS (log as info — do this on every frame):
- "Personnel gowning at back table"
- "Scrub tech arranging instruments"
- "Surgeon approaching sterile field"
- "Count in progress"
- "Circulator assisting with gown ties"
- Brief description of the current activity visible in frame

RULES:
- Use tools only. Never produce free-form text.
- EVERY frame: log at least one info observation describing current activity.
- Check recent event history. Do NOT re-log the same violation or same routine observation.
- Only flag a violation if you can clearly see it happening — when in doubt, just log info.
- Keep each observation under 15 words. Be terse and specific.
- Only call alert_team for warning or critical severity.

SEVERITY:
- info: routine activity narration (use this most of the time)
- warning: clear technique violation you can see in the frame
- critical: active sterile breach with direct contamination risk"""

TOOLS = [
    {
        "name": "log_event",
        "description": "Log a detected observation to the permanent event record",
        "input_schema": {
            "type": "object",
            "properties": {
                "severity": {"type": "string", "enum": ["info", "warning", "critical"]},
                "observation": {"type": "string"},
                "action_taken": {"type": "string"},
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


def frame_to_b64(frame):
    h, w = frame.shape[:2]
    if w > 1280:
        frame = cv2.resize(frame, (1280, int(h * 1280 / w)))
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return base64.standard_b64encode(buf).decode()


def execute_tool(name, inp, log_path):
    if name == "log_event":
        entry = {
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "severity": inp["severity"],
            "observation": inp["observation"],
            "action_taken": inp.get("action_taken", ""),
        }
        existing = json.loads(log_path.read_text()) if log_path.exists() else []
        log_path.write_text(json.dumps(existing + [entry], indent=2))
        print(f"[LOG/{entry['severity'].upper()}] {entry['observation']}")
        return entry

    elif name == "alert_team":
        print(f"\n{'=' * 50}")
        print(f"ALERT [{inp['severity'].upper()}]: {inp['message']}")
        print(f"{'=' * 50}\n")
        return {"alerted": True}

    elif name == "request_clarification":
        print(f"[CLARIFICATION NEEDED] {inp['question']}")
        return {"flagged": inp["question"]}

    elif name == "generate_report":
        print(f"\n--- REPORT ({inp['period']}) ---\n{inp['summary']}\n---\n")
        return {"report": inp["summary"]}

    return {"error": f"unknown tool: {name}"}


def run(source, log_path, interval):
    try:
        source = int(source)
    except ValueError:
        pass

    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open source: {source}")

    recent_events = []
    is_webcam = isinstance(source, int)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    frames_to_skip = max(1, int(fps * interval))
    print(f"Agent running. Sampling every {interval}s. Ctrl+C to stop.\n")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if np.mean(frame) < 10:
            if is_webcam:
                time.sleep(interval)
            else:
                pos = int(cap.get(cv2.CAP_PROP_POS_FRAMES))
                cap.set(cv2.CAP_PROP_POS_FRAMES, pos + frames_to_skip)
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
                        "text": f"Analyze this frame. Only log issues not already in history.{history_text}",
                    },
                ],
            }
        ]

        # agentic loop for this frame
        while True:
            response = client.messages.create(
                model="us.anthropic.claude-3-haiku-20240307-v1:0",
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

        if is_webcam:
            time.sleep(interval)
        else:
            pos = int(cap.get(cv2.CAP_PROP_POS_FRAMES))
            cap.set(cv2.CAP_PROP_POS_FRAMES, pos + frames_to_skip)

    cap.release()

    if not recent_events:
        print("No events logged — no report generated.")
        return

    print("\nGenerating final report...")
    event_list = "\n".join(
        f"- [{e['timestamp']}] {e['severity'].upper()}: {e['observation']}"
        for e in recent_events
    )
    response = client.messages.create(
        model="us.anthropic.claude-3-haiku-20240307-v1:0",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        tools=TOOLS,
        tool_choice={"type": "tool", "name": "generate_report"},
        messages=[{
            "role": "user",
            "content": f"Generate a final summary report of this session.\n\nAll logged events:\n{event_list}"
        }],
    )
    for block in response.content:
        if block.type == "tool_use" and block.name == "generate_report":
            execute_tool("generate_report", block.input, log_path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="0", help="Camera index or stream URL")
    parser.add_argument("--log", default="events.json", help="Event log path")
    parser.add_argument("--interval", type=float, default=3.0, help="Seconds between frames")
    args = parser.parse_args()

    run(args.source, Path(args.log), args.interval)


if __name__ == "__main__":
    main()
