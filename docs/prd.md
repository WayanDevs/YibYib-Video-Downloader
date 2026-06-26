# Product Requirements Document (PRD)

## Project Name: YibYib Tauri v2 Desktop Downloader
**Version:** 2.0.0
**Target Framework:** Tauri v2 (Rust Backend + Vanilla JS/CSS/HTML Frontend via Vite)
**Core Engine:** yt-dlp (Media Scraping) & ffmpeg (Transcoding/Conversion)

---

## 1. Executive Summary
YibYib Desktop Downloader is a high-performance, cross-platform desktop application built using **Tauri v2**. It leverages a robust Rust backend to interface directly with local installations of `yt-dlp` and `ffmpeg`. The application is designed to download media from over 1,000 video hosting platforms (including YouTube, TikTok, Instagram, and Vimeo) and convert them into standard video formats (MP4, WebM) or high-quality audio files (MP3, M4A, WAV).

This version focuses on:
*   Transitioning to a minimalist **Tauri v2 architecture** (Rust backend + Vanilla HTML/CSS/JS frontend).
*   Supporting advanced **sequential/batch queue download scheduling** with custom batch sizing (e.g., 2 batch downloads).
*   Enabling **Link-Checking ("Cek Link")** to preview playlists or video details before queueing.
*   Integrating **Bulk Uploading** for batch links from `.txt` files or manual input.
*   Offering smooth multi-format transcoding (MP4 to MP3, WAV, WebM).

---

## 2. Core Features & Functional Requirements

### 2.1 Tauri v2 Architecture
*   **Backend (Rust):** Must handle OS-level process execution for `yt-dlp` and `ffmpeg`, manage filesystem paths, manage the global download queue, and stream stdout progress back to the frontend.
*   **Frontend (Vanilla JS, CSS, HTML):** Bound using Vite. Zero framework dependencies (no React/Vue) to ensure instant startup speeds, low memory footprints, and simple maintenance.
*   **Inter-process Communication (IPC):** Uses Tauri's `invoke` API to pass download arguments and `tauri::event` to emit real-time progress updates.

### 2.2 Link-Checking ("Cek Link") & Playlist Resolution
*   Before adding to the queue, the user can click **"Cek Link"** to run a dry-run analysis using `yt-dlp --dump-json --flat-playlist`.
*   If the link is a **Playlist** (e.g., `list=...` query parameter):
    *   The app extracts all individual tracks (title, duration, index, and thumbnail).
    *   Renders a detailed playlist preview container.
    *   Gives the user the option to download the entire playlist sequentially.
*   If the link is a **Single Video**:
    *   Validates video details and prepares metadata.

### 2.3 Audio-Only & Format Transcoding
*   Supports video-to-audio extraction using `ffmpeg` parameters (`-x --audio-format mp3`, etc.).
*   **Supported File Types:**
    *   *Video:* MP4, WebM
    *   *Audio:* MP3 (up to 320kbps), M4A (AAC), WAV (Lossless)
*   **Kualitas Audio Options:** 128kbps, 192kbps, 256kbps, 320kbps, and WAV-Lossless.

### 2.4 Queue Scheduling & Batch Configuration
*   **Queue Management:** Added items start in a `queued` state.
*   **Batch Settings:** Users can configure the **Batch Limit** in Settings (e.g., maximum 1, 2, or 3 concurrent downloads).
*   **Sequential Processing:**
    *   If Batch Limit = 2, the app downloads a maximum of 2 items simultaneously.
    *   Once a video completes, the next item in the queue automatically upgrades from `queued` to `downloading` under its corresponding download progress slot.
    *   All downloads are processed strictly in their order of queue registration.

### 2.5 Bulk Uploading
*   **Manual TextArea:** Allows pasting multiple URLs, one per line.
*   **Drag-and-Drop / File Upload:** Supports uploading `.txt` files containing target URLs.
*   **Input Parsing:** Automatically sanitizes input, extracts valid `http://` or `https://` protocols, and batches them into the queue using the current default settings.

---

## 3. UI/UX Design Goals
*   **Aesthetic Theme:** Dark, modern, high-contrast dashboard with blue accents.
*   **Visual Transparency:** Real-time logging console representing the output from `yt-dlp` and `ffmpeg` (e.g., `[yt-dlp] Menganalisis...`, `[ffmpeg] Mengonversi ke MP3...`).
*   **Status Badging:** High-visibility indicators for file formats (e.g., `MP3`, `MP4`, `WEBM`) and download states (`Tersimpan`, `Gagal`, `Mengunduh`).

---

## 4. Technical Constraints & Architecture
*   **IPC Communication:**
    *   `invoke("check_link", { url })` -> Returns single metadata or playlist array.
    *   `invoke("start_download", { id, url, format, quality })` -> Triggers child process.
    *   `listen("download-progress", event)` -> Receives progress percentage, speed, and active phase (`yt-dlp` downloading vs `ffmpeg` muxing/converting).
*   **Local State Persistence:** Preferences (batch size, default directory, default formats) are stored using client-side local persistence (which mirrors Tauri's backend-managed config).
