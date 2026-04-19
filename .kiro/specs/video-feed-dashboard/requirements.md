# Requirements: AssistMySurgery Dashboard

## Overview

A real-time surgical safety monitoring dashboard with AI-powered video analysis and object detection. Two operational modes: AI Agent (LLM-based safety monitoring) and YOLO Detection (object tracking with missing-item alerts).

## User Stories

### 1. Dashboard Layout
- 1.1 As a user, I want a single-page dashboard with a navigation bar, view tabs, and dark mode toggle.
- 1.2 As a user, I want to switch between "AI Agent" and "YOLO Detection" views via tabs in the nav bar.
- 1.3 As a user, I want the layout to be responsive and fit the screen without scrolling.

### 2. Video Streaming
- 2.1 As a user, I want to see a live MJPEG video feed from the backend.
- 2.2 As a user, I want the video to play continuously without requiring the AI agent or YOLO to be active.
- 2.3 As a user, I want the video to reconnect automatically when switching tabs.

### 3. AI Safety Agent
- 3.1 As a user, I want a Start/Stop button to control when the AI agent analyzes video frames.
- 3.2 As a user, I want safety alerts (from `alert_team` tool calls) displayed in a dedicated Safety Alerts panel.
- 3.3 As a user, I want agent observations (from `log_event` tool calls) displayed in a separate Agent Logs panel.
- 3.4 As a user, I want the agent to stop automatically when I switch to the YOLO tab.
- 3.5 As a user, I want no LLM API calls when the agent is stopped.

### 4. Voice Alerts (ElevenLabs TTS)
- 4.1 As a user, I want safety alerts read aloud via ElevenLabs text-to-speech.
- 4.2 As a user, I want voice messages to play sequentially without overlapping.
- 4.3 As a user, I want a mute/unmute toggle to control voice alerts.
- 4.4 As a user, I want muting to stop current playback and clear the queue.

### 5. YOLO Object Detection
- 5.1 As a user, I want YOLO detection to track exactly 3 objects: scissors, bottle, knife (max 1 each).
- 5.2 As a user, I want a main video feed showing YOLO detection overlays (bounding boxes).
- 5.3 As a user, I want a smaller preview video on the right side showing the same detection feed.
- 5.4 As a user, I want object tracking cards showing each object's status (visible, missing, never seen).
- 5.5 As a user, I want a warning triggered when an object is missing from both frames for more than 7 seconds.
- 5.6 As a user, I want missing objects highlighted with a red background and pulsing indicator.
- 5.7 As a user, I want a detection log showing timestamped events.
- 5.8 As a user, I want YOLO detection to stop automatically when I switch to the AI Agent tab.

### 6. Object Tracking State
- 6.1 As a developer, I want object state stored in `backend/yolo_objects.json` with format: `{object_id, last_frame, last_seen, last_update}`.
- 6.2 As a developer, I want `last_frame` to be "frame1" when detected, "none" when not visible.
- 6.3 As a developer, I want state updates every 2 seconds to keep the system lightweight.
- 6.4 As a developer, I want the frontend to poll `/yolo/objects` and `/yolo/log` every 2 seconds.

### 7. Dark/Light Mode
- 7.1 As a user, I want a toggle button in the nav bar to switch between dark and light themes.
- 7.2 As a user, I want my theme preference persisted across sessions (localStorage).
- 7.3 As a user, I want the default theme to match my OS preference.

### 8. Performance
- 8.1 As a developer, I want the SSE connection only active when the AI agent is running.
- 8.2 As a developer, I want no YOLO processing when detection is stopped.
- 8.3 As a developer, I want the video reader in a dedicated thread at native FPS, independent of analysis.
- 8.4 As a developer, I want YOLO detection to run without artificial sleep — inference is the bottleneck.

### 9. Backend API
- 9.1 As a developer, I want `/video` serving MJPEG at 30 FPS from the video source.
- 9.2 As a developer, I want `/events` serving SSE for agent alerts and logs.
- 9.3 As a developer, I want `/agent/start` and `/agent/stop` to control LLM analysis.
- 9.4 As a developer, I want `/yolo/start` and `/yolo/stop` to control YOLO detection.
- 9.5 As a developer, I want `/yolo/video` serving MJPEG with detection overlays.
- 9.6 As a developer, I want `/yolo/objects` returning the current tracking state JSON.
- 9.7 As a developer, I want `/yolo/log` returning detection log entries.

### 10. Deployment
- 10.1 As a developer, I want the frontend deployable as static files served by Nginx.
- 10.2 As a developer, I want Nginx to proxy `/api/*` to the backend on port 5000.
- 10.3 As a developer, I want the backend runnable as a systemd service on EC2.

## Acceptance Criteria

- Video streams at 30 FPS without the agent or YOLO running.
- AI agent only makes Bedrock API calls between Start and Stop.
- YOLO detects only scissors, bottle, knife (max 1 each).
- Missing-object warning triggers after 7 seconds of absence.
- Voice alerts play sequentially without overlap.
- Theme toggle switches between light and dark mode instantly.
- Switching tabs auto-stops the active analysis (agent or YOLO).
- All state files (.env, yolo_objects.json, events.json) are gitignored.
