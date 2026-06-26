# Arsitektur & Layout Desain (Layout Design Architecture)

Dokumen ini menjelaskan struktur visual, tata letak, skema warna, dan tata ruang dari aplikasi desktop **YibYib Downloader & Audio Converter** berbasis **Tauri v2** + **React** + **Tailwind CSS**.

---

## 🎨 Panduan Visual & Tema (Cosmic Midnight Theme)

Aplikasi ini mengadopsi tema **Cosmic Midnight** yang elegan, nyaman di mata (eye-safe), dan modern, dengan perpaduan warna arang gelap (deep slate charcoals) dan aksen biru neon elektrik.

### 🎨 Palet Warna (Color Palette)
* **Warna Latar Utama (Main Background)**: `#020617` (Deep Slate Black)
* **Latar Panel/Kartu (Card/Panel Surface)**: `#090d16` / `#0c1222` dengan efek border halus `#1e293b/40`
* **Warna Aksen Utama (Brand Accent)**: `#3b82f6` (Neon Blue)
* **Kategori Sukses (Success Status)**: `#10b981` (Emerald Green)
* **Kategori Peringatan/Gagal (Warning/Fail)**: `#ef4444` (Rose Red)
* **Teks Primer (Primary Text)**: `#ffffff` (Solid White)
* **Teks Sekunder (Secondary Text)**: `#94a3b8` (Slate Grey)

---

## 📐 Tata Letak & Tata Ruang (Layout & Spacing)

Aplikasi menggunakan layout **Desktop-First Precision** dengan pembagian dua kolom utama (Sidebar + Main Content Area).

### 1. Panel Samping Utama (Left Sidebar Navigation)
Sidebar berada di sisi kiri dengan lebar tetap (`md:w-64`) untuk memastikan semua menu utama dapat diakses dalam satu kali klik.

* **Pojok Atas (Brand Header)**:
  - Logo identitas **YibYib** dengan warna gradien biru elektrik ke ungu.
  - Subtitle deskriptif "Desktop Media Core".
* **Area Informasi Status (State System Widget)**:
  - **Lokasi Default**: Direktori aktif penyimpanan (`/Downloads/YibYib_Media`).
  - **Konkurensi**: Indikator status batch paralel (`2 Batch Aktif`).
  - **Status Engine Tauri**: Deteksi status real-time untuk menjamin konektivitas frontend dengan Rust backend.
* **Menu Navigasi (Nav Links)**:
  - **Beranda (Home)**: Untuk memulai analisis URL dan download media.
  - **Antrean (Queue)**: Mengelola proses download aktif dengan badge total item.
  - **Riwayat (Library)**: Galeri item yang sukses diunduh dengan pemutar media lokal bawaan.
  - **Konverter (Audio Converter)**: Panel ekstraktor audio MP3/WAV.
  - **Logs Terminal**: Konsol pengawasan real-time.

### 2. Area Konten Utama (Main Content View)
Area konten berada di sisi kanan dengan sistem scroll vertikal independen.

* **Top Navigation Bar (Header)**:
  - Tombol toggle sidebar untuk layar berukuran kecil (responsif ponsel).
  - Profil pengguna atau status koneksi cepat di pojok kanan atas.
* **Canvas Area**:
  - Semua modul navigasi (Beranda, Antrean, Riwayat, Konverter, Logs) dirender secara modular menggunakan transisi animasi halus berbasis **Motion** (`framer-motion`) untuk efek fade-in yang elegan.

---

## 📱 Responsivitas (Responsive Adaptability)

Aplikasi ini sepenuhnya responsif dari layar desktop ultra-lebar hingga perangkat tablet dan ponsel pintar:
* **Layar Desktop (`lg` & `xl`)**: Layout sidebar horizontal + konten utama berdampingan secara penuh.
* **Layar Tablet (`md`)**: Margin konten yang merapat secara dinamis.
* **Layar Ponsel (`sm`)**: Sidebar disembunyikan dan diakses via **Hamburger Menu** interaktif. Panel status diposisikan ke bagian bawah layar secara otomatis demi kenyamanan sentuhan jari tangan.

---

## ⚡ Sistem Animasi (Micro-Interactions)
Aplikasi ini menghindari animasi berlebihan dan fokus pada interaksi mikro yang fungsional:
1. **Hover Scale**: Tombol utama dan kartu unduhan memiliki efek transform skala kecil (`scale-102`) dan sorotan border.
2. **Ping States**: Indikator status download aktif menggunakan cincin animasi pulsasi (`animate-ping`) untuk memberikan visualisasi bahwa proses sedang berjalan.
3. **Slide-In Entrances**: Kartu antrean baru dan log terminal menggunakan transisi geser ke atas (`translate-y`) agar terlihat dinamis saat data masuk.
