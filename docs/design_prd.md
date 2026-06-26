# Design PRD - YibYib Tauri v2 Downloader

## 1. Design & Visual Aesthetic

The user interface is designed with a premium, sleek **Cosmic Dark** theme. Since it is a desktop downloader client built on Tauri v2, the interface emphasizes space efficiency, real-time command feedback, and highly readable indicators.

### 1.1 Palette
*   **Background (Dominant):** Deep Rich Charcoal (`#090d16` to `#0d1321` gradients).
*   **Surface Cards:** `#131b2e` with subtle slate borders (`#1e293b`).
*   **Primary Accent:** Electric Blue (`#2563eb` and `#3b82f6`) representing technology and speed.
*   **Success Indicator:** Emerald Green (`#10b981`) for completed tasks.
*   **Warning/Phase Indicator:** Amber Orange (`#f59e0b`) representing active transcoding or processing stages.

### 1.2 Typography
*   **Display / Headings:** Sans-Serif font (Inter) with medium-to-bold weights for clear command categories.
*   **Logs / Metrics:** Monospace font (JetBrains Mono / Fira Code) representing terminal output, speeds, size, and version numbers.

---

## 2. Component Design & Layout Strategy

The application layout is a high-productivity single-window dashboard split into:
1.  **Sidebar / Navigation Tab:** Fast toggles between:
    *   **Unduh (Download Center):** Core paste, playlist parsing, and queueing views.
    *   **Riwayat (Completed):** File history manager with click-to-open simulation.
    *   **Eror Logs (System Output):** Terminal representing active yt-dlp & ffmpeg CLI logs.
    *   **Pengaturan (Settings):** Thread limits, directory select, and default audio/video containers.
2.  **Top Status Header:** Indicators for current bandwidth simulation, simulated Tauri environment, and network mode.
3.  **Active Progress Stage:** Dual-threaded batch progress card layouts rendering active download percentages, speed in MB/s, and a real-time phase indicator (e.g., `yt-dlp: Mengunduh...`, `ffmpeg: Mengonversi ke MP3...`).

---

## 3. Interaction Mechanics

*   **Pasting Logic:** Quick paste button that reads clipboard instantly.
*   **Checked Link Detail Popover:** When a user checks a link, a specialized slide-down container renders either the video information or an interactive playlist checklist.
*   **Progress Animations:** Staggered status updates and smooth CSS-based spring-like transition progress bars.
