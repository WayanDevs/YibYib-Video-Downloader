# YibYib Downloader & Audio Converter

A highly-polished full-stack web application designed for downloading media and converting video files into high-quality audio formats (MP3/WAV). Built as a prototype for **YibYib Downloader Tauri v2**, this application combines a modern, responsive React frontend with a high-performance Express & SQLite backend.

---

## 🚀 Fitur Utama (Core Features)

1. **Unduh Media (Media Downloader)**
   - Mendukung pengunduhan media dari URL video dengan pilihan resolusi dan tipe berkas (Video/Audio).
   - Fitur analisis metadata menggunakan `yt-dlp` di sisi server.

2. **Manajemen Antrean Canggih (Advanced Queue Management)**
   - Pemantauan progres unduhan secara real-time.
   - **Filter status antrean**: Semua, Mengunduh, Antre, Ditangguhkan, dan Gagal.
   - **Pengurutan (Sorting)**: Berdasarkan waktu ditambahkan (terbaru), abjad judul (A-Z), atau kemajuan terbesar.
   - **Aksi Massal (Bulk Actions)**: Pilih beberapa item sekaligus untuk ditangguhkan (pause), dilanjutkan (resume), atau dihapus (cancel) secara bersamaan.

3. **Konverter Video ke Audio (Audio Converter)**
   - **Dari Riwayat Unduhan**: Pilih video yang sudah selesai diunduh di perpustakaan lokal Anda dan konversikan langsung ke audio.
   - **Unggah Berkas Mandiri (Local Uploads)**: Fitur drag-and-drop atau pemilih berkas video lokal untuk dikonversi secara instan.
   - **Pilihan Kualitas Audio**: MP3 (128kbps, 192kbps, 256kbps, 320kbps Super HQ) atau WAV Lossless (Studio Quality).
   - Menggunakan pemrosesan paralel berdaya tinggi dengan `FFmpeg` di sisi server.

4. **Riwayat Unduhan (Download Library)**
   - Penyimpanan data terdistribusi dan persisten menggunakan database relasional lokal **SQLite** (`better-sqlite3`).
   - Tampilan daftar riwayat yang bersih dengan pemutar media lokal terintegrasi.

5. **CLI Terminal Logs**
   - Panel log interaktif yang menampilkan aktivitas backend secara real-time untuk kemudahan debugging.

---

## ⚙️ Teknologi yang Digunakan (Tech Stack)

* **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons, Motion (framer-motion)
* **Backend**: Node.js, Express, Multer (untuk upload file)
* **Database**: SQLite (`better-sqlite3`)
* **Core Processing**: FFmpeg & yt-dlp (untuk transcoding dan download)
* **Build Tooling**: Esbuild & TypeScript

---

## 🛠️ Cara Menjalankan Aplikasi (Local Setup)

### Prasyarat (Prerequisites)
Pastikan Anda sudah menginstal **FFmpeg** dan **yt-dlp** di sistem Anda agar fungsi pengunduhan dan konversi berjalan dengan lancar.

### Langkah-Langkah

1. **Instalasi Dependensi**
   ```bash
   pnpm install
   ```

2. **Menjalankan Mode Pengembangan (Development)**
   ```bash
   pnpm dev
   ```
   Aplikasi akan berjalan di `http://localhost:3000`.

3. **Melakukan Build Produksi**
   ```bash
   pnpm build
   ```
   Perintah ini akan melakukan kompilasi file frontend via Vite ke folder `dist/` sekaligus membundel server Express ke `dist/server.cjs` menggunakan Esbuild.

4. **Menjalankan Build Produksi**
   ```bash
   pnpm start
   ```

---

## 🦀 Integrasi Dengan Tauri (Tauri Build Guide)

### Apakah bisa langsung di-build dengan `pnpm tauri build`?

**Secara singkat: Tidak bisa langsung jadi (out-of-the-box)** jika struktur proyek masih menggunakan server backend Node.js (Express + SQLite).

#### 🔍 Penjelasan Teknis:
Tauri dirancang untuk membundel aplikasi **Client-Side (Single Page Application)**. Pada proyek ini, Anda memiliki arsitektur full-stack:
* **Frontend** (React + Vite)
* **Backend** (Express + SQLite + Spawn FFmpeg/yt-dlp + Multer)

Jika Anda langsung menjalankan `pnpm tauri build`, Tauri hanya akan mengemas file statis frontend dari folder `dist/index.html`. Aplikasi di dalam desktop akan terbuka, tetapi **semua fungsi API (`/api/*`) seperti download, database, dan konversi akan gagal/error** karena server Express tidak berjalan di dalam bundle Tauri.

---

### 💡 Cara Mengadaptasikan Proyek Ini ke Tauri v2

Untuk menjadikan aplikasi ini berjalan sepenuhnya sebagai aplikasi desktop native menggunakan Tauri, Anda memiliki 2 opsi arsitektur:

#### Opsi A: Porting Backend ke Rust (Sangat Direkomendasikan ⭐)
Cara terbaik dan paling standar dalam menggunakan Tauri adalah memindahkan seluruh logika Express ke dalam backend Rust (menggunakan Tauri Commands).

1. **Database SQLite**: Ganti `better-sqlite3` dengan plugin native Tauri **Tauri Plugin SQL** (menggunakan driver SQLite) atau crate Rust seperti `rusqlite`/`sqlx`.
2. **Proses FFmpeg & yt-dlp**: Gunakan **Tauri Plugin Shell** atau `tokio::process::Command` di Rust untuk melakukan spawn proses CLI ffmpeg dan yt-dlp langsung dari komputer pengguna secara aman.
3. **Upload File**: Karena aplikasi berjalan secara lokal di komputer user, Anda tidak memerlukan `multer` lagi! Pengguna bisa langsung memilih file dari sistem lokal menggunakan **Tauri Plugin Dialog** dan Rust bisa membaca path file tersebut secara instan.
4. **Komunikasi**: Ganti `fetch('/api/...')` di React dengan pemanggilan Tauri API:
   ```typescript
   import { invoke } from '@tauri-apps/api/core';
   
   // Contoh memanggil fungsi konversi di Rust
   await invoke('start_conversion', { filePath: selectedPath, quality: '320kbps' });
   ```

#### Opsi B: Menggunakan Node.js Sidecar (Alternatif Cepat)
Jika Anda ingin mempertahankan kode Node.js Express Anda apa adanya tanpa menulis ulang ke Rust, Anda bisa menggunakan fitur **Sidecar** di Tauri.

1. Bundel server Express Anda menjadi file executable biner tunggal (misal menggunakan tool seperti `pkg` atau membundel Node.js runtime).
2. Konfigurasikan Tauri di `src-tauri/tauri.conf.json` untuk menjalankan biner Express tersebut sebagai **Sidecar** (proses latar belakang otomatis) ketika aplikasi desktop dibuka.
3. Di frontend React, ubah URL base API untuk menembak ke port sidecar lokal tersebut (misal `http://localhost:3000/api/...`).

---

## 📝 Catatan Penting
Aplikasi ini dikembangkan dengan fokus tinggi pada kegunaan (usability), desain antarmuka yang modern, dan performa tinggi. Selamat mengembangkan!
