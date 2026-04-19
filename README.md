# AssistMySurgery

A real-time surgical safety monitoring dashboard that combines AI-powered video analysis with object detection. The system watches an OR camera feed, flags safety violations via an LLM agent (Claude on AWS Bedrock), and tracks surgical instruments using YOLOv8.

## Features

- **Live video streaming** — MJPEG video feed from a camera or video file
- **AI Safety Agent** — Claude Sonnet 4.5 (via AWS Bedrock) analyzes frames for PPE violations, sterile field breaches, and protocol deviations
- **YOLO Object Detection** — YOLOv8n + ByteTrack tracks scissors, bottle, and knife with missing-object alerts (>7s threshold)
- **Voice alerts** — ElevenLabs TTS reads safety alerts aloud with sequential queuing
- **Dark/light mode** — Toggle via the nav bar, persisted to localStorage
- **On-demand analysis** — Start/Stop buttons control LLM and YOLO to save resources and API tokens

## Architecture

```
Frontend (React + TypeScript + Tailwind)
├── AI Agent tab — video + safety alerts + agent logs
├── YOLO tab — video + detection preview + object tracking + log
└── Shared — dark mode, nav bar, MJPEG video player

Backend (Python + Flask)
├── /video — MJPEG stream from video source (30 FPS)
├── /events — SSE stream of agent observations
├── /agent/start|stop — Control LLM analysis
├── /yolo/start|stop — Control YOLO detection
├── /yolo/video — MJPEG stream with detection overlays
└── /yolo/objects|log — Object tracking state and log
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.9+
- AWS account with Bedrock access (for the AI agent)
- ElevenLabs API key (optional, for voice alerts)

### Install

```bash
# Frontend
npm install

# Backend
pip install -r backend/requirements.txt

# YOLO (uses its own venv)
cd YOLO && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```

### Configure

Create `backend/.env`:

```
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_DEFAULT_REGION=us-east-1
```

Set the ElevenLabs API key in `src/components/Dashboard.tsx`:

```typescript
const ELEVENLABS_API_KEY = "your_elevenlabs_key";
```

Place a test video at `backend/test.mp4` and `YOLO/test.mp4`.

### Run locally

```bash
# Terminal 1: Backend
cd backend && python3 server.py --source test.mp4 --port 5000

# Terminal 2: Frontend
npm run dev
```

Open http://localhost:5174

### Build & deploy

```bash
npm run build
# dist/ contains the production frontend
# Deploy with Nginx proxying /api/ to the backend on port 5000
```

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── App.tsx              — Root with dark mode + view switching
│   │   ├── NavigationBar.tsx    — Nav bar with tabs + theme toggle
│   │   ├── Dashboard.tsx        — AI Agent view (video + alerts + logs)
│   │   ├── YoloView.tsx         — YOLO view (video + tracking + log)
│   │   ├── VideoPlayer.tsx      — MJPEG video player component
│   │   ├── AgentAlertPanel.tsx  — Safety alerts panel
│   │   └── AgentLogPanel.tsx    — Agent log panel
│   ├── hooks/
│   │   ├── useVideoStream.ts    — Manages MJPEG stream lifecycle
│   │   ├── useAgentEvents.ts    — SSE connection for agent events
│   │   └── useTextToSpeech.ts   — ElevenLabs TTS with queue
│   └── services/
│       ├── videoStream/         — MJPEG + mock stream services
│       ├── agent/               — SSE event service
│       └── tts/                 — ElevenLabs TTS service
├── backend/
│   ├── server.py                — Flask server (video, agent, YOLO)
│   ├── agent.py                 — Standalone agent script
│   └── requirements.txt
├── YOLO/
│   ├── track.py                 — YOLO tracking script
│   ├── yolov8n.pt               — YOLOv8 nano model
│   └── bytetrack.yaml           — ByteTrack config
└── deploy/                      — EC2 deployment configs
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/video` | GET | MJPEG video stream |
| `/events` | GET | SSE stream of agent events |
| `/agent/start` | POST | Start AI safety analysis |
| `/agent/stop` | POST | Stop AI safety analysis |
| `/agent/status` | GET | Agent running state |
| `/yolo/start` | POST | Start YOLO detection |
| `/yolo/stop` | POST | Stop YOLO detection |
| `/yolo/video` | GET | MJPEG stream with YOLO overlays |
| `/yolo/objects` | GET | Object tracking state JSON |
| `/yolo/log` | GET | YOLO detection log |
| `/health` | GET | Health check |

## YOLO Object Tracking

Tracks 3 objects (max 1 each): **scissors**, **bottle**, **knife**.

State is stored in `backend/yolo_objects.json`:

```json
{
  "objects": {
    "scissors": {
      "object_id": "scissors",
      "last_frame": "frame1",
      "last_seen": "2026-04-19T03:15:00",
      "last_update": "2026-04-19T03:15:00"
    }
  }
}
```

If an object's `last_frame` is `"none"` for more than 7 seconds, a warning is triggered.

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Python, Flask, OpenCV, Anthropic SDK (Bedrock)
- **Detection**: YOLOv8n, ByteTrack
- **TTS**: ElevenLabs API
- **Deployment**: AWS EC2, Nginx
