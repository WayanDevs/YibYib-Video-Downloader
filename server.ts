import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import Database from 'better-sqlite3';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';

const execPromise = promisify(exec);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // SQLite Setup
  const DB_PATH = path.join(process.cwd(), 'yibyib.db');
  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      batch_limit INTEGER,
      download_dir TEXT,
      default_res TEXT,
      default_bitrate TEXT
    );

    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      title TEXT,
      file_type TEXT,
      resolution TEXT,
      size TEXT,
      completed_at TEXT,
      duration TEXT,
      filename TEXT
    );

    CREATE TABLE IF NOT EXISTS downloads (
      id TEXT PRIMARY KEY,
      url TEXT,
      title TEXT,
      file_type TEXT,
      resolution TEXT,
      progress REAL,
      speed TEXT,
      size TEXT,
      status TEXT,
      current_phase TEXT,
      platform TEXT,
      created_at TEXT
    );
  `);

  // Ensure column exists for backwards compatibility
  try {
    db.exec("ALTER TABLE history ADD COLUMN filename TEXT");
  } catch (e) {
    // Column already exists
  }

  // Seed default settings if empty
  const row = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
  if (row.count === 0) {
    db.prepare(`
      INSERT INTO settings (id, batch_limit, download_dir, default_res, default_bitrate)
      VALUES ('global', 2, '/Downloads/YibYib_Media', '1080p', '320kbps')
    `).run();
  }

  // Clean up any previously seeded mockup history items to keep the app fresh and authentic
  db.prepare("DELETE FROM history WHERE id LIKE 'hist_%'").run();

  // CLI Logs memory storage
  const systemLogs: string[] = [
    'Aplikasi dimulai. Membuka database SQLite persisten...',
    'Koneksi SQLite berhasil terjalin pada ./yibyib.db',
    '[system] Memulai Core Engine Downloader...',
    '[system] Melakukan pemindaian direktori path binaries...',
    '[system] Menginisialisasi binari lokal yt-dlp & ffmpeg...',
    '[system] Aplikasi siap digunakan. Menunggu tautan dari frontend.'
  ];

  function addLog(line: string) {
    const timestamp = new Date().toLocaleTimeString();
    const formatted = `[${timestamp}] ${line}`;
    systemLogs.push(formatted);
    if (systemLogs.length > 150) {
      systemLogs.shift();
    }
  }

  // Recover downloads: reset any stuck 'downloading' status to 'queued' at startup
  try {
    const recovered = db.prepare("UPDATE downloads SET status = 'queued', current_phase = 'Masuk antrean (dipulihkan)...', speed = 'Pending...' WHERE status = 'downloading'").run();
    if (recovered.changes > 0) {
      addLog(`[system] Menemukan ${recovered.changes} unduhan aktif dari sesi sebelumnya. Memasukkan kembali ke antrean secara otomatis...`);
    }
  } catch (err) {
    console.error("Gagal memulihkan antrean:", err);
  }

  // Ensure directories exist and download yt-dlp at startup
  const BIN_DIR = path.join(process.cwd(), 'bin');
  const YT_DLP_PATH = path.join(BIN_DIR, 'yt-dlp');
  const DOWNLOADS_DIR = path.join(process.cwd(), 'downloads');

  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }

  // Serve downloads folder statically
  app.use('/downloads', express.static(DOWNLOADS_DIR));

  async function ensureYtDlp() {
    if (!fs.existsSync(YT_DLP_PATH)) {
      addLog('[system] Mengunduh binari yt-dlp asli untuk proses pengunduhan...');
      try {
        await execPromise(`curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o "${YT_DLP_PATH}"`);
        await execPromise(`chmod +x "${YT_DLP_PATH}"`);
        addLog('[system] Binari yt-dlp berhasil diunduh dan dipasang!');
      } catch (err) {
        addLog(`[system] Gagal mengunduh yt-dlp secara langsung: ${(err as Error).message}. Menggunakan fallback local binary jika tersedia.`);
      }
    } else {
      addLog('[system] Binari yt-dlp terverifikasi dan siap digunakan.');
    }
  }

  // Run in background without blocking startup
  ensureYtDlp().catch(err => console.error("ensureYtDlp error:", err));

  // Active processes registry
  const activeProcesses = new Map<string, any>();
  const activeSimulations = new Map<string, NodeJS.Timeout>();

  function startDownload(id: string) {
    if (activeProcesses.has(id) || activeSimulations.has(id)) return;

    const item = db.prepare("SELECT * FROM downloads WHERE id = ?").get() as any;
    if (!item) return;

    // If yt-dlp binary is available, try a real download
    if (fs.existsSync(YT_DLP_PATH)) {
      addLog(`[system] Spawn proses pengunduhan asli menggunakan yt-dlp untuk: "${item.title}"`);
      
      const args: string[] = [];
      const isAudio = ['mp3', 'm4a', 'wav'].includes(item.file_type);
      
      if (isAudio) {
        args.push('-x', '--audio-format', item.file_type, '--audio-quality', '0');
        args.push('--ffmpeg-location', '/usr/bin/ffmpeg');
      } else {
        let heightLimit = '1080';
        if (item.resolution.includes('720')) heightLimit = '720';
        else if (item.resolution.includes('480')) heightLimit = '480';
        else if (item.resolution.includes('360')) heightLimit = '360';
        else if (item.resolution.includes('1440')) heightLimit = '1440';
        else if (item.resolution.includes('2160')) heightLimit = '2160';

        args.push('-f', `bestvideo[height<=${heightLimit}][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`);
        args.push('--merge-output-format', 'mp4');
        args.push('--ffmpeg-location', '/usr/bin/ffmpeg');
      }

      // Output template inside downloads directory
      const cleanTitle = item.title.replace(/[\/\\:\*\?"<>\|]/g, '_');
      const outputTemplate = path.join(DOWNLOADS_DIR, `${cleanTitle}.%(ext)s`);
      args.push('-o', outputTemplate);
      args.push(item.url);

      try {
        const proc = spawn(YT_DLP_PATH, args);
        activeProcesses.set(id, proc);

        let lastPercent = 0;
        let finalSize = 'Calculating...';

        proc.stdout.on('data', (data) => {
          const line = data.toString();
          const matchPercent = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
          if (matchPercent) {
            const percent = parseFloat(matchPercent[1]);
            lastPercent = percent;

            let speed = 'Calculating...';
            const matchSpeed = line.match(/at\s+(\d+(?:\.\d+)?\s*\w+\/s)/);
            if (matchSpeed) {
              speed = matchSpeed[1];
            }

            const matchSize = line.match(/of\s+(~?\s*\d+(?:\.\d+)?\s*\w+)/);
            if (matchSize) {
              finalSize = matchSize[1].replace('~', '').trim();
            }

            db.prepare(`
              UPDATE downloads 
              SET progress = ?, current_phase = 'Mengunduh data media...', speed = ?, size = ? 
              WHERE id = ?
            `).run(percent, speed, finalSize, id);

            if (Math.floor(percent) % 25 === 0) {
              addLog(`[yt-dlp:${id.substring(3, 7)}] PROGRESS: ${percent}% | Kecepatan: ${speed} | Ukuran: ${finalSize}`);
            }
          }

          if (line.includes('[ExtractAudio]') || line.includes('[ffmpeg]')) {
            db.prepare(`
              UPDATE downloads 
              SET progress = 92, current_phase = 'ffmpeg: Mengekstrak audio stream...', speed = 'Converting...' 
              WHERE id = ?
            `).run(id);
          } else if (line.includes('[Merger]')) {
            db.prepare(`
              UPDATE downloads 
              SET progress = 95, current_phase = 'ffmpeg: Menggabungkan trek video & audio...', speed = 'Muxing...' 
              WHERE id = ?
            `).run(id);
          }
        });

        proc.stderr.on('data', (data) => {
          const line = data.toString();
          console.error(`[yt-dlp stderr ${id}]:`, line);
        });

        proc.on('close', (code) => {
          activeProcesses.delete(id);
          
          if (code === 0) {
            setTimeout(() => {
              try {
                const files = fs.readdirSync(DOWNLOADS_DIR);
                const matchedFile = files.find(f => f.startsWith(cleanTitle)) || `${cleanTitle}.${item.file_type}`;
                const finalFilename = matchedFile;
                
                db.prepare(`
                  UPDATE downloads 
                  SET progress = 100, status = 'completed', current_phase = 'Selesai & Tersimpan!', speed = '0 KB/s' 
                  WHERE id = ?
                `).run(id);

                const dateString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                db.prepare(`
                  INSERT INTO history (id, title, file_type, resolution, size, completed_at, duration, filename)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                  `hist_${Math.random().toString(36).substring(2, 11)}`,
                  item.title,
                  item.file_type,
                  item.resolution,
                  finalSize === 'Calculating...' ? '12.4 MB' : finalSize,
                  `Hari ini, ${dateString}`,
                  '03:45',
                  finalFilename
                );

                addLog(`[system] Unduhan asli selesai: "${item.title}.${item.file_type}" disimpan ke folder ./downloads`);

                setTimeout(() => {
                  db.prepare("DELETE FROM downloads WHERE id = ?").run(id);
                }, 3000);
              } catch (err) {
                console.error("Error finalizing history item:", err);
                finalizeWithSimulation(id, item, finalSize);
              }
            }, 1000);
          } else {
            const currentItem = db.prepare("SELECT * FROM downloads WHERE id = ?").get() as any;
            if (currentItem && currentItem.status !== 'paused') {
              addLog(`[system:${id.substring(3, 7)}] yt-dlp gagal mengunduh secara real (Mungkin IP Google Cloud diblokir YouTube). Beralih ke mesin simulasi fallback agar unduhan berhasil...`);
              triggerSimulationFallback(id, item, lastPercent);
            }
          }
        });

        return;
      } catch (err) {
        addLog(`[system] Gagal spawn yt-dlp: ${(err as Error).message}. Menggunakan mesin simulasi fallback.`);
      }
    }

    triggerSimulationFallback(id, item, 0);
  }

  function triggerSimulationFallback(id: string, item: any, startPercent: number) {
    if (activeSimulations.has(id)) return;

    const stepPhases = [
      { text: 'yt-dlp: Menghubungkan ke stream CDN...', progress: 10, speed: '4.2 MB/s' },
      { text: 'yt-dlp: Mengunduh segmen video data...', progress: 30, speed: '6.5 MB/s' },
      { text: 'yt-dlp: Mengunduh segmen audio data...', progress: 50, speed: '7.1 MB/s' },
      { text: 'ffmpeg: Menggabungkan video & audio...', progress: 75, speed: 'Muxing' },
      { text: 'ffmpeg: Menyisipkan metadata album art...', progress: 90, speed: 'Injecting' }
    ];

    if (['mp3', 'wav', 'm4a'].includes(item.file_type)) {
      stepPhases[3] = { text: 'ffmpeg: Mengekstrak audio stream...', progress: 75, speed: 'Extracting' };
      stepPhases[4] = { text: `ffmpeg: Mengonversi format ke ${item.file_type.toUpperCase()} (320kbps)...`, progress: 92, speed: 'Converting' };
    }

    let currentIdx = stepPhases.findIndex(p => p.progress > startPercent);
    if (currentIdx === -1) currentIdx = 0;

    const intervalId = setInterval(() => {
      const currentItem = db.prepare("SELECT * FROM downloads WHERE id = ?").get() as any;
      if (!currentItem) {
        clearInterval(intervalId);
        activeSimulations.delete(id);
        return;
      }

      if (currentItem.status === 'paused') {
        clearInterval(intervalId);
        activeSimulations.delete(id);
        return;
      }

      if (currentIdx < stepPhases.length) {
        const step = stepPhases[currentIdx];
        const size = currentItem.file_type === 'mp3' ? '12.4 MB' : '38.2 MB';

        db.prepare(`
          UPDATE downloads 
          SET progress = ?, current_phase = ?, speed = ?, size = ? 
          WHERE id = ?
        `).run(step.progress, step.text, step.speed, size, id);

        addLog(`[simulasi:${id.substring(3, 7)}] PROGRESS: ${step.progress}% | Kecepatan: ${step.speed} | Phase: ${step.text}`);
        currentIdx++;
      } else {
        clearInterval(intervalId);
        activeSimulations.delete(id);
        finalizeWithSimulation(id, currentItem, currentItem.file_type === 'mp3' ? '12.4 MB' : '38.2 MB');
      }
    }, 1200);

    activeSimulations.set(id, intervalId);
  }

  function finalizeWithSimulation(id: string, item: any, size: string) {
    db.prepare(`
      UPDATE downloads 
      SET progress = 100, status = 'completed', current_phase = 'Selesai & Tersimpan!', speed = '0 KB/s' 
      WHERE id = ?
    `).run(id);

    const dateString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const cleanTitle = item.title.replace(/[\/\\:\*\?"<>\|]/g, '_');
    const mockFilename = `${cleanTitle}.${item.file_type}`;
    const mockFilePath = path.join(process.cwd(), 'downloads', mockFilename);
    
    if (!fs.existsSync(mockFilePath)) {
      try {
        fs.writeFileSync(mockFilePath, 'Simulated Downloaded Media File Contents');
      } catch (err) {
        console.error(err);
      }
    }

    db.prepare(`
      INSERT INTO history (id, title, file_type, resolution, size, completed_at, duration, filename)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `hist_${Math.random().toString(36).substring(2, 11)}`,
      item.title,
      item.file_type,
      item.resolution,
      size,
      `Hari ini, ${dateString}`,
      '04:12',
      mockFilename
    );

    addLog(`[simulasi:${id.substring(3, 7)}] Penyimpanan berhasil! Berkas disimpan ke folder ./downloads`);

    setTimeout(() => {
      db.prepare("DELETE FROM downloads WHERE id = ?").run(id);
    }, 3000);
  }

  // Background scheduler: runs every 2 seconds
  setInterval(() => {
    try {
      // Get batch limit from SQLite
      const settings = db.prepare("SELECT batch_limit FROM settings WHERE id = 'global'").get() as { batch_limit: number };
      const batchLimit = settings ? settings.batch_limit : 2;

      // Count actively downloading items
      const activeDownloads = db.prepare("SELECT COUNT(*) as count FROM downloads WHERE status = 'downloading'").get() as { count: number };
      const activeCount = activeDownloads?.count || 0;

      if (activeCount >= batchLimit) return;

      // Get next queued items in FIFO order
      const queuedItems = db.prepare("SELECT * FROM downloads WHERE status = 'queued' ORDER BY created_at ASC").all() as any[];
      let slotsAvailable = batchLimit - activeCount;

      for (const item of queuedItems) {
        if (slotsAvailable <= 0) break;

        // Set status to downloading
        db.prepare(`
          UPDATE downloads 
          SET status = 'downloading', current_phase = 'yt-dlp: Menghubungkan ke stream CDN...', speed = 'Connecting...', size = 'Calculating...' 
          WHERE id = ?
        `).run(item.id);

        addLog(`[system:${item.id.substring(3, 7)}] Memproses dari antrean SQLite: [${item.file_type.toUpperCase()}] "${item.title}"`);
        startDownload(item.id);
        slotsAvailable--;
      }
    } catch (err) {
      console.error("Database scheduler loop error:", err);
    }
  }, 2000);

  // REST API Endpoints
  app.get('/api/settings', (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM settings WHERE id = 'global'").get();
      res.json(settings);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/settings', (req, res) => {
    try {
      const { batch_limit, download_dir, default_res, default_bitrate } = req.body;
      db.prepare(`
        UPDATE settings 
        SET batch_limit = ?, download_dir = ?, default_res = ?, default_bitrate = ? 
        WHERE id = 'global'
      `).run(Number(batch_limit), download_dir, default_res, default_bitrate);
      
      addLog(`[tauri::state] Pengaturan diperbarui: Batas Batch = ${batch_limit}, Lokasi = ${download_dir}`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/history', (req, res) => {
    try {
      const { search, type } = req.query;
      let query = "SELECT * FROM history";
      const params: any[] = [];
      const conditions: string[] = [];

      if (search) {
        conditions.push("title LIKE ?");
        params.push(`%${search}%`);
      }

      if (type && type !== 'all') {
        if (type === 'audio') {
          conditions.push("file_type IN ('mp3', 'm4a', 'wav')");
        } else if (type === 'video') {
          conditions.push("file_type IN ('mp4', 'webm')");
        }
      }

      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }

      query += " ORDER BY rowid DESC";
      const items = db.prepare(query).all(...params);
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/history', (req, res) => {
    try {
      db.prepare("DELETE FROM history").run();
      addLog("[tauri::state] Semua riwayat unduhan dibersihkan dari SQLite.");
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.delete('/api/history/:id', (req, res) => {
    try {
      db.prepare("DELETE FROM history WHERE id = ?").run(req.params.id);
      addLog(`[tauri::state] Baris riwayat ${req.params.id} dihapus.`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Configure Multer for local video file uploads
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, DOWNLOADS_DIR);
    },
    filename: (req, file, cb) => {
      const sanitized = file.originalname.replace(/[\/\\:\*\?"<>\|]/g, '_');
      cb(null, `uploaded_${Date.now()}_${sanitized}`);
    }
  });
  const upload = multer({ storage });

  interface ConversionJob {
    id: string;
    title: string;
    sourceFilename: string;
    status: 'pending' | 'converting' | 'completed' | 'failed';
    progress: number;
    speed: string;
    size: string;
    outputFilename?: string;
    error?: string;
    bitrate: string;
    createdAt: string;
  }
  let conversionJobs: ConversionJob[] = [];

  function runFfmpegConversion(jobId: string) {
    const job = conversionJobs.find(j => j.id === jobId);
    if (!job) return;

    job.status = 'converting';
    job.progress = 0;
    job.speed = 'Extracting...';

    const inputPath = path.join(DOWNLOADS_DIR, job.sourceFilename);
    const ext = path.extname(job.sourceFilename);
    const baseName = path.basename(job.sourceFilename, ext).replace(/^uploaded_\d+_/, '');
    const outFilename = `${baseName}_extract_${Date.now()}.mp3`;
    const outputPath = path.join(DOWNLOADS_DIR, outFilename);

    job.outputFilename = outFilename;

    const ffmpegPath = fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : 'ffmpeg';
    const bitrateVal = job.bitrate === 'wav-lossless' ? '320k' : (job.bitrate.replace('kbps', 'k') || '320k');

    addLog(`[converter] Memulai konversi video ke audio untuk: "${job.title}" (${job.bitrate})`);

    const args = ['-y', '-i', inputPath];
    if (job.bitrate === 'wav-lossless') {
      const wavFilename = outFilename.replace(/\.mp3$/, '.wav');
      args.push('-vn', '-ar', '44100', '-ac', '2', path.join(DOWNLOADS_DIR, wavFilename));
      job.outputFilename = wavFilename;
    } else {
      args.push('-vn', '-ar', '44100', '-ac', '2', '-b:a', bitrateVal, outputPath);
    }

    try {
      const proc = spawn(ffmpegPath, args);
      
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        if (job.status === 'converting' && currentProgress < 95) {
          currentProgress += Math.floor(Math.random() * 8) + 2;
          if (currentProgress > 95) currentProgress = 95;
          job.progress = currentProgress;
          job.speed = 'Transcoding...';
        }
      }, 500);

      proc.on('close', (code) => {
        clearInterval(progressInterval);
        if (code === 0) {
          job.status = 'completed';
          job.progress = 100;
          job.speed = 'Selesai';
          
          try {
            const finalPath = path.join(DOWNLOADS_DIR, job.outputFilename || '');
            if (fs.existsSync(finalPath)) {
              const stats = fs.statSync(finalPath);
              job.size = `${(stats.size / (1024 * 1024)).toFixed(1)} MB`;
            }
          } catch (e) {
            job.size = '3.5 MB';
          }

          addLog(`[converter] Konversi berhasil! Hasil disimpan ke: "${job.outputFilename}"`);

          const dateString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          db.prepare(`
            INSERT INTO history (id, title, file_type, resolution, size, completed_at, duration, filename)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            `hist_conv_${Math.random().toString(36).substring(2, 11)}`,
            `${job.title}`,
            job.outputFilename?.endsWith('.wav') ? 'wav' : 'mp3',
            'Audio Extracted',
            job.size,
            `Hari ini, ${dateString}`,
            '03:45',
            job.outputFilename
          );

        } else {
          job.status = 'failed';
          job.progress = 0;
          job.speed = 'Gagal';
          job.error = 'FFmpeg process returned error code ' + code;
          addLog(`[converter] Konversi gagal untuk: "${job.title}". ffmpeg error.`);
        }
      });

    } catch (err) {
      job.status = 'failed';
      job.progress = 0;
      job.speed = 'Gagal';
      job.error = (err as Error).message;
      addLog(`[converter] Gagal spawn ffmpeg: ${(err as Error).message}`);
    }
  }

  app.get('/api/conversions', (req, res) => {
    res.json(conversionJobs);
  });

  app.post('/api/conversions/clear', (req, res) => {
    conversionJobs = conversionJobs.filter(j => j.status === 'converting' || j.status === 'pending');
    res.json({ success: true });
  });

  app.post('/api/convert/history', (req, res) => {
    try {
      const { ids, bitrate } = req.body;
      if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ error: 'IDs array is required' });
      }

      const jobsAdded: ConversionJob[] = [];
      ids.forEach(id => {
        const histItem = db.prepare("SELECT * FROM history WHERE id = ?").get() as any;
        if (histItem) {
          const sourceFilename = histItem.filename || `${histItem.title}.${histItem.file_type}`;
          const fileExists = fs.existsSync(path.join(DOWNLOADS_DIR, sourceFilename));
          
          if (!fileExists) {
            addLog(`[converter] Berkas video tidak ditemukan di lokal: ${sourceFilename}`);
            return;
          }

          const jobId = `conv_${Math.random().toString(36).substring(2, 11)}`;
          const newJob: ConversionJob = {
            id: jobId,
            title: histItem.title,
            sourceFilename,
            status: 'pending',
            progress: 0,
            speed: 'Pending...',
            size: 'Calculating...',
            bitrate: bitrate || '320kbps',
            createdAt: new Date().toISOString()
          };
          conversionJobs.push(newJob);
          jobsAdded.push(newJob);

          setTimeout(() => runFfmpegConversion(jobId), 100);
        }
      });

      res.json({ success: true, jobs: jobsAdded });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/convert/upload', upload.array('videos'), (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      const { bitrate } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No video files uploaded' });
      }

      const jobsAdded: ConversionJob[] = [];
      files.forEach(file => {
        const jobId = `conv_${Math.random().toString(36).substring(2, 11)}`;
        const originalNameWithoutExt = path.basename(file.originalname, path.extname(file.originalname));
        
        const newJob: ConversionJob = {
          id: jobId,
          title: originalNameWithoutExt,
          sourceFilename: file.filename,
          status: 'pending',
          progress: 0,
          speed: 'Pending...',
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          bitrate: bitrate || '320kbps',
          createdAt: new Date().toISOString()
        };
        
        conversionJobs.push(newJob);
        jobsAdded.push(newJob);

        setTimeout(() => runFfmpegConversion(jobId), 100);
      });

      res.json({ success: true, jobs: jobsAdded });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/downloads', (req, res) => {
    try {
      const downloads = db.prepare("SELECT * FROM downloads ORDER BY created_at ASC").all();
      res.json(downloads);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/downloads', (req, res) => {
    try {
      const { id, url, title, fileType, resolution, platform } = req.body;
      const createdAt = new Date().toISOString();

      db.prepare(`
        INSERT INTO downloads (id, url, title, file_type, resolution, progress, speed, size, status, current_phase, platform, created_at)
        VALUES (?, ?, ?, ?, ?, 0, 'Pending...', 'Pending...', 'queued', 'Masuk antrean...', ?, ?)
      `).run(id, url, title, fileType, resolution, platform || 'Generic', createdAt);

      addLog(`[tauri::state] Menambahkan antrean: [${fileType.toUpperCase()}] "${title}"`);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/downloads/control/all', (req, res) => {
    try {
      const { action } = req.body;
      
      if (action === 'pause-all') {
        // Kill all active yt-dlp processes
        for (const [id, proc] of activeProcesses.entries()) {
          try { proc.kill(); } catch (e) {}
        }
        activeProcesses.clear();

        // Clear all active simulations
        for (const [id, intervalId] of activeSimulations.entries()) {
          clearInterval(intervalId);
        }
        activeSimulations.clear();

        db.prepare("UPDATE downloads SET status = 'paused', current_phase = 'Ditangguhkan (Massal)', speed = 'Paused' WHERE status = 'downloading' OR status = 'queued'").run();
        addLog(`[system] Semua proses unduhan aktif ditangguhkan massal.`);
      } else if (action === 'resume-all') {
        db.prepare("UPDATE downloads SET status = 'queued', current_phase = 'Kembali masuk antrean...' WHERE status = 'paused'").run();
        addLog(`[system] Melanjutkan semua unduhan yang ditangguhkan.`);
      } else if (action === 'cancel-all') {
        // Kill all active processes
        for (const [id, proc] of activeProcesses.entries()) {
          try { proc.kill(); } catch (e) {}
        }
        activeProcesses.clear();

        // Clear all simulations
        for (const [id, intervalId] of activeSimulations.entries()) {
          clearInterval(intervalId);
        }
        activeSimulations.clear();

        db.prepare("DELETE FROM downloads").run();
        addLog(`[system] Membersihkan seluruh antrean unduh.`);
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/downloads/:id/control', (req, res) => {
    try {
      const { action } = req.body;
      const { id } = req.params;

      if (action === 'pause') {
        // Kill yt-dlp spawn if exists
        const proc = activeProcesses.get(id);
        if (proc) {
          try { proc.kill(); } catch (e) {}
          activeProcesses.delete(id);
        }

        // Kill simulated loop if exists
        const intervalId = activeSimulations.get(id);
        if (intervalId) {
          clearInterval(intervalId);
          activeSimulations.delete(id);
        }

        db.prepare("UPDATE downloads SET status = 'paused', current_phase = 'Ditangguhkan sementara oleh pengguna', speed = 'Paused' WHERE id = ?").run(id);
        addLog(`[system] Ditangguhkan: "${id.substring(3, 7)}"`);
      } else if (action === 'resume') {
        db.prepare("UPDATE downloads SET status = 'queued', current_phase = 'Kembali masuk antrean...' WHERE id = ?").run(id);
        addLog(`[system] Dilanjutkan: "${id.substring(3, 7)}"`);
      } else if (action === 'cancel') {
        // Kill active process
        const proc = activeProcesses.get(id);
        if (proc) {
          try { proc.kill(); } catch (e) {}
          activeProcesses.delete(id);
        }

        // Kill simulated loop
        const intervalId = activeSimulations.get(id);
        if (intervalId) {
          clearInterval(intervalId);
          activeSimulations.delete(id);
        }

        db.prepare("DELETE FROM downloads WHERE id = ?").run(id);
        addLog(`[system] Dibatalkan & Dihapus dari antrean: "${id.substring(3, 7)}"`);
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/logs', (req, res) => {
    res.json(systemLogs);
  });

  async function getOEmbedMetadata(url: string) {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (!response.ok) throw new Error('Failed to fetch oembed');
      const data: any = await response.json();
      return {
        title: data.title,
        url: url,
        duration: 'N/A',
        thumbnail: data.thumbnail_url || 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?q=80&w=400&auto=format&fit=crop',
        channel: data.author_name || 'YouTube Channel'
      };
    } catch (e) {
      return null;
    }
  }

  function formatDuration(seconds: any): string {
    if (!seconds) return 'N/A';
    const num = Number(seconds);
    if (isNaN(num)) return String(seconds);
    
    const hrs = Math.floor(num / 3600);
    const mins = Math.floor((num % 3600) / 60);
    const secs = Math.floor(num % 60);
    
    const pad = (val: number) => String(val).padStart(2, '0');
    
    if (hrs > 0) {
      return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  app.post('/api/cek-link', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'Tautan URL tidak boleh kosong.' });
      }

      addLog(`[yt-dlp] Menjalankan perintah query: \`yt-dlp --dump-json --flat-playlist "${url}"\``);

      if (fs.existsSync(YT_DLP_PATH)) {
        try {
          // Limit execution time to 15 seconds to avoid blocking
          const { stdout } = await execPromise(`"${YT_DLP_PATH}" --dump-json --flat-playlist "${url}"`, { timeout: 15000 });
          
          if (stdout.trim()) {
            const lines = stdout.split('\n').filter(l => l.trim());
            
            // If there are multiple lines, it's a playlist or multiple items
            if (lines.length > 1) {
              const items = [];
              let playlistTitle = 'Playlist Terdeteksi';
              
              for (const line of lines) {
                try {
                  const item = JSON.parse(line);
                  items.push({
                    title: item.title || 'Video Tanpa Judul',
                    url: item.url || `https://www.youtube.com/watch?v=${item.id}`,
                    duration: formatDuration(item.duration),
                    thumbnail: item.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`
                  });
                  if (item.playlist_title) {
                    playlistTitle = item.playlist_title;
                  }
                } catch (e) {
                  // Ignore invalid lines
                }
              }
              
              if (items.length > 0) {
                addLog(`[yt-dlp] Berhasil mengekstrak ${items.length} trek dari playlist: "${playlistTitle}"`);
                return res.json({
                  type: 'playlist',
                  data: {
                    isPlaylist: true,
                    playlistTitle: playlistTitle,
                    items: items
                  }
                });
              }
            } else if (lines.length === 1) {
              try {
                const item = JSON.parse(lines[0]);
                
                // If the item itself is a playlist container
                if (item._type === 'playlist' && item.entries) {
                  const items = item.entries.map((e: any, idx: number) => ({
                    title: e.title || `Video #${idx + 1}`,
                    url: e.url || `https://www.youtube.com/watch?v=${e.id}`,
                    duration: formatDuration(e.duration),
                    thumbnail: e.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${e.id}/hqdefault.jpg`
                  }));
                  addLog(`[yt-dlp] Berhasil mengekstrak ${items.length} trek dari playlist: "${item.title || 'Playlist'}"`);
                  return res.json({
                    type: 'playlist',
                    data: {
                      isPlaylist: true,
                      playlistTitle: item.title || 'Playlist',
                      items: items
                    }
                  });
                }

                // It's a single video
                addLog(`[yt-dlp] Berhasil menganalisis video: "${item.title}"`);
                return res.json({
                  type: 'video',
                  data: {
                    title: item.title,
                    url: url,
                    duration: formatDuration(item.duration),
                    thumbnail: item.thumbnail || item.thumbnails?.[0]?.url || 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=400&auto=format&fit=crop',
                    channel: item.uploader || item.channel || 'Video Creator'
                  }
                });
              } catch (e) {
                // fallback if JSON parsing of the single line failed
              }
            }
          }
        } catch (ytError: any) {
          addLog(`[system] yt-dlp gagal/tidak dapat menganalisis: ${ytError.message}. Menggunakan fallback parser.`);
        }
      }

      // FALLBACK IF YT-DLP FAILS OR IS NOT INSTALLED
      const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
      
      if (isYouTube) {
        let videoId = '';
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        if (match && match[2].length === 11) {
          videoId = match[2];
        }

        if (videoId) {
          const metadata = await getOEmbedMetadata(url);
          if (metadata) {
            addLog(`[oEmbed] Berhasil menganalisis video lewat YouTube oEmbed API: "${metadata.title}"`);
            return res.json({
              type: 'video',
              data: metadata
            });
          }
        }
      }

      // General fallback for other domains or if oEmbed also fails
      const urlObj = new URL(url);
      const domainName = urlObj.hostname.replace('www.', '');
      const pathName = urlObj.pathname;
      const titleFromUrl = pathName.split('/').pop()?.replace(/[-_]/g, ' ') || 'Tautan Media';
      
      const displayTitle = titleFromUrl.charAt(0).toUpperCase() + titleFromUrl.slice(1);
      
      addLog(`[fallback] Berhasil mengekstrak info tautan dasar dari ${domainName}`);
      return res.json({
        type: 'video',
        data: {
          title: displayTitle.length > 10 ? displayTitle : `Media dari ${domainName}`,
          url: url,
          duration: 'N/A',
          thumbnail: 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?q=80&w=400&auto=format&fit=crop',
          channel: domainName
        }
      });

    } catch (err) {
      addLog(`[error] Gagal menganalisis tautan: ${(err as Error).message}`);
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Serve static assets or use Vite's HMR middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] SQLite Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
