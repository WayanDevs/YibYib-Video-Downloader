# Changelog

Semua perubahan penting pada proyek **YibYib Downloader & Audio Converter** didokumentasikan di file ini sesuai dengan standar [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2.0.0] - 2026-06-26

### Added
- **Tauri v2 Full Rust Backend:** Menggantikan backend Express Node.js dengan kode native Rust di folder `src-tauri` untuk efisiensi performa maksimal.
- **SQLite Native integration:** Menggunakan crate `rusqlite` untuk manajemen database riwayat unduhan secara lokal langsung di folder pengguna `/Downloads/YibYib_Media/yibyib.db`.
- **Concurrency Indicator Widget:** Menampilkan indikator visual status konkurensi (2 Batch Aktif) dan lokasi penyimpanan default di atas widget status Tauri.
- **Tauri Command Bindings:** Membuat perintah backend Rust yang lengkap: `get_downloads`, `add_download`, `control_download`, `get_history`, `clear_history`, `get_conversions`, `start_conversion`, `clear_conversions`, dan `get_system_logs`.
- **Tauri Event Emitters:** Mengaktifkan event real-time `download-progress` dan `conversion-progress` untuk komunikasi data asinkronik dua arah dari Rust ke TypeScript UI.
- **Modular Docs Directory:** Merestrukturisasi semua file panduan sistem (`prd.md`, `design_prd.md`, `layout.md`, `step.md`, dan `changelog.md`) ke dalam satu folder `/docs`.

### Changed
- **Struktur Proyek Desktop Standard:** Menghapus folder backend Node.js lama `/src/backend` untuk memastikan struktur proyek rapi dan sesuai dengan cetak biru Tauri v2.
- **Gitignore Optimization:** Mengonfigurasi berkas `.gitignore` untuk mengecualikan direktori build Rust (`src-tauri/target/`) dan berkas database lokal pendukung lainnya.

---

## [1.0.0] - 2026-06-20

### Added
- **Aesthetic Cosmic Theme UI:** Meluncurkan tampilan antarmuka modern bernuansa hitam abu-abu arang dengan aksen biru neon yang ramah di mata.
- **Advanced Queue Filtering:** Menyediakan sistem filter kategori antrean unduhan (Semua, Mengunduh, Antre, Ditangguhkan, Gagal).
- **Audio Extractors & Converter:** Menambahkan modul konversi media video lokal ke berkas audio beresolusi tinggi (MP3 dan WAV).
- **Log System Terminal:** Menampilkan panel log real-time di UI untuk mempermudah pemantauan aktivitas latar belakang.

---

## [0.1.0] - 2026-06-15

### Added
- **Initial App Prototype:** Rilis draf awal aplikasi pengunduh media berbasis web menggunakan React dan Express.
- **Basic Downloader Core:** Mengintegrasikan engine yt-dlp dasar untuk pengujian parsing tautan video tunggal.
