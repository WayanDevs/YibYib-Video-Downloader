# Design Requirements Document (Design PRD)

## Tema Desain: Cosmic Midnight (Elegan, Eye-Safe, & Modern)
Dokumen ini menetapkan standar panduan visual dan estetika antarmuka pengguna untuk aplikasi desktop **YibYib Downloader & Audio Converter** berbasis **Tauri v2**.

---

## 1. Skema Warna & Identitas Visual

- **Warna Latar Belakang Utama:** `#020617` (Deep Slate Black) – Memberikan kontras tinggi yang sangat nyaman di mata untuk pemakaian jangka panjang.
- **Warna Kartu/Permukaan:** `#090d16` – Digunakan untuk area fungsional seperti input URL, kartu kemajuan unduhan, dan daftar pustaka.
- **Warna Aksen Teknologi:** `#3b82f6` (Neon Electric Blue) – Merepresentasikan kecepatan unduhan dan kecanggihan engine Rust.
- **Status Sukses:** `#10b981` (Emerald Green) – Menunjukkan tugas yang telah selesai diunduh atau dikonversi dengan sempurna.
- **Status Peringatan/Aksi:** `#f59e0b` (Amber Orange) – Digunakan untuk tindakan tertunda (pause) atau proses transisi enkoding media.

---

## 2. Struktur Tata Letak (Layout Architecture)

Aplikasi ini menggunakan layout dua kolom horizontal (Two-Column Sidebar Layout) untuk menjamin produktivitas maksimum:

1. **Panel Samping Kiri (Fixed Sidebar):**
   - **Brand Identity:** Logo gradasi biru-ke-ungu elegan "YibYib Core".
   - **Informasi Status Utama:** Menampilkan widget info terpadu:
     - **Lokasi Default:** `/Downloads/YibYib_Media`
     - **Konkurensi:** 2 Batch Aktif
     - **Tauri Backend Status:** Indikator konektivitas runtime backend.
   - **Menu Navigasi:** Akses cepat ke tab Unduh, Antrean Aktif, Riwayat Unduhan, Konverter Audio, dan Terminal Logs.

2. **Panel Konten Utama (Fluid Workspace Area):**
   - Area di sisi kanan dengan sistem scroll independen tempat render komponen-komponen visual utama.
   - Menggunakan transisi mikro (`motion`) berdurasi pendek agar perpindahan tab terasa instan namun tetap halus.

---

## 3. Tipografi & Desain Grid

- **Tipografi Utama UI:** Menggunakan keluarga font Sans-serif modern (**Inter**) dengan pelacakan huruf yang proporsional untuk kemudahan keterbacaan menu-menu sistem.
- **Tipografi Teknis (Metrik/Log):** Menggunakan font Monospace (**JetBrains Mono**) untuk angka persentase kemajuan, kecepatan unduh (MB/s), kapasitas berkas (MB), dan baris logs konsol terminal.
- **Sistem Border & Radius:** Sudut membulat yang konsisten menggunakan standard `rounded-2xl` (16px) untuk panel utama dan `rounded-xl` (12px) untuk komponen tombol/input guna memberikan kesan antarmuka modern yang ramah pengguna.
