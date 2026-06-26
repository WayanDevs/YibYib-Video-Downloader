# Product Requirements Document (PRD)

## Nama Proyek: YibYib Downloader & Audio Converter
**Versi:** 2.0.0  
**Target Platform:** Aplikasi Desktop Cross-Platform (Windows, macOS, Linux)  
**Arsitektur Target:** Tauri v2 (Backend Rust Native + Frontend TypeScript/React via Vite)  

---

## 1. Ringkasan Eksekutif (Executive Summary)

YibYib Downloader adalah aplikasi desktop mutakhir yang dibangun menggunakan **Tauri v2** untuk kinerja tinggi dan penggunaan memori yang minimal. Aplikasi ini dirancang untuk memudahkan pengguna mengunduh konten multimedia dari internet secara aman dan mengonversi file video lokal atau hasil unduhan menjadi format audio kualitas tinggi (MP3, WAV). 

Dengan migrasi ke arsitektur **Tauri v2 + Rust Backend**, aplikasi ini menjamin performa biner yang super cepat, ukuran paket instalasi yang kecil (<15MB), dan keamanan memori yang solid tanpa overhead dari runtime Node.js di sisi pengguna akhir.

---

## 2. Persyaratan Fungsional (Functional Requirements)

### 2.1 Arsitektur Tauri v2 & Rust Core
- **Native Backend (Rust):** Bertanggung jawab mengelola database riwayat SQLite lokal, melacak antrean unduhan secara paralel, memantau berkas sistem, dan melakukan spawn utilitas CLI pihak ketiga seperti `yt-dlp` dan `ffmpeg`.
- **Frontend (TypeScript):** UI dinamis dikembangkan menggunakan Tailwind CSS v4 untuk styling terpusat dan pemutaran media lokal.
- **Komunikasi IPC Aman (Tauri Commands):** Semua fungsionalitas utama backend diekspos secara aman ke frontend menggunakan mekanisme Tauri `invoke`.
- **Event Streaming:** Pengiriman status progres unduhan dan konversi real-time menggunakan Tauri `Emitter` ke frontend.

### 2.2 Manajemen Antrean & Batas Konkurensi (Concurrency)
- **2 Batch Aktif:** Sistem membatasi proses pengunduhan bersamaan maksimal 2 item secara simultan untuk menjaga stabilitas bandwidth dan disk I/O pengguna.
- **Penjadwalan Otomatis:** Ketika salah satu proses unduhan selesai, item berikutnya yang berada dalam status `queued` (antre) akan otomatis dinaikkan ke status `downloading` (aktif).
- **Kontrol Antrean:** Pengguna dapat menangguhkan (pause), melanjutkan (resume), atau membatalkan (cancel) setiap baris antrean secara interaktif.

### 2.3 Konversi Audio (Audio Converter Hub)
- **Ekstraksi Lokal & Riwayat:** Pengguna dapat langsung mengekstrak audio dari berkas yang sukses diunduh atau mengunggah berkas video lokal via drag-and-drop.
- **Kualitas Audio Premium:** Mendukung enkoding audio resolusi tinggi termasuk MP3 (128kbps, 192kbps, 256kbps, 320kbps Super HQ) dan WAV Lossless (Studio Quality).

### 2.4 Penyimpanan SQLite Lokal
- **Database Native:** Riwayat unduhan disimpan secara persisten di dalam database SQLite lokal (`rusqlite`) yang dibuat secara otomatis di direktori `/Downloads/YibYib_Media/yibyib.db` saat aplikasi pertama kali dijalankan.

---

## 3. Desain Antarmuka (UI/UX Goals)

- **Desain Cosmic Midnight:** Antarmuka visual yang gelap dengan aksen biru neon yang futuristik dan bersih dari ornamen yang tidak perlu (no telemetry clutter).
- **Panel Status Terpadu:** Menampilkan lokasi penyimpanan default dan status konkurensi aktif tepat di atas indikator backend Tauri di area sidebar.
- **Konsol Terminal Logis:** Panel log yang dinamis memperlihatkan riwayat tindakan logis sistem dari sisi Rust untuk kemudahan penelusuran aksi.
