# Changelog

All notable changes to the YibYib Tauri v2 Desktop Downloader project are documented here.

---

## [2.0.0] - 2026-06-26

### Added
*   **Tauri v2 Architecture Blueprint:** Separated codebase into clear `/src/frontend/` (Vanilla JS/CSS/HTML) and `/src/backend/` (Rust) folders, laying down ready-to-use desktop entry points.
*   **Vanilla JS Rewrite:** Migrated completely off heavy TSX/React to super fast, framework-less, vanilla JavaScript/TypeScript with Vite compilation.
*   **yt-dlp Live Link Checker:** Added a "Cek Link" button simulating backend query `yt-dlp --dump-json` to extract and preview single tracks or sequential playlist items before registering them.
*   **Multi-Threaded Concurrency Queue:** Implemented a backend-level batch downloader queue (e.g. maximum of 2 concurrent downloads).
*   **Auto-Progression Queue Scheduling:** Programmed the system to automatically advance next queued files once active batch slots complete.
*   **ffmpeg Transcoding Suite:** Enhanced audio conversion profiles supporting high-quality MP3 (320kbps), M4A AAC, and WAV Lossless formats.
*   **Bulk Link Loader:** Developed dual-input channels supporting bulk text pasting and `.txt` file drag-and-drop parser.

### Changed
*   Replaced the React client-side framework to optimize memory overhead to <25MB inside the Tauri v2 webview.
*   Redesigned settings panel to support configurable queue batch size presets.
