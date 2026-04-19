# Implementation Plan: Video Feed Dashboard

## Overview

Build a React + TypeScript + Tailwind CSS dashboard application with two video feeds, a log panel, and an LLM-powered text assistance panel. All external dependencies are abstracted behind typed interfaces with mock implementations. The implementation proceeds bottom-up: types and interfaces first, then services, hooks, and finally UI components wired together.

## Tasks

- [x] 1. Scaffold project and define core types
  - [x] 1.1 Initialize React + TypeScript project with Vite, install Tailwind CSS, Vitest, React Testing Library, jsdom, and fast-check
    - Create the Vite React-TS project
    - Configure Tailwind CSS with `index.css` directives
    - Configure Vitest with jsdom environment in `vite.config.ts`
    - Set up the directory structure: `src/components/`, `src/hooks/`, `src/services/videoStream/`, `src/services/llm/`, `src/services/log/`, `src/types/`, `src/__tests__/`
    - _Requirements: 12.1, 11.1_

  - [x] 1.2 Define all TypeScript types and interfaces
    - Create `src/types/stream.ts` with `StreamStatus`, `StreamSourceType`, `StreamSourceConfig`, `FrameHandler`
    - Create `src/types/llm.ts` with `LLMServiceConfig`, `ChatMessage`
    - Create `src/types/log.ts` with `LogLevel`, `LogEntry`, `FormattedLogEntry`
    - Create `src/services/videoStream/VideoStreamService.ts` with the `VideoStreamService` interface
    - Create `src/services/llm/LLMService.ts` with the `LLMService` interface
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 9.1, 9.3_

- [x] 2. Implement log service and parser
  - [x] 2.1 Implement log entry parsing and formatting functions
    - Create `src/services/log/logParser.ts` with `parseLogEntry`, `formatLogEntry`, and `parseFormattedLogEntry`
    - Use consistent timestamp format: `[YYYY-MM-DD HH:mm:ss] [LEVEL] message`
    - Throw `TypeError` for malformed input in `parseLogEntry`
    - Throw descriptive error for malformed strings in `parseFormattedLogEntry`
    - _Requirements: 13.1, 13.2, 13.3_

  - [ ]* 2.2 Write property test: parseLogEntry extracts correct fields
    - **Property 1: parseLogEntry extracts correct fields**
    - Generate random valid log objects (random Date, random LogLevel, random non-empty string). Call `parseLogEntry` and verify output fields match input.
    - Use fast-check with minimum 100 iterations
    - Create `src/__tests__/properties/logParser.property.test.ts`
    - **Validates: Requirements 13.1**

  - [ ]* 2.3 Write property test: Log entry format round-trip
    - **Property 2: Log entry format round-trip**
    - Generate random valid `LogEntry` objects. Call `formatLogEntry` then `parseFormattedLogEntry`. Verify result equals original (timestamp to second precision, same level, same message). Verify formatted string matches expected pattern.
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 13.2, 13.3**

  - [x] 2.4 Implement LogService with pub/sub pattern
    - Create `src/services/log/LogService.ts` as a singleton with `subscribe` and `log` methods
    - Create `src/services/log/index.ts` barrel export
    - _Requirements: 7.1, 7.2_

  - [ ]* 2.5 Write unit tests for logParser and LogService
    - Test `parseLogEntry` with valid objects and malformed input
    - Test `formatLogEntry` produces expected format strings
    - Test `parseFormattedLogEntry` with valid and invalid strings
    - Test `LogService` subscribe/unsubscribe and entry publishing
    - Create `src/__tests__/services/logParser.test.ts` and `src/__tests__/services/LogService.test.ts`
    - _Requirements: 13.1, 13.2, 13.3, 7.1_

- [x] 3. Implement video stream service
  - [x] 3.1 Implement MockVideoStreamService
    - Create `src/services/videoStream/MockVideoStreamService.ts`
    - Simulate connection phase: transition from "connecting" to "live" after configurable delay
    - Produce animated canvas frames at regular intervals while "live"
    - Auto-play on initialization
    - Simulate periodic errors and automatic retry with configurable delay
    - Log lifecycle events (connection, disconnection, error, retry) to console
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4_

  - [x] 3.2 Implement createVideoStreamService factory
    - Create `src/services/videoStream/createVideoStreamService.ts`
    - Read `config.sourceType` and return `MockVideoStreamService` for "mock"
    - Throw descriptive error for unsupported source types
    - _Requirements: 4.1, 4.2_

  - [ ]* 3.3 Write unit tests for MockVideoStreamService
    - Test status transitions: connecting → live
    - Test frame production at intervals
    - Test error/retry cycle
    - Test cleanup on stop
    - Create `src/__tests__/services/MockVideoStreamService.test.ts`
    - _Requirements: 5.1, 5.2, 6.1, 6.2, 6.3_

- [x] 4. Implement LLM service
  - [x] 4.1 Implement MockLLMService
    - Create `src/services/llm/MockLLMService.ts`
    - Return canned responses after configurable delay
    - Accept configuration object for endpoint and options
    - _Requirements: 9.2, 9.3_

  - [x] 4.2 Implement createLLMService factory
    - Create `src/services/llm/createLLMService.ts`
    - Read `config.type` and return `MockLLMService` for "mock"
    - _Requirements: 9.1, 9.3_

  - [ ]* 4.3 Write unit tests for MockLLMService
    - Test that responses are returned after delay
    - Test that configuration is accepted
    - Create `src/__tests__/services/MockLLMService.test.ts`
    - _Requirements: 9.2_

- [x] 5. Checkpoint - Ensure all service-layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement custom React hooks
  - [x] 6.1 Implement useVideoStream hook
    - Create `src/hooks/useVideoStream.ts`
    - Create and manage `VideoStreamService` instance via factory
    - Return `{ status, frameSrc, start, stop }`
    - Clean up on unmount: stop stream, remove listeners
    - Memoize callbacks with `useCallback`, stabilize config reference
    - _Requirements: 4.5, 10.1, 10.3_

  - [x] 6.2 Implement useLLMService hook
    - Create `src/hooks/useLLMService.ts`
    - Return `{ messages, sendMessage, isLoading }`
    - Manage message history in local state
    - Cancel pending requests on unmount using abort/cancelled flag
    - _Requirements: 9.4, 10.2_

  - [x] 6.3 Implement useLogEntries hook
    - Create `src/hooks/useLogEntries.ts`
    - Subscribe to LogService singleton on mount
    - Return `entries: LogEntry[]`
    - Unsubscribe on unmount
    - _Requirements: 7.1, 10.1_

  - [ ]* 6.4 Write unit tests for hooks
    - Test `useVideoStream`: correct return shape, cleanup on unmount, status reflection
    - Test `useLLMService`: correct return shape, message history management, cleanup on unmount
    - Test `useLogEntries`: subscribes on mount, unsubscribes on unmount, accumulates entries
    - Create `src/__tests__/hooks/useVideoStream.test.ts`, `src/__tests__/hooks/useLLMService.test.ts`, `src/__tests__/hooks/useLogEntries.test.ts`
    - _Requirements: 4.5, 9.4, 10.1, 10.2_

- [x] 7. Implement UI components
  - [x] 7.1 Implement NavigationBar component
    - Create `src/components/NavigationBar.tsx`
    - Accept `title` prop, render fixed top bar with application title
    - Apply Tailwind styling: background color, padding, text formatting, fixed positioning
    - Support dark/light mode via Tailwind dark: variants
    - _Requirements: 2.1, 2.2, 2.3, 11.2, 11.3, 11.4_

  - [x] 7.2 Implement VideoPlayer component
    - Create `src/components/VideoPlayer.tsx`
    - Accept `title` and `streamConfig` props
    - Call `useVideoStream(streamConfig)` internally
    - Render status indicator showing "Live", "Connecting", or "Error"
    - Render video frame content when "live", spinner when "connecting", error fallback when "error"
    - Apply visual polish: rounded corners, shadows, consistent spacing
    - Memoize callbacks to avoid unnecessary re-renders
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 10.3, 12.3_

  - [x] 7.3 Implement LogPanel component
    - Create `src/components/LogPanel.tsx`
    - Call `useLogEntries()` internally
    - Display scrollable list of timestamped log entries using `formatLogEntry`
    - Auto-scroll to bottom on new entries
    - Display title label
    - Apply consistent styling with rounded corners, shadows, spacing
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 13.1, 13.2_

  - [x] 7.4 Implement TextAssistancePanel component
    - Create `src/components/TextAssistancePanel.tsx`
    - Call `useLLMService(config)` internally
    - Display scrollable message history with user/assistant differentiation
    - Provide text input field and send button
    - Display user message immediately on submit
    - Show loading indicator while waiting for response
    - Display title label
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 7.5 Implement Dashboard layout component
    - Create `src/components/Dashboard.tsx`
    - Render two VideoPlayer components and two text panels (LogPanel, TextAssistancePanel)
    - Responsive grid: side-by-side above 768px (left video larger), stacked below 768px
    - Text panels side-by-side above 768px, stacked below
    - No shared state — each child manages its own via hooks
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 10.4_

  - [x] 7.6 Implement App component with Error Boundary
    - Create `src/components/App.tsx`
    - Render `NavigationBar` and `Dashboard`
    - Wrap `Dashboard` in a React Error Boundary with fallback UI and reload button
    - _Requirements: 1.1, 2.1_

  - [ ]* 7.7 Write unit tests for UI components
    - Test `NavigationBar`: renders title, has fixed positioning classes
    - Test `VideoPlayer`: renders correct UI for each status, displays title
    - Test `LogPanel`: renders entries with timestamps, auto-scrolls, displays title
    - Test `TextAssistancePanel`: renders message history, input field, send button, user messages appear immediately
    - Test `Dashboard`: renders all four panels, responsive layout classes
    - Create test files in `src/__tests__/components/`
    - _Requirements: 1.1, 2.1, 3.1, 3.2, 7.1, 7.4, 8.1, 8.2, 8.6_

- [x] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Apply styling, theming, and final polish
  - [x] 9.1 Configure Tailwind dark mode and apply theme styling
    - Configure Tailwind for `media` dark mode strategy in `tailwind.config.js`
    - Apply dark: variants across all components for dark color scheme
    - Ensure readable text contrast ratios in both light and dark modes
    - Apply minimal, modern visual design with consistent spacing, rounded corners, subtle shadows
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 9.2 Wire entry point and verify full application renders
    - Update `src/index.tsx` to render `App`
    - Update `src/index.css` with Tailwind directives
    - Verify the full application renders with all panels, mock streams, and mock LLM
    - _Requirements: 1.1, 12.1, 12.2_

- [x] 10. Create README and final cleanup
  - [x] 10.1 Create README with run instructions and stream replacement guide
    - Explain how to install dependencies and run the application
    - Explain how to replace mock video streams with real API streams (MJPEG, WebSocket, WebRTC)
    - Explain how to replace mock LLM service with a real LLM API
    - Document the project structure and separation of concerns
    - _Requirements: 12.4_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation language is TypeScript as specified in the design document
