# YibYib Downloader & Audio Converter

A highly-polished desktop application designed for downloading media and converting video files into high-quality audio formats (MP3/WAV). This project is fully configured and ready for **Tauri v2**, combining a modern, responsive HTML5/TypeScript frontend with a high-performance **Rust Backend** and local SQLite database engine.

---

## 🚀 Fitur Utama (Core Features)

1. **Unduh Media (Media Downloader)**
   - Mendukung pengunduhan media dari URL video dengan pilihan resolusi dan tipe berkas (Video/Audio).
   - Backend Rust terintegrasi penuh untuk mengeksekusi proses pengunduhan media secara efisien.

2. **Manajemen Antrean Canggih & Konkurensi**
   - Pemantauan progres unduhan secara real-time melalui sistem Tauri Event Emitter.
   - **Batas Pemrosesan Paralel (Concurrency)**: Mengaktifkan pemrosesan bersamaan (default: 2 Batch Aktif) secara aman di level Rust threading (`tokio`).
   - Otomatis melanjutkan baris antrean berikutnya saat slot batch tersedia.

3. **Konverter Video ke Audio (Audio Converter)**
   - Ekstraksi audio dari video riwayat unduhan atau berkas lokal langsung ke format MP3 (128kbps, 192kbps, 256kbps, 320kbps Super HQ) atau WAV Lossless (Studio Quality).
   - Pengolahan backend asinkronik berdaya tinggi yang aman dan cepat.

4. **Database Persisten SQLite Terintegrasi**
   - Menggunakan database relasional SQLite secara native (`rusqlite`) di backend Rust untuk menyimpan riwayat unduhan secara instan di direktori pengguna (`/Downloads/YibYib_Media`).

5. **Terminal Logs Real-Time**
   - Menyediakan panel pemantauan log logis langsung dari kernel Rust untuk melacak aktivitas operasional backend.

---

## 📂 Struktur Proyek (Tauri v2 Standard Directory)

Aplikasi ini menggunakan struktur modern yang memisahkan frontend (Vite + TS) dengan backend native (Rust):

```bash
├── package.json               # Dependensi Node.js (Frontend compiler)
├── vite.config.ts             # Konfigurasi bundling Vite
├── index.html                 # Halaman utama UI
├── docs/                      # DOKUMENTASI SISTEM (PRD, Layout, Langkah-langkah, dll.)
│   ├── prd.md                 # Product Requirements Document
│   ├── design_prd.md          # Panduan Estetika & Visual
│   ├── layout.md              # Detail Arsitektur Tata Letak
│   ├── step.md                # Tahapan Lengkap Build & Kompilasi
│   └── changelog.md           # Riwayat Perubahan Versi
├── src/                       # KODE FRONTEND (HTML5, Tailwind CSS, TS, Lucide)
│   ├── main.ts                # Logika utama interface & Tauri bridge
│   ├── index.css              # Styling terpusat Tailwind CSS v4
│   └── components/            # Komponen-komponen visual modular
└── src-tauri/                 # KODE BACKEND DESKTOP (Full Rust Backend!)
    ├── Cargo.toml             # Manifest dependensi & metadata Rust
    ├── build.rs               # Kompilator build otomatis Tauri
    ├── tauri.conf.json        # Konfigurasi window, bundle, dan modul Tauri v2
    ├── capabilities/          # Manajemen izin keamanan aplikasi desktop
    └── src/
        └── main.rs            # Entry point Rust (Database, Commands, Events)
```

---

## 🛠️ Cara Menjalankan Aplikasi di Mode Pengembangan

### 1. Prasyarat Lingkungan (Prerequisites)
Pastikan Anda memiliki:
- **Node.js** (v18+) & **pnpm**
- **Rust Compiler** via [rustup.rs](https://rustup.rs/)
- Build tools sistem sesuai sistem operasi Anda (C++ Build Tools untuk Windows, Xcode CLI untuk macOS, atau build-essential/libgtk untuk Linux).

### 2. Jalankan Mode Web (Local Server)
Untuk menguji coba tampilan antarmuka web secara interaktif:
```bash
pnpm install
pnpm dev
```
Aplikasi web berjalan di port `3000`.

### 3. Jalankan Mode Desktop (Tauri Dev)
Untuk menjalankan aplikasi dalam bentuk window desktop native dengan hot reload backend & frontend:
```bash
pnpm tauri dev
```

---

## 📦 Kompilasi Desktop Final (`pnpm tauri build`)

Untuk mem-build installer desktop mandiri (executable biner) tanpa server node di latar belakang:
```bash
pnpm tauri build
```
File installer biner (`.exe`, `.dmg`, `.deb`, atau `.msi`) akan dihasilkan secara otomatis di dalam folder `src-tauri/target/release/bundle/`.

Untuk panduan langkah demi langkah yang lebih detail mengenai integrasi kode frontend dengan Rust commands, silakan baca dokumentasi di **`/docs/step.md`**.
