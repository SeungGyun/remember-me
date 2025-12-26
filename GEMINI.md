# Project Context: remember-me

## Overview
**remember-me** is a desktop application designed to record, transcribe, and manage meeting audio. It utilizes **Electron** for the desktop environment, **React** for the UI, and integrates with **Python** and **Whisper** for advanced audio processing (Speech-to-Text and Speaker Diarization).

## Architecture
The application follows a standard Electron + React architecture with specialized modules for audio processing.

*   **Frontend (Renderer):**
    *   Built with **React**, **Vite**, and **Tailwind CSS**.
    *   Entry point: `app/renderer/main.jsx` (mounts `App.jsx`).
    *   Communicates with the main process via `preload.js` and `ipcRenderer`.
    *   Key components: `AudioRecorder`, `MeetingList`, `TranscriptView`, `SpeakerManager`.

*   **Backend (Main Process):**
    *   Entry point: `app/main.js`.
    *   Manages application lifecycle, window creation, and native integrations.
    *   **Modules (`app/modules/`):**
        *   `meeting-recorder.js`: Orchestrates recording sessions, handles IPC events for meeting control.
        *   `database.js`: Manages SQLite database (`better-sqlite3`) for storing meetings, transcripts, and participants.
        *   `ffmpeg-manager.js`: Handles audio recording via FFmpeg.
        *   `python-manager.js`: Interfaces with Python scripts for tasks like speaker diarization.

*   **External Engines:**
    *   **Python Runtime:** Bundled local Python environment (`python-runtime/`) to execute analysis scripts (`python-scripts/`).
    *   **Whisper:** Used for Speech-to-Text (STT).
    *   **FFmpeg/SoX:** Used for audio capture and format conversion.

## Key Directories

*   `app/` - Source code for Electron main process and React renderer.
*   `python-scripts/` - Python scripts for audio analysis (e.g., `diarize.py`, `stream_stt.py`).
*   `scripts/` - Setup and utility scripts (e.g., downloading models, setting up environments).
*   `dist-new/` - Output directory for the packaged application (Electron Builder).
*   `resources/` - Contains external binaries (FFmpeg, Whisper, etc.) in the packaged app.

## Development

### Prerequisites
*   Node.js (LTS recommended)
*   Python (for environment setup)

### Setup
Initialize the environment and download necessary binaries/models:
```bash
npm install
npm run setup:all
```

### Running in Development
Start the Vite dev server and Electron app concurrently:
```bash
npm start
```

### Building for Production
Create a distributable installer (Windows):
```bash
npm run dist
```

## Conventions
*   **Styling:** Tailwind CSS is used for all styling.
*   **IPC:** All inter-process communication is defined in `app/main.js` (handlers) and `app/preload.js` (exposed API).
*   **Database:** SQLite queries are prepared and executed synchronously in the main process.
*   **Language:** Korean is used for UI text and comments.
