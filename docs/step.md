# Panduan Migrasi & Build Aplikasi ke Tauri v2 (Rust Backend)

File ini menjelaskan langkah-langkah detail, konfigurasi, dan persiapan lingkungan untuk mem-build aplikasi **YibYib Downloader & Audio Converter** ke dalam paket aplikasi desktop biner (Windows `.exe`, macOS `.app`/`.dmg`, Linux `.deb`) menggunakan **Tauri v2** dengan backend berbasis bahasa pemrograman **Rust**.

---

## 📂 Struktur Folder Baru (Tauri v2 Standard)

Struktur proyek Anda telah diadaptasi ke standar Tauri v2:

```bash
├── package.json               # Dependensi Node.js / pnpm (Frontend)
├── vite.config.ts             # Konfigurasi bundler Vite
├── index.html                 # Entry point HTML UI
├── src/                       # KODE FRONTEND (React, Tailwind CSS, Lucide Icons)
│   ├── main.ts                # Logika utama UI, render state, event listeners
│   └── index.css              # Style Tailwind CSS v4
│
└── src-tauri/                 # KODE BACKEND DESKTOP (Full Rust!)
    ├── Cargo.toml             # Manifest dependensi Rust & metadata Tauri
    ├── build.rs               # Script build kompilasi Tauri
    ├── tauri.conf.json        # Pengaturan ukuran window, bundle, dan build Tauri
    ├── capabilities/
    │   └── default.json       # Manajemen hak akses / permissions (Tauri v2)
    └── src/
        └── main.rs            # Kode backend utama Rust (SQLite, spawn ffmpeg/yt-dlp)
```

---

## ⚙️ Langkah 1: Persiapan Lingkungan (Prerequisites Setup)

Sebelum menjalankan perintah build, pastikan komputer Anda telah memiliki perkakas pengembangan berikut:

### 1. Sistem Operasi Windows
* Install **Build Tools for Visual Studio 2022** (pilih beban kerja "C++ build tools").
* Install **Rust** via [rustup.rs](https://rustup.rs/).
* Pastikan **Node.js** (v18+) dan **pnpm** sudah terpasap.

### 2. macOS
* Install **Xcode Command Line Tools** dengan menjalankan:
  ```bash
  xcode-select --install
  ```
* Install **Rust** via [rustup.rs](https://rustup.rs/).

### 3. Linux (Ubuntu/Debian)
Install library sistem yang dibutuhkan:
```bash
sudo apt update
sudo apt install -y build-essential curl wget libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

---

## 🛠️ Langkah 2: Cara Integrasi Frontend (JS/TS) dengan Rust Backend

Pada aplikasi web biasa, frontend memanggil REST API menggunakan `fetch('/api/downloads')`. Pada Tauri, Anda harus menggantinya dengan menggunakan fungsi **`invoke`** dari `@tauri-apps/api/core` atau mendengarkan event real-time menggunakan **`listen`** dari `@tauri-apps/api/event`.

### 1. Hubungkan Peta Pemanggilan di Frontend (`src/main.ts`):
Pasang pustaka Tauri API di sisi frontend Anda:
```bash
pnpm add @tauri-apps/api
```

### 2. Contoh Pengambilan Riwayat dari Rust SQLite:
```typescript
import { invoke } from '@tauri-apps/api/core';

// Contoh memanggil Rust Command
async function loadHistoryFromTauri() {
  try {
    const historyList = await invoke('get_history');
    console.log("Riwayat dari Rust SQLite:", historyList);
    // Render ke UI
  } catch (err) {
    console.error("Gagal memuat:", err);
  }
}
```

### 3. Contoh Mendengarkan Progress Unduhan secara Real-time:
```typescript
import { listen } from '@tauri-apps/api/event';

// Dengarkan progress unduhan yang di-emit langsung oleh Rust di latar belakang
listen('download-progress', (event) => {
  const payload = event.payload; // Berisi objek DownloadItem terupdate
  updateSingleCardProgress(payload);
});
```

---

## 📦 Langkah 3: Melakukan Build Aplikasi (`pnpm tauri build`)

Setelah mengintegrasikan frontend, Anda siap melakukan kompilasi penuh menjadi aplikasi desktop native:

1. **Instalasi CLI Tauri v2**:
   Pastikan paket CLI Tauri terinstal sebagai devDependencies:
   ```bash
   pnpm add -D @tauri-apps/cli@latest
   ```

2. **Jalankan Uji Coba Mode Dev**:
   Untuk memastikan window desktop terbuka dan berjalan sempurna:
   ```bash
   pnpm tauri dev
   ```

3. **Lakukan Kompilasi Rilis Final**:
   Jalankan perintah berikut untuk mengompilasi kode Rust dan mem-bundel UI React ke dalam satu file installer desktop:
   ```bash
   pnpm tauri build
   ```

4. **Hasil Output File Installer**:
   Setelah proses kompilasi selesai, file installer dapat ditemukan di folder:
   * **Windows**: `src-tauri/target/release/bundle/msi/` atau `.exe`
   * **macOS**: `src-tauri/target/release/bundle/dmg/` atau `.app`
   * **Linux**: `src-tauri/target/release/bundle/deb/`

---

## 💡 Mengapa Menggunakan Rust pada Tauri v2 Lebih Unggul?

1. **Kecepatan & Performa**: Rust mengonsumsi memori (RAM) sangat minim (~20-40 MB) dibandingkan Electron (~150-300 MB).
2. **Keamanan Maksimal**: File executable terkompilasi aman dan tidak mengekspos source code server JavaScript Anda.
3. **Instalasi Mudah**: File database SQLite terintegrasi langsung di direktori sistem pengguna secara otomatis melalui library `rusqlite`.
4. **Ukuran File Sangat Kecil**: Installer hasil build Tauri hanya berukuran sekitar 5MB - 15MB karena menggunakan engine WebView bawaan sistem operasi.
