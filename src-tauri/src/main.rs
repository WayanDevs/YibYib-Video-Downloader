// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
use uuid::Uuid;
use chrono::Local;
use rusqlite::{Connection, params};
use tauri::{State, AppHandle, Emitter};
use tokio::sync::mpsc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadItem {
    pub id: String,
    pub url: String,
    pub title: String,
    pub file_type: String,
    pub resolution: String,
    pub progress: u32,
    pub speed: String,
    pub size: String,
    pub status: String,
    pub current_phase: String,
    pub platform: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryItem {
    pub id: String,
    pub url: String,
    pub title: String,
    pub file_type: String,
    pub resolution: String,
    pub size: String,
    pub completed_at: String,
    pub thumbnail: String,
    pub file_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversionJob {
    pub id: String,
    pub title: String,
    pub bitrate: String,
    pub progress: u32,
    pub speed: String,
    pub size: String,
    pub status: String,
    pub source_filename: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemLog {
    pub timestamp: String,
    pub level: String,
    pub message: String,
}

pub struct AppState {
    pub db_conn: Arc<Mutex<Connection>>,
    pub downloads: Arc<Mutex<HashMap<String, DownloadItem>>>,
    pub conversions: Arc<Mutex<HashMap<String, ConversionJob>>>,
    pub logs: Arc<Mutex<Vec<SystemLog>>>,
}

// Helpers
fn init_db() -> Connection {
    let mut path = dirs::download_dir().unwrap_or_else(|| std::env::current_dir().unwrap());
    path.push("YibYib_Media");
    std::fs::create_dir_all(&path).unwrap_or_default();
    path.push("yibyib.db");

    let conn = Connection::open(path).expect("Failed to open SQLite database");
    
    conn.execute(
        "CREATE TABLE IF NOT EXISTS downloads (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            file_type TEXT NOT NULL,
            resolution TEXT NOT NULL,
            progress INTEGER DEFAULT 0,
            speed TEXT,
            size TEXT,
            status TEXT DEFAULT 'queued',
            current_phase TEXT,
            platform TEXT,
            created_at TEXT
        )",
        [],
    ).unwrap();

    conn.execute(
        "CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            file_type TEXT NOT NULL,
            resolution TEXT NOT NULL,
            size TEXT,
            completed_at TEXT,
            thumbnail TEXT,
            file_path TEXT
        )",
        [],
    ).unwrap();

    conn
}

fn add_log(state: &State<AppState>, level: &str, message: &str) {
    let mut logs = state.logs.lock().unwrap();
    let log = SystemLog {
        timestamp: Local::now().format("%H:%M:%S").to_string(),
        level: level.to_string(),
        message: message.to_string(),
    };
    logs.push(log);
    if logs.len() > 200 {
        logs.remove(0);
    }
}

// TAURI COMMANDS
#[tauri::command]
fn get_downloads(state: State<'_, AppState>) -> Result<Vec<DownloadItem>, String> {
    let dls = state.downloads.lock().unwrap();
    Ok(dls.values().cloned().collect())
}

#[tauri::command]
fn add_download(
    app: AppHandle,
    state: State<'_, AppState>,
    url: String,
    file_type: String,
    resolution: String,
) -> Result<DownloadItem, String> {
    let id = Uuid::new_v4().to_string();
    let title = if url.contains("youtube.com") || url.contains("youtu.be") {
        "Youtube Media Download..."
    } else {
        "Proses Analisis Tautan..."
    };

    let item = DownloadItem {
        id: id.clone(),
        url: url.clone(),
        title: title.to_string(),
        file_type: file_type.clone(),
        resolution: resolution.clone(),
        progress: 0,
        speed: "0 KB/s".to_string(),
        size: "Unknown".to_string(),
        status: "downloading".to_string(),
        current_phase: "Menganalisis metadata...".to_string(),
        platform: if url.contains("youtube.com") || url.contains("youtu.be") {
            "youtube"
        } else {
            "direct"
        },
    };

    state.downloads.lock().unwrap().insert(id.clone(), item.clone());
    add_log(&state, "INFO", &format!("Mulai unduhan baru ID: {}, URL: {}", id, url));

    // Spawn async background processing via tokio
    let app_clone = app.clone();
    let state_clone = state.downloads.clone();
    let db_clone = state.db_conn.clone();
    let id_clone = id.clone();
    let url_clone = url.clone();
    let ft_clone = file_type.clone();

    tokio::spawn(async move {
        // Simulasi Download Langkah demi Langkah (Dalam real app diganti dengan Command::new("yt-dlp"))
        let phases = vec![
            ("Menghubungkan ke server...", 10, "1.2 MB/s", "12 MB"),
            ("Mengunduh segmen media...", 35, "3.4 MB/s", "12 MB"),
            ("Melakukan muxing audio-video...", 75, "8.9 MB/s", "12 MB"),
            ("Menyelesaikan file biner...", 95, "1.1 MB/s", "12.4 MB"),
        ];

        for (phase, prog, speed, size) in phases {
            tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;
            if let Some(dl) = state_clone.lock().unwrap().get_mut(&id_clone) {
                dl.current_phase = phase.to_string();
                dl.progress = prog;
                dl.speed = speed.to_string();
                dl.size = size.to_string();
                
                // Emisi event real-time ke frontend Tauri v2
                let _ = app_clone.emit("download-progress", dl.clone());
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

        // Finish Download, pindah ke SQLite history
        let mut final_title = "Video Pembelajaran Keren".to_string();
        if url_clone.contains("youtube") {
            final_title = "YibYib Tutorial Premium YouTube.mp4".to_string();
        } else {
            final_title = "YibYib_Direct_Media.mp4".to_string();
        }

        if let Some(dl) = state_clone.lock().unwrap().get_mut(&id_clone) {
            dl.status = "completed".to_string();
            dl.progress = 100;
            dl.title = final_title.clone();
            dl.current_phase = "Selesai diunduh".to_string();
            let _ = app_clone.emit("download-progress", dl.clone());
        }

        // Simpan ke SQLite history
        let db = db_clone.lock().unwrap();
        let now_str = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let mut path_file = dirs::download_dir().unwrap_or_default();
        path_file.push("YibYib_Media");
        path_file.push(&final_title);

        let _ = db.execute(
            "INSERT INTO history (id, url, title, file_type, resolution, size, completed_at, thumbnail, file_path) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id_clone,
                url_clone,
                final_title,
                ft_clone,
                "1080p",
                "12.4 MB",
                now_str,
                "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=120&auto=format&fit=crop",
                path_file.to_string_lossy().to_string()
            ],
        );

        let _ = app_clone.emit("history-updated", ());
    });

    Ok(item)
}

#[tauri::command]
fn control_download(
    state: State<'_, AppState>,
    id: String,
    action: String,
) -> Result<String, String> {
    let mut dls = state.downloads.lock().unwrap();
    if let Some(dl) = dls.get_mut(&id) {
        match action.as_str() {
            "pause" => {
                dl.status = "paused".to_string();
                dl.current_phase = "Ditangguhkan".to_string();
                add_log(&state, "WARN", &format!("Download {} ditangguhkan", id));
            }
            "resume" => {
                dl.status = "downloading".to_string();
                dl.current_phase = "Melanjutkan...".to_string();
                add_log(&state, "INFO", &format!("Download {} dilanjutkan", id));
            }
            "cancel" => {
                dl.status = "failed".to_string();
                dl.current_phase = "Dibatalkan oleh Pengguna".to_string();
                add_log(&state, "ERROR", &format!("Download {} dibatalkan", id));
            }
            _ => return Err("Aksi tidak valid".to_string()),
        }
        Ok(format!("Aksi {} sukses pada {}", action, id))
    } else {
        Err("Download tidak ditemukan".to_string())
    }
}

#[tauri::command]
fn get_history(state: State<'_, AppState>) -> Result<Vec<HistoryItem>, String> {
    let db = state.db_conn.lock().unwrap();
    let mut stmt = db.prepare("SELECT id, url, title, file_type, resolution, size, completed_at, thumbnail, file_path FROM history ORDER BY completed_at DESC")
        .map_err(|e| e.to_string())?;
    
    let rows = stmt.query_map([], |row| {
        Ok(HistoryItem {
            id: row.get(0)?,
            url: row.get(1)?,
            title: row.get(2)?,
            file_type: row.get(3)?,
            resolution: row.get(4)?,
            size: row.get(5)?,
            completed_at: row.get(6)?,
            thumbnail: row.get(7)?,
            file_path: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        if let Ok(item) = row {
            result.push(item);
        }
    }
    Ok(result)
}

#[tauri::command]
fn clear_history(state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db_conn.lock().unwrap();
    db.execute("DELETE FROM history", []).map_err(|e| e.to_string())?;
    add_log(&state, "INFO", "Seluruh riwayat unduhan telah dibersihkan.");
    Ok("Riwayat berhasil dibersihkan".to_string())
}

#[tauri::command]
fn get_conversions(state: State<'_, AppState>) -> Result<Vec<ConversionJob>, String> {
    let convs = state.conversions.lock().unwrap();
    Ok(convs.values().cloned().collect())
}

#[tauri::command]
fn start_conversion(
    app: AppHandle,
    state: State<'_, AppState>,
    source_filename: String,
    bitrate: String,
) -> Result<ConversionJob, String> {
    let id = Uuid::new_v4().to_string();
    let title = format!("Konversi: {}", source_filename);

    let job = ConversionJob {
        id: id.clone(),
        title: title.clone(),
        bitrate: bitrate.clone(),
        progress: 0,
        speed: "Menunggu...".to_string(),
        size: "Unknown".to_string(),
        status: "converting".to_string(),
        source_filename: source_filename.clone(),
    };

    state.conversions.lock().unwrap().insert(id.clone(), job.clone());
    add_log(&state, "INFO", &format!("Memulai ekstraksi MP3 untuk file: {}", source_filename));

    // Spawn async task for FFmpeg process
    let app_clone = app.clone();
    let convs_clone = state.conversions.clone();
    let id_clone = id.clone();

    tokio::spawn(async move {
        let steps = vec![15, 45, 75, 95, 100];
        for step in steps {
            tokio::time::sleep(tokio::time::Duration::from_millis(800)).await;
            if let Some(c) = convs_clone.lock().unwrap().get_mut(&id_clone) {
                c.progress = step;
                c.speed = "12.5x speed".to_string();
                if step == 100 {
                    c.status = "completed".to_string();
                    c.size = "4.2 MB".to_string();
                }
                let _ = app_clone.emit("conversion-progress", c.clone());
            }
        }
    });

    Ok(job)
}

#[tauri::command]
fn clear_conversions(state: State<'_, AppState>) -> Result<String, String> {
    state.conversions.lock().unwrap().clear();
    add_log(&state, "INFO", "Daftar pekerjaan konversi dibersihkan.");
    Ok("Pekerjaan konversi dibersihkan".to_string())
}

#[tauri::command]
fn get_system_logs(state: State<'_, AppState>) -> Result<Vec<SystemLog>, String> {
    let logs = state.logs.lock().unwrap();
    Ok(logs.clone())
}

fn main() {
    let conn = init_db();
    
    tauri::Builder::default()
        .manage(AppState {
            db_conn: Arc::new(Mutex::new(conn)),
            downloads: Arc::new(Mutex::new(HashMap::new())),
            conversions: Arc::new(Mutex::new(HashMap::new())),
            logs: Arc::new(Mutex::new(Vec::new())),
        })
        .invoke_handler(tauri::generate_handler![
            get_downloads,
            add_download,
            control_download,
            get_history,
            clear_history,
            get_conversions,
            start_conversion,
            clear_conversions,
            get_system_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
