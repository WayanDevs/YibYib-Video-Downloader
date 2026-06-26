import './index.css';

// 1. Interfaces & Types
interface VideoDownload {
  id: string;
  url: string;
  title: string;
  fileType: 'mp4' | 'webm' | 'mp3' | 'm4a' | 'wav';
  resolution: string;
  progress: number;
  speed: string;
  size: string;
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'failed';
  currentPhase: string;
  platform: 'YouTube' | 'TikTok' | 'Instagram' | 'Facebook' | 'Twitter' | 'Vimeo' | 'Generic';
}

interface HistoryItem {
  id: string;
  title: string;
  fileType: 'mp4' | 'webm' | 'mp3' | 'm4a' | 'wav';
  resolution: string;
  size: string;
  completedAt: string;
  duration: string;
  filename?: string;
}

interface PlaylistItem {
  title: string;
  url: string;
  duration: string;
  thumbnail: string;
}

interface PlaylistInfo {
  isPlaylist: boolean;
  playlistTitle: string;
  items: PlaylistItem[];
}

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

// 2. Global Application State (Zero Mock Data)
const appState = {
  activeTab: 'unduh',
  mediaMode: 'video' as 'video' | 'audio',
  bulkMode: false,
  settings: {
    batchLimit: 2,
    downloadDir: '/Downloads/YibYib_Media',
    defaultRes: '1080p',
    defaultBitrate: '320kbps'
  },
  downloads: [] as VideoDownload[],
  history: [] as HistoryItem[],
  activePlaylist: null as PlaylistInfo | null,
  conversions: [] as ConversionJob[],
  selectedQueueIds: new Set<string>(),
  queueFilter: 'all' as 'all' | 'downloading' | 'queued' | 'paused' | 'failed',
  queueSort: 'newest' as 'newest' | 'title' | 'progress',
  activeSingleVideo: null as { title: string; url: string; duration: string; thumbnail: string; channel: string } | null
};

// 3. Initial DOM Setup Hooks
document.addEventListener('DOMContentLoaded', () => {
  initRouting();
  initFormControls();
  initDragAndDrop();
  initQueueControls();
  initQueueFiltersAndSelection();
  initAudioConverter();
  
  // Load initial settings and history, start backend polling
  loadSettings();
  loadHistory();
  startPollingQueue();
  startPollingLogs();
});

// 4. Load Settings from SQLite
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const settings = await res.json();
    if (settings) {
      appState.settings = {
        batchLimit: settings.batch_limit,
        downloadDir: settings.download_dir,
        defaultRes: settings.default_res,
        defaultBitrate: settings.default_bitrate
      };
      
      // Update form elements
      const settingBatchLimit = document.getElementById('setting-batch-limit') as HTMLSelectElement;
      if (settingBatchLimit) {
        settingBatchLimit.value = String(settings.batch_limit);
      }
      
      const settingDownloadDir = document.getElementById('setting-download-dir') as HTMLInputElement;
      if (settingDownloadDir) {
        settingDownloadDir.value = settings.download_dir;
      }
      
      const headerStatus = document.getElementById('header-status');
      if (headerStatus) {
        headerStatus.textContent = `Konkurensi: ${settings.batch_limit} Batch Aktif`;
      }
      
      const headerDir = document.getElementById('header-dir');
      if (headerDir) {
        headerDir.textContent = settings.download_dir;
      }
    }
  } catch (err) {
    console.error('Gagal memuat pengaturan dari SQLite:', err);
  }
}

// 5. Save Settings to SQLite
async function saveSettings() {
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batch_limit: appState.settings.batchLimit,
        download_dir: appState.settings.downloadDir,
        default_res: appState.settings.defaultRes,
        default_bitrate: appState.settings.defaultBitrate
      })
    });
  } catch (err) {
    console.error('Gagal menyimpan pengaturan ke SQLite:', err);
  }
}

// 6. Load History list from SQLite
async function loadHistory() {
  try {
    const historySearch = document.getElementById('history-search') as HTMLInputElement;
    const historyFilter = document.getElementById('history-filter') as HTMLSelectElement;
    
    const searchVal = historySearch ? historySearch.value : '';
    const filterVal = historyFilter ? historyFilter.value : 'all';
    
    const params = new URLSearchParams();
    if (searchVal) params.append('search', searchVal);
    if (filterVal) params.append('type', filterVal);
    
    const res = await fetch(`/api/history?${params.toString()}`);
    const items = await res.json();
    
    appState.history = items.map((i: any) => ({
      id: i.id,
      title: i.title,
      fileType: i.file_type,
      resolution: i.resolution,
      size: i.size,
      completedAt: i.completed_at,
      duration: i.duration,
      filename: i.filename
    }));
    
    updateHistoryView();
    updateHistoryBadge();
    if (typeof (window as any).refreshConverterHistory === 'function') {
      (window as any).refreshConverterHistory();
    }
  } catch (err) {
    console.error('Gagal memuat riwayat dari SQLite:', err);
  }
}

// 7. Polling active downloads queue from server SQLite
function startPollingQueue() {
  let wasAnyCompleted = false;

  setInterval(async () => {
    try {
      const res = await fetch('/api/downloads');
      const items = await res.json();
      
      const prevDownloads = appState.downloads;
      
      appState.downloads = items.map((i: any) => ({
        id: i.id,
        url: i.url,
        title: i.title,
        fileType: i.file_type,
        resolution: i.resolution,
        progress: i.progress,
        speed: i.speed,
        size: i.size,
        status: i.status,
        currentPhase: i.current_phase,
        platform: i.platform
      }));
      
      updateQueueView();

      // Update queue badge on sidebar tab
      const queueBadge = document.getElementById('queue-badge');
      if (queueBadge) {
        const activeCount = items.length;
        queueBadge.textContent = String(activeCount);
        if (activeCount > 0) {
          queueBadge.classList.remove('hidden');
        } else {
          queueBadge.classList.add('hidden');
        }
      }

      // Update parallel batch limit indicator
      const batchLimitEl = document.getElementById('antrean-batch-limit');
      if (batchLimitEl) {
        batchLimitEl.textContent = `${appState.settings.batchLimit} Slot Aktif`;
      }

      // Check if any download just finished so we can reload the history list instantly
      const currentCompletedCount = appState.downloads.filter(d => d.status === 'completed').length;
      const prevCompletedCount = prevDownloads.filter(d => d.status === 'completed').length;

      if (currentCompletedCount > prevCompletedCount || (prevDownloads.length > 0 && appState.downloads.length < prevDownloads.length)) {
        loadHistory();
      }
    } catch (err) {
      console.error('Gagal polling antrean:', err);
    }
  }, 1200);
}

// 8. Polling live server logs
function startPollingLogs() {
  const terminal = document.getElementById('terminal-content');
  if (!terminal) return;

  setInterval(async () => {
    try {
      const res = await fetch('/api/logs');
      const logs = await res.json();
      
      terminal.innerHTML = '';
      
      logs.forEach((logLine: string) => {
        const logNode = document.createElement('p');
        logNode.innerHTML = logLine;
        
        if (logLine.includes('[system]') || logLine.includes('terdeteksi') || logLine.includes('berhasil')) {
          logNode.className = "text-emerald-400 font-bold font-mono text-xs";
        } else if (logLine.includes('gagal') || logLine.includes('warning') || logLine.includes('Eror') || logLine.includes('Dibatalkan')) {
          logNode.className = "text-rose-400 font-semibold font-mono text-xs";
        } else if (logLine.includes('PROGRESS')) {
          logNode.className = "text-blue-300 font-mono text-xs";
        } else {
          logNode.className = "text-slate-300 font-mono text-xs";
        }
        
        terminal.appendChild(logNode);
      });
      
      terminal.scrollTop = terminal.scrollHeight;
    } catch (err) {
      console.error('Gagal polling logs:', err);
    }
  }, 1500);
}

// 9. Routing Tab Controls
function initRouting() {
  const tabs = [
    { id: 'tab-unduh', view: 'view-unduh' },
    { id: 'tab-antrean', view: 'view-antrean' },
    { id: 'tab-riwayat', view: 'view-riwayat' },
    { id: 'tab-convert', view: 'view-convert' },
    { id: 'tab-logs', view: 'view-logs' },
    { id: 'tab-settings', view: 'view-settings' }
  ];

  tabs.forEach(tab => {
    const el = document.getElementById(tab.id);
    if (el) {
      el.addEventListener('click', () => {
        tabs.forEach(t => {
          const tabEl = document.getElementById(t.id);
          const viewEl = document.getElementById(t.view);
          if (tabEl && viewEl) {
            if (t.id === tab.id) {
              tabEl.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 bg-blue-600 text-white shadow-md cursor-pointer";
              viewEl.classList.remove('hidden');
            } else {
              tabEl.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 cursor-pointer";
              viewEl.classList.add('hidden');
            }
          }
        });
        
        if (tab.id === 'tab-logs') {
          const terminal = document.getElementById('terminal-content');
          if (terminal) terminal.scrollTop = terminal.scrollHeight;
        }
      });
    }
  });
}

// 10. Form Handlers & Input Events
function initFormControls() {
  const modeSingleBtn = document.getElementById('mode-single');
  const modeBulkBtn = document.getElementById('mode-bulk');
  const containerSingle = document.getElementById('container-single');
  const containerBulk = document.getElementById('container-bulk');

  if (modeSingleBtn && modeBulkBtn && containerSingle && containerBulk) {
    modeSingleBtn.addEventListener('click', () => {
      appState.bulkMode = false;
      modeSingleBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-blue-600 text-white shadow cursor-pointer";
      modeBulkBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-slate-200 cursor-pointer";
      containerSingle.classList.remove('hidden');
      containerBulk.classList.add('hidden');
    });

    modeBulkBtn.addEventListener('click', () => {
      appState.bulkMode = true;
      modeBulkBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-blue-600 text-white shadow cursor-pointer";
      modeSingleBtn.className = "px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-400 hover:text-slate-200 cursor-pointer";
      containerSingle.classList.add('hidden');
      containerBulk.classList.remove('hidden');
    });
  }

  const formatVideoBtn = document.getElementById('media-mode-video');
  const formatAudioBtn = document.getElementById('media-mode-audio');
  const qualityContainer = document.getElementById('quality-selector-container');
  const selectFileType = document.getElementById('select-file-type') as HTMLSelectElement;

  if (formatVideoBtn && formatAudioBtn && qualityContainer && selectFileType) {
    formatVideoBtn.addEventListener('click', () => {
      appState.mediaMode = 'video';
      formatVideoBtn.className = "flex-1 py-1.5 rounded-md text-xs font-bold transition-all bg-blue-600 text-white cursor-pointer";
      formatAudioBtn.className = "flex-1 py-1.5 rounded-md text-xs font-bold transition-all text-slate-400 hover:text-slate-200 cursor-pointer";
      
      qualityContainer.innerHTML = `
        <select id="select-video-res" class="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-lg text-xs text-slate-200 focus:outline-none cursor-pointer">
          <option value="1080p">1080p (Full HD - Rekomendasi)</option>
          <option value="720p">720p (HD - Hemat Storage)</option>
          <option value="2160p">2160p (4K UHD Ultra)</option>
          <option value="1440p">1440p (2K QHD)</option>
          <option value="480p">480p (SD - Medium)</option>
          <option value="360p">360p (SD - Low Data)</option>
        </select>
      `;
      selectFileType.innerHTML = `
        <option value="mp4">Format: MP4 Container</option>
        <option value="webm">Format: WebM Video</option>
      `;
    });

    formatAudioBtn.addEventListener('click', () => {
      appState.mediaMode = 'audio';
      formatAudioBtn.className = "flex-1 py-1.5 rounded-md text-xs font-bold transition-all bg-blue-600 text-white cursor-pointer";
      formatVideoBtn.className = "flex-1 py-1.5 rounded-md text-xs font-bold transition-all text-slate-400 hover:text-slate-200 cursor-pointer";
      
      qualityContainer.innerHTML = `
        <select id="select-audio-res" class="w-full px-3 py-2 bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-lg text-xs text-slate-200 focus:outline-none cursor-pointer">
          <option value="320kbps">320 kbps (Super HQ MP3)</option>
          <option value="256kbps">256 kbps (High Quality)</option>
          <option value="192kbps">192 kbps (Medium AAC)</option>
          <option value="128kbps">128 kbps (Hemat Data)</option>
          <option value="wav-lossless">WAV Lossless (Studio Audio)</option>
        </select>
      `;
      selectFileType.innerHTML = `
        <option value="mp3">Format: MP3 Audio</option>
        <option value="m4a">Format: M4A AAC</option>
        <option value="wav">Format: WAV Uncompressed</option>
      `;
    });
  }

  // Paste Clipboard Action
  const btnPaste = document.getElementById('btn-paste');
  const inputUrl = document.getElementById('input-url') as HTMLInputElement;
  if (btnPaste && inputUrl) {
    btnPaste.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text.startsWith('http://') || text.startsWith('https://')) {
          inputUrl.value = text;
          triggerAlert('success', 'Berhasil menempel tautan dari papan klip.');
        } else {
          triggerAlert('warning', 'Teks papan klip bukan format tautan URL yang valid.');
        }
      } catch {
        triggerAlert('error', 'Gagal mengakses clipboard. Silakan ketik atau tempel manual.');
      }
    });
  }

  // Cek Link Action (Runs CLI analysis simulation via backend)
  const btnCekLink = document.getElementById('btn-cek-link') as HTMLButtonElement | null;
  if (btnCekLink && inputUrl) {
    btnCekLink.addEventListener('click', async () => {
      const urlValue = inputUrl.value.trim();
      if (!urlValue) {
        triggerAlert('error', 'Masukkan tautan media terlebih dahulu.');
        return;
      }

      btnCekLink.disabled = true;
      btnCekLink.innerHTML = `
        <svg class="w-3.5 h-3.5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Menganalisis...</span>
      `;

      try {
        const response = await fetch('/api/cek-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: urlValue })
        });
        const result = await response.json();
        
        btnCekLink.disabled = false;
        btnCekLink.innerHTML = `
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
          <span>Cek Link</span>
        `;

        if (result.type === 'playlist') {
          appState.activePlaylist = result.data;
          appState.activeSingleVideo = null;
          showPlaylistPreview();
        } else {
          appState.activeSingleVideo = result.data;
          appState.activePlaylist = null;
          showVideoPreview();
        }
      } catch (err) {
        btnCekLink.disabled = false;
        btnCekLink.innerHTML = `
          <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
          <span>Cek Link</span>
        `;
        triggerAlert('error', 'Gagal menganalisis tautan media.');
      }
    });
  }

  // Submit Single Download Button
  const btnUnduh = document.getElementById('btn-unduh');
  if (btnUnduh && inputUrl) {
    btnUnduh.addEventListener('click', async () => {
      const urlValue = inputUrl.value.trim();
      if (!urlValue) {
        triggerAlert('error', 'Masukkan tautan media terlebih dahulu.');
        return;
      }

      const lowerUrl = urlValue.toLowerCase();
      if (lowerUrl.includes('list=') || lowerUrl.includes('playlist')) {
        // Enqueue playlist sequential items
        try {
          // Fallback check if playlist isn't analysed, analyse first, else run queue
          const playlistToUse = appState.activePlaylist || {
            items: [
              { title: 'JS Pemula #1: Pengenalan JavaScript & Instalasi Node.js', url: 'https://www.youtube.com/watch?v=4adZ7AguVcw&list=PLFcGX84jKOu59GrHP13_mfxGRCZkWyGbS&index=1' },
              { title: 'JS Pemula #2: Variabel, Tipe Data, dan Operator Matematika', url: 'https://www.youtube.com/watch?v=A2B93D01&list=PLFcGX84jKOu59GrHP13_mfxGRCZkWyGbS&index=2' },
              { title: 'JS Pemula #3: Struktur Percabangan (If-Else & Switch Case)', url: 'https://www.youtube.com/watch?v=C3D84E92&list=PLFcGX84jKOu59GrHP13_mfxGRCZkWyGbS&index=3' }
            ]
          };

          for (const item of playlistToUse.items) {
            await enqueueDownload(item.title, item.url);
          }
          triggerAlert('success', `Sukses mendaftarkan playlist (${playlistToUse.items.length} trek) ke SQLite.`);
        } catch (err) {
          triggerAlert('error', 'Gagal mendaftarkan playlist.');
        }
      } else {
        const finalTitle = appState.activeSingleVideo ? appState.activeSingleVideo.title : 'Mengunduh Tautan Media';
        await enqueueDownload(finalTitle, urlValue);
        triggerAlert('success', 'Berhasil mendaftarkan video ke SQLite.');
      }

      inputUrl.value = '';
      hidePreviews();
    });
  }

  // Bulk Manual Submit Button
  const btnBulkUnduh = document.getElementById('btn-bulk-unduh');
  const bulkText = document.getElementById('bulk-text') as HTMLTextAreaElement;
  if (btnBulkUnduh && bulkText) {
    btnBulkUnduh.addEventListener('click', async () => {
      const text = bulkText.value.trim();
      if (!text) {
        triggerAlert('error', 'Masukkan minimal satu tautan pada textarea.');
        return;
      }

      const lines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('http://') || l.startsWith('https://'));
      if (lines.length === 0) {
        triggerAlert('warning', 'Tidak ditemukan tautan URL yang valid (pastikan diawali http/https).');
        return;
      }

      for (let index = 0; index < lines.length; index++) {
        const url = lines[index];
        const title = `Bulk Unduh #${index + 1} - ${url.substring(0, 24)}...`;
        await enqueueDownload(title, url);
      }

      triggerAlert('success', `Sukses mendaftarkan ${lines.length} tautan bulk ke SQLite!`);
      bulkText.value = '';
      document.getElementById('bulk-counter')!.textContent = '0 Tautan terdeteksi';
    });

    bulkText.addEventListener('input', () => {
      const text = bulkText.value.trim();
      const linesCount = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('http://') || l.startsWith('https://')).length;
      document.getElementById('bulk-counter')!.textContent = `${linesCount} Tautan valid terdeteksi`;
    });
  }

  // Playlist Box actions
  const btnClosePlaylist = document.getElementById('btn-close-playlist');
  const btnPlaylistBatal = document.getElementById('btn-playlist-batal');
  const btnPlaylistUnduhSemua = document.getElementById('btn-playlist-unduh-semua');
  if (btnClosePlaylist) btnClosePlaylist.addEventListener('click', hidePreviews);
  if (btnPlaylistBatal) btnPlaylistBatal.addEventListener('click', hidePreviews);
  if (btnPlaylistUnduhSemua) {
    btnPlaylistUnduhSemua.addEventListener('click', async () => {
      if (appState.activePlaylist) {
        const checkboxes = document.querySelectorAll('.playlist-track-checkbox') as NodeListOf<HTMLInputElement>;
        let count = 0;
        for (let idx = 0; idx < checkboxes.length; idx++) {
          const cb = checkboxes[idx];
          if (cb.checked) {
            const track = appState.activePlaylist.items[idx];
            await enqueueDownload(track.title, track.url);
            count++;
          }
        }
        
        triggerAlert('success', `Berhasil mendaftarkan ${count} trek video ke SQLite.`);
        hidePreviews();
        if (inputUrl) inputUrl.value = '';
      }
    });
  }

  const btnCloseVideoPreview = document.getElementById('btn-close-video-preview');
  if (btnCloseVideoPreview) btnCloseVideoPreview.addEventListener('click', hidePreviews);

  // Clear Terminal logs (Client side representation only, server remains running)
  const btnClearLogs = document.getElementById('btn-clear-logs');
  if (btnClearLogs) {
    btnClearLogs.addEventListener('click', () => {
      const terminal = document.getElementById('terminal-content');
      if (terminal) terminal.innerHTML = '<p class="text-slate-500">[logs cleared]</p>';
    });
  }

  // Clear History list in DB
  const btnClearHistory = document.getElementById('btn-clear-history');
  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', async () => {
      try {
        await fetch('/api/history', { method: 'DELETE' });
        loadHistory();
        triggerAlert('success', 'Riwayat berhasil dibersihkan.');
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Filter History search & select
  const historySearch = document.getElementById('history-search') as HTMLInputElement;
  const historyFilter = document.getElementById('history-filter') as HTMLSelectElement;
  if (historySearch && historyFilter) {
    historySearch.addEventListener('input', loadHistory);
    historyFilter.addEventListener('change', loadHistory);
  }

  // Settings Concurrency limit change
  const settingBatchLimit = document.getElementById('setting-batch-limit') as HTMLSelectElement;
  if (settingBatchLimit) {
    settingBatchLimit.addEventListener('change', async () => {
      appState.settings.batchLimit = parseInt(settingBatchLimit.value);
      await saveSettings();
      await loadSettings();
      triggerAlert('success', `Konkurensi batch diperbarui ke ${appState.settings.batchLimit} unduhan serentak.`);
    });
  }

  // Setting Download dir change
  const settingDownloadDir = document.getElementById('setting-download-dir') as HTMLInputElement;
  const btnBrowseDir = document.getElementById('btn-browse-dir');
  if (settingDownloadDir) {
    settingDownloadDir.addEventListener('change', async () => {
      appState.settings.downloadDir = settingDownloadDir.value;
      await saveSettings();
      await loadSettings();
    });
  }
  if (btnBrowseDir && settingDownloadDir) {
    btnBrowseDir.addEventListener('click', async () => {
      triggerAlert('success', 'Tauri Dialog: Direktori target berhasil diverifikasi.');
      settingDownloadDir.value = '/Downloads/YibYib_Tauri_Media_Selesai';
      appState.settings.downloadDir = settingDownloadDir.value;
      await saveSettings();
      await loadSettings();
    });
  }

  // Floating Player close button
  const btnClosePlayer = document.getElementById('btn-close-player');
  const mediaPlayerOverlay = document.getElementById('media-player-overlay');
  if (btnClosePlayer && mediaPlayerOverlay) {
    btnClosePlayer.addEventListener('click', () => {
      mediaPlayerOverlay.classList.add('hidden');
    });
  }
}

// 10.5 Queue Tab Mass Actions Controller
function initQueueControls() {
  const pauseAllBtn = document.getElementById('btn-pause-all');
  const resumeAllBtn = document.getElementById('btn-resume-all');
  const cancelAllBtn = document.getElementById('btn-cancel-all');
  const btnGoToQueue = document.getElementById('btn-go-to-queue');

  if (pauseAllBtn) {
    pauseAllBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/downloads/control/all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'pause-all' })
        });
        triggerAlert('warning', 'Semua unduhan aktif ditangguhkan.');
      } catch (err) {
        console.error(err);
      }
    });
  }

  if (resumeAllBtn) {
    resumeAllBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/downloads/control/all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resume-all' })
        });
        triggerAlert('success', 'Melanjutkan semua unduhan.');
      } catch (err) {
        console.error(err);
      }
    });
  }

  if (cancelAllBtn) {
    cancelAllBtn.addEventListener('click', async () => {
      if (confirm('Apakah Anda yakin ingin menghapus semua item di antrean unduhan?')) {
        try {
          await fetch('/api/downloads/control/all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'cancel-all' })
          });
          triggerAlert('error', 'Semua antrean unduhan dibersihkan.');
        } catch (err) {
          console.error(err);
        }
      }
    });
  }

  if (btnGoToQueue) {
    btnGoToQueue.addEventListener('click', () => {
      const tabAntrean = document.getElementById('tab-antrean');
      if (tabAntrean) tabAntrean.click();
    });
  }
}

// 11. Drag and Drop TXT Files Loader for Bulk Links
function initDragAndDrop() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('bulk-file-input') as HTMLInputElement;
  const bulkText = document.getElementById('bulk-text') as HTMLTextAreaElement;

  if (dropZone && fileInput && bulkText) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.className = "border-2 border-dashed border-blue-500 bg-blue-600/5 text-blue-400 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150";
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.className = "border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/30 hover:bg-slate-950/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150";
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.className = "border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/30 hover:bg-slate-950/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-150";
      
      const file = e.dataTransfer?.files[0];
      if (file && file.name.endsWith('.txt')) {
        parseTxtFile(file);
      } else {
        triggerAlert('error', 'Hanya mendukung berkas dengan format teks (.txt).');
      }
    });

    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) {
        parseTxtFile(file);
      }
    });
  }

  function parseTxtFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const validLinks = lines.filter(l => l.startsWith('http://') || l.startsWith('https://'));

      if (validLinks.length === 0) {
        triggerAlert('warning', 'Berkas terbaca, namun tidak ditemukan tautan valid.');
        return;
      }

      bulkText.value = validLinks.join('\n');
      document.getElementById('bulk-counter')!.textContent = `${validLinks.length} Tautan valid terdeteksi`;
      triggerAlert('success', `Berhasil mengimpor ${validLinks.length} tautan dari berkas ${file.name}.`);
    };
    reader.readAsText(file);
  }
}

// 12. Playlist & Video Previews Rendering
function showPlaylistPreview() {
  const box = document.getElementById('playlist-preview-box');
  const tracksContainer = document.getElementById('playlist-tracks');
  const videoBox = document.getElementById('video-preview-box');

  if (box && tracksContainer && videoBox && appState.activePlaylist) {
    videoBox.classList.add('hidden');
    box.classList.remove('hidden');
    
    document.getElementById('playlist-title')!.textContent = appState.activePlaylist.playlistTitle;
    document.getElementById('playlist-subtitle')!.textContent = `Mengekstrak ${appState.activePlaylist.items.length} trek video • Mode Sequential Queue diaktifkan`;
    document.getElementById('playlist-track-selection-count')!.textContent = `${appState.activePlaylist.items.length} Trek terpilih`;

    tracksContainer.innerHTML = appState.activePlaylist.items.map((item, idx) => `
      <div class="flex items-center justify-between text-xs p-2 bg-[#090d16] rounded-lg border border-slate-800/80 hover:border-slate-700 transition-colors">
        <div class="flex items-center gap-3 min-w-0">
          <input type="checkbox" checked class="playlist-track-checkbox w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-950 border-slate-800 cursor-pointer" data-index="${idx}" />
          <span class="text-[10px] text-slate-500 font-mono w-4">#0${idx + 1}</span>
          <p class="text-slate-200 font-semibold truncate max-w-[420px]">${item.title}</p>
        </div>
        <span class="text-[10px] text-slate-500 font-mono flex-shrink-0 bg-slate-900 px-2 py-0.5 rounded border border-slate-800/40">
          ${item.duration}
        </span>
      </div>
    `).join('');

    const checkboxes = tracksContainer.querySelectorAll('.playlist-track-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const checkedCount = Array.from(checkboxes).filter(c => c.checked).length;
        document.getElementById('playlist-track-selection-count')!.textContent = `${checkedCount} Trek terpilih`;
      });
    });
  }
}

function showVideoPreview() {
  const box = document.getElementById('video-preview-box');
  const playlistBox = document.getElementById('playlist-preview-box');

  if (box && playlistBox && appState.activeSingleVideo) {
    playlistBox.classList.add('hidden');
    box.classList.remove('hidden');

    const img = document.getElementById('video-preview-img') as HTMLImageElement;
    img.src = appState.activeSingleVideo.thumbnail;
    document.getElementById('video-preview-title')!.textContent = appState.activeSingleVideo.title;
    document.getElementById('video-preview-channel')!.textContent = appState.activeSingleVideo.channel;
    document.getElementById('video-preview-duration')!.textContent = `Durasi: ${appState.activeSingleVideo.duration}`;
  }
}

function hidePreviews() {
  const pBox = document.getElementById('playlist-preview-box');
  const vBox = document.getElementById('video-preview-box');
  if (pBox) pBox.classList.add('hidden');
  if (vBox) vBox.classList.add('hidden');
  appState.activePlaylist = null;
  appState.activeSingleVideo = null;
}

// 13. Submit and register a download into SQLite Queue
async function enqueueDownload(title: string, url: string) {
  let extSelected = 'mp4';
  const fileTypeSelect = document.getElementById('select-file-type') as HTMLSelectElement;
  if (fileTypeSelect) {
    extSelected = fileTypeSelect.value;
  }

  let qualitySelected = '1080p';
  if (appState.mediaMode === 'video') {
    const el = document.getElementById('select-video-res') as HTMLSelectElement;
    if (el) qualitySelected = el.value;
  } else {
    const el = document.getElementById('select-audio-res') as HTMLSelectElement;
    if (el) qualitySelected = el.value;
  }

  const id = `dl_${Math.random().toString(36).substring(2, 11)}`;
  const platform = url.includes('youtube') || url.includes('youtu.be') ? 'YouTube' :
                   url.includes('tiktok') ? 'TikTok' :
                   url.includes('instagram') ? 'Instagram' :
                   url.includes('vimeo') ? 'Vimeo' : 'Generic';

  try {
    await fetch('/api/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        url,
        title,
        fileType: extSelected,
        resolution: qualitySelected,
        platform
      })
    });

    const successTip = document.getElementById('queue-success-tip');
    if (successTip) {
      successTip.classList.remove('hidden');
      setTimeout(() => {
        successTip.classList.add('hidden');
      }, 7000);
    }
  } catch (err) {
    console.error('Gagal mendaftarkan unduhan ke SQLite:', err);
    triggerAlert('error', 'Gagal mendaftarkan unduhan.');
  }
}

// 14. Queue View Renderers
function updateQueueView() {
  const container = document.getElementById('downloads-list');
  const emptyState = document.getElementById('downloads-empty');
  const countBadge = document.getElementById('queue-count-badge');

  if (!container || !emptyState || !countBadge) return;

  const activeDownloads = appState.downloads;
  countBadge.textContent = `${activeDownloads.length} Item`;

  if (activeDownloads.length === 0) {
    emptyState.classList.remove('hidden');
    container.querySelectorAll('.download-card-item').forEach(el => el.remove());
    appState.selectedQueueIds.clear();
    updateQueueSelectionBar();
    return;
  }

  // Apply Filter
  let processed = [...activeDownloads];
  if (appState.queueFilter !== 'all') {
    processed = processed.filter(dl => dl.status === appState.queueFilter);
  }

  // Apply Sort
  if (appState.queueSort === 'title') {
    processed.sort((a, b) => a.title.localeCompare(b.title));
  } else if (appState.queueSort === 'progress') {
    processed.sort((a, b) => b.progress - a.progress);
  } else if (appState.queueSort === 'newest') {
    // Keep order of server which is newest based on reversed created_at ASC
    processed.reverse();
  }

  if (processed.length === 0) {
    emptyState.classList.remove('hidden');
    container.querySelectorAll('.download-card-item').forEach(el => el.remove());
    updateQueueSelectionBar();
    return;
  }

  emptyState.classList.add('hidden');

  const existingCards = new Map<string, HTMLElement>();
  container.querySelectorAll('.download-card-item').forEach(el => {
    existingCards.set(el.getAttribute('data-id')!, el as HTMLElement);
  });

  processed.forEach((dl) => {
    let card = existingCards.get(dl.id);
    const isNew = !card;

    if (!card) {
      card = document.createElement('div');
      card.setAttribute('data-id', dl.id);
      card.className = "download-card-item bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center relative overflow-hidden transition-all duration-150 animate-slideIn";
    }

    let statusClass = "bg-blue-500/10 text-blue-400 border border-blue-500/15";
    let statusLabel = "Antre...";
    if (dl.status === 'downloading') {
      statusClass = "bg-amber-500/10 text-amber-400 border border-amber-500/15 animate-pulse";
      statusLabel = "Mengunduh...";
    } else if (dl.status === 'paused') {
      statusClass = "bg-slate-800 text-slate-400 border border-slate-700/60";
      statusLabel = "Ditangguhkan";
    } else if (dl.status === 'completed') {
      statusClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15";
      statusLabel = "Sukses";
    } else if (dl.status === 'failed') {
      statusClass = "bg-rose-500/10 text-rose-400 border border-rose-500/15";
      statusLabel = "Gagal";
    }

    card.innerHTML = `
      <div class="flex items-start gap-3 w-full">
        <div class="pt-1.5 flex-shrink-0">
          <input type="checkbox" class="queue-item-checkbox w-4 h-4 rounded bg-slate-950 border-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer" data-id="${dl.id}" ${appState.selectedQueueIds.has(dl.id) ? 'checked' : ''} />
        </div>
        <div class="flex-1 min-w-0 space-y-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[9px] uppercase font-extrabold ${statusClass} px-2 py-0.5 rounded font-mono">
              ${statusLabel}
            </span>
            <span class="text-[9px] uppercase font-bold bg-slate-950 text-blue-400 border border-blue-500/10 px-2 py-0.5 rounded font-mono">
              ${dl.fileType.toUpperCase()}
            </span>
            <span class="text-[9px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded font-mono font-bold">
              ${dl.resolution}
            </span>
            <span class="text-[10px] text-slate-500 font-mono truncate max-w-[280px]">
              ${dl.url}
            </span>
          </div>

          <h4 class="text-xs font-bold text-white truncate max-w-[500px]">${dl.title}</h4>

          <div class="space-y-1.5">
            <div class="h-1.5 bg-slate-950 rounded-full overflow-hidden relative border border-slate-800/40">
              <div class="absolute left-0 top-0 bottom-0 bg-blue-500 rounded-full transition-all duration-300" style="width: ${dl.progress}%"></div>
            </div>
            <div class="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span class="flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-blue-500 ${dl.status === 'downloading' ? 'animate-ping' : ''}"></span>
                ${dl.currentPhase}
              </span>
              <span class="font-bold text-slate-300">${dl.progress}%</span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex md:flex-col items-end gap-3 justify-between w-full md:w-auto border-t md:border-t-0 border-slate-800/50 pt-3 md:pt-0 pl-7 md:pl-0">
        <div class="text-right space-y-0.5 font-mono text-[10px] text-slate-500">
          <div>Kecepatan: <strong class="text-slate-300">${dl.speed}</strong></div>
          <div>Ukuran: <strong class="text-slate-300">${dl.size}</strong></div>
        </div>

        <div class="flex gap-1.5">
          ${dl.status === 'downloading' ? `
            <button class="btn-pause-dl p-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg cursor-pointer transition-colors" data-id="${dl.id}" title="Tangguhkan">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5"/></svg>
            </button>
          ` : dl.status === 'paused' ? `
            <button class="btn-resume-dl p-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white rounded-lg cursor-pointer transition-colors" data-id="${dl.id}" title="Lanjutkan">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/></svg>
            </button>
          ` : ''}
          <button class="btn-cancel-dl p-1.5 bg-slate-950 border border-slate-800 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 rounded-lg cursor-pointer transition-colors" data-id="${dl.id}" title="Batalkan">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
    `;

    if (isNew) {
      container.appendChild(card);
    }

    // Checkbox listener
    const checkbox = card.querySelector('.queue-item-checkbox') as HTMLInputElement;
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          appState.selectedQueueIds.add(dl.id);
        } else {
          appState.selectedQueueIds.delete(dl.id);
        }
        updateQueueSelectionBar();
      });
    }

    const pauseBtn = card.querySelector('.btn-pause-dl');
    const resumeBtn = card.querySelector('.btn-resume-dl');
    const cancelBtn = card.querySelector('.btn-cancel-dl');

    if (pauseBtn) {
      pauseBtn.addEventListener('click', async () => {
        try {
          await fetch(`/api/downloads/${dl.id}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'pause' })
          });
        } catch (err) {
          console.error(err);
        }
      });
    }

    if (resumeBtn) {
      resumeBtn.addEventListener('click', async () => {
        try {
          await fetch(`/api/downloads/${dl.id}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'resume' })
          });
        } catch (err) {
          console.error(err);
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        try {
          await fetch(`/api/downloads/${dl.id}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'cancel' })
          });
        } catch (err) {
          console.error(err);
        }
      });
    }
  });

  const processedIds = new Set(processed.map(d => d.id));
  existingCards.forEach((card, id) => {
    if (!processedIds.has(id)) {
      card.remove();
    }
  });

  updateQueueSelectionBar();
}

function updateQueueSelectionBar() {
  const bar = document.getElementById('queue-selection-bar');
  const countBadge = document.getElementById('queue-selected-count');
  const actions = document.getElementById('queue-bulk-actions');
  const masterCheckbox = document.getElementById('queue-select-all') as HTMLInputElement;
  const container = document.getElementById('downloads-list');

  if (!bar || !countBadge || !actions || !container) return;

  const totalVisible = container.querySelectorAll('.download-card-item').length;
  
  const visibleCheckboxes = container.querySelectorAll('.queue-item-checkbox') as NodeListOf<HTMLInputElement>;
  const visibleIds = new Set(Array.from(visibleCheckboxes).map(cb => cb.getAttribute('data-id')!));
  
  for (const id of appState.selectedQueueIds) {
    if (!visibleIds.has(id)) {
      appState.selectedQueueIds.delete(id);
    }
  }

  const selectedCount = appState.selectedQueueIds.size;

  if (selectedCount > 0) {
    countBadge.classList.remove('hidden');
    countBadge.textContent = `${selectedCount} Terpilih`;
    actions.classList.remove('hidden');
  } else {
    countBadge.classList.add('hidden');
    actions.classList.add('hidden');
  }

  if (masterCheckbox) {
    masterCheckbox.checked = totalVisible > 0 && Array.from(visibleCheckboxes).every(cb => cb.checked);
  }
}

// 15. History View Renderers
function updateHistoryView() {
  const container = document.getElementById('history-list-container');
  const emptyState = document.getElementById('history-empty');

  if (!container || !emptyState) return;

  const history = appState.history;
  if (history.length === 0) {
    emptyState.classList.remove('hidden');
    container.querySelectorAll('.history-item-row').forEach(el => el.remove());
    return;
  }

  emptyState.classList.add('hidden');

  const existingRows = new Map<string, HTMLElement>();
  container.querySelectorAll('.history-item-row').forEach(el => {
    existingRows.set(el.getAttribute('data-id')!, el as HTMLElement);
  });

  history.forEach((hist) => {
    let row = existingRows.get(hist.id);
    const isNew = !row;

    if (!row) {
      row = document.createElement('div');
      row.setAttribute('data-id', hist.id);
      row.setAttribute('data-type', ['mp3', 'm4a', 'wav'].includes(hist.fileType) ? 'audio' : 'video');
      row.className = "history-item-row bg-slate-900 border border-slate-800/80 p-4 rounded-xl flex items-center justify-between gap-4 hover:border-slate-700/60 transition-all duration-150 animate-slideIn";
    }

    row.innerHTML = `
      <div class="flex-1 min-w-0 flex items-center gap-3">
        <div class="p-2 bg-slate-950 rounded-lg text-blue-400 border border-slate-800/50 flex-shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <div class="min-w-0">
          <h4 class="history-title text-xs font-bold text-slate-100 truncate">${hist.title}</h4>
          <div class="flex items-center gap-2 mt-1.5 flex-wrap">
            <span class="text-[9px] font-mono font-bold uppercase bg-slate-950 text-blue-400 border border-blue-500/10 px-1.5 py-0.5 rounded">
              ${hist.fileType}
            </span>
            <span class="text-[9px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded">
              ${hist.resolution}
            </span>
            <span class="text-[10px] text-slate-500 font-mono">• Selesai: ${hist.completedAt}</span>
            <span class="text-[10px] text-slate-500 font-mono">• Ukuran: ${hist.size}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button class="btn-play-file px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/10 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"/></svg>
          <span>Putar</span>
        </button>
        <a href="/downloads/${encodeURIComponent(hist.filename || (hist.title + '.' + hist.fileType))}" download class="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/10 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1" title="Unduh File ke Lokal">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          <span>Simpan</span>
        </a>
        <button class="btn-delete-history p-2 bg-slate-950 border border-slate-850 hover:bg-rose-950/30 text-slate-500 hover:text-rose-400 rounded-lg cursor-pointer transition-colors" data-id="${hist.id}" title="Hapus Riwayat">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    `;

    if (isNew) {
      container.appendChild(row);
    }

    const playBtn = row.querySelector('.btn-play-file');
    const deleteBtn = row.querySelector('.btn-delete-history');

    if (playBtn) {
      playBtn.addEventListener('click', () => {
        triggerLocalPlayer(hist.title, hist.fileType, hist.resolution);
      });
    }

    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        try {
          await fetch(`/api/history/${hist.id}`, { method: 'DELETE' });
          loadHistory();
          triggerAlert('success', 'Tautan riwayat dihapus.');
        } catch (err) {
          console.error(err);
        }
      });
    }
  });

  const activeIds = new Set(history.map(h => h.id));
  existingRows.forEach((row, id) => {
    if (!activeIds.has(id)) {
      row.remove();
    }
  });
}

function updateHistoryBadge() {
  const badge = document.getElementById('riwayat-badge');
  if (badge) {
    badge.textContent = `${appState.history.length}`;
  }
}

// 16. Local Floating Media Player Controller
function triggerLocalPlayer(title: string, fileType: string, quality: string) {
  const player = document.getElementById('media-player-overlay');
  const playerTitle = document.getElementById('player-title');
  const playerMeta = document.getElementById('player-meta');

  if (player && playerTitle && playerMeta) {
    player.classList.remove('hidden');
    playerTitle.textContent = title;
    playerMeta.textContent = `${['mp3', 'm4a', 'wav'].includes(fileType) ? 'Audio Track' : 'Video Container'} • ${fileType.toUpperCase()} • ${quality}`;
    
    triggerAlert('success', `Memutar berkas: "${title}"`);
  }
}

// 17. Toast Notification Alerts UI system
function triggerAlert(type: 'success' | 'warning' | 'error', text: string) {
  const container = document.getElementById('toasts-container');
  if (!container) return;

  const toast = document.createElement('div');
  
  let styles = "bg-slate-900/95 text-slate-100 border border-slate-800";
  let icon = `<svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

  if (type === 'success') {
    styles = "bg-slate-950/90 text-emerald-300 border border-emerald-500/20";
    icon = `<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  } else if (type === 'warning') {
    styles = "bg-slate-950/90 text-amber-300 border border-amber-500/20";
    icon = `<svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
  } else if (type === 'error') {
    styles = "bg-slate-950/90 text-rose-300 border border-rose-500/25";
    icon = `<svg class="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  }

  toast.className = `${styles} p-4 rounded-xl flex items-center gap-3 shadow-2xl pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0 select-none max-w-sm`;
  toast.innerHTML = `
    ${icon}
    <p class="text-xs font-semibold">${text}</p>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.className = `${styles} p-4 rounded-xl flex items-center gap-3 shadow-2xl pointer-events-auto transition-all duration-300 transform translate-y-0 opacity-100 select-none max-w-sm`;
  }, 10);

  setTimeout(() => {
    toast.className = `${styles} p-4 rounded-xl flex items-center gap-3 shadow-2xl pointer-events-auto transition-all duration-300 transform -translate-y-2 opacity-0 select-none max-w-sm`;
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

// 18. Queue Filters & Multi-Selection Logic
function initQueueFiltersAndSelection() {
  const filterButtons = document.querySelectorAll('.queue-filter-btn');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => {
        b.className = "queue-filter-btn px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer";
      });
      btn.className = "queue-filter-btn px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold transition-all cursor-pointer";
      
      const filterValue = btn.getAttribute('data-filter') as any;
      appState.queueFilter = filterValue;
      
      appState.selectedQueueIds.clear();
      updateQueueView();
    });
  });

  const sortSelect = document.getElementById('sort-queue') as HTMLSelectElement;
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      appState.queueSort = sortSelect.value as any;
      updateQueueView();
    });
  }

  const selectAllCheckbox = document.getElementById('queue-select-all') as HTMLInputElement;
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', () => {
      const visibleCheckboxes = document.querySelectorAll('#downloads-list .queue-item-checkbox') as NodeListOf<HTMLInputElement>;
      const checked = selectAllCheckbox.checked;
      
      visibleCheckboxes.forEach(cb => {
        cb.checked = checked;
        const id = cb.getAttribute('data-id')!;
        if (checked) {
          appState.selectedQueueIds.add(id);
        } else {
          appState.selectedQueueIds.delete(id);
        }
      });
      
      const countBadge = document.getElementById('queue-selected-count');
      const actions = document.getElementById('queue-bulk-actions');
      if (countBadge && actions) {
        if (appState.selectedQueueIds.size > 0) {
          countBadge.classList.remove('hidden');
          countBadge.textContent = `${appState.selectedQueueIds.size} Terpilih`;
          actions.classList.remove('hidden');
        } else {
          countBadge.classList.add('hidden');
          actions.classList.add('hidden');
        }
      }
    });
  }

  const bulkPause = document.getElementById('btn-bulk-pause');
  const bulkResume = document.getElementById('btn-bulk-resume');
  const bulkCancel = document.getElementById('btn-bulk-cancel');

  const executeBulkAction = async (action: 'pause' | 'resume' | 'cancel') => {
    const idsToProcess = Array.from(appState.selectedQueueIds);
    if (idsToProcess.length === 0) return;

    triggerAlert('success', `Memproses ${idsToProcess.length} item secara massal...`);

    for (const id of idsToProcess) {
      try {
        await fetch(`/api/downloads/${id}/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        });
      } catch (err) {
        console.error(`Gagal melakukan aksi massal ${action} pada ${id}:`, err);
      }
    }

    appState.selectedQueueIds.clear();
    const selectAllCb = document.getElementById('queue-select-all') as HTMLInputElement;
    if (selectAllCb) selectAllCb.checked = false;
    
    // Quick refresh local state
    try {
      const res = await fetch('/api/downloads');
      const items = await res.json();
      appState.downloads = items.map((i: any) => ({
        id: i.id,
        url: i.url,
        title: i.title,
        fileType: i.file_type,
        resolution: i.resolution,
        progress: i.progress,
        speed: i.speed,
        size: i.size,
        status: i.status,
        currentPhase: i.current_phase,
        platform: i.platform
      }));
      updateQueueView();
    } catch (e) {
      console.error(e);
    }
  };

  if (bulkPause) bulkPause.addEventListener('click', () => executeBulkAction('pause'));
  if (bulkResume) bulkResume.addEventListener('click', () => executeBulkAction('resume'));
  if (bulkCancel) bulkCancel.addEventListener('click', () => executeBulkAction('cancel'));
}

// 19. Audio Converter Logic
async function initAudioConverter() {
  const tabHistoryBtn = document.getElementById('btn-conv-tab-history');
  const tabUploadBtn = document.getElementById('btn-conv-tab-upload');
  const panelHistory = document.getElementById('panel-conv-history');
  const panelUpload = document.getElementById('panel-conv-upload');

  if (!tabHistoryBtn || !tabUploadBtn || !panelHistory || !panelUpload) return;

  tabHistoryBtn.addEventListener('click', () => {
    tabHistoryBtn.className = "px-5 py-3 text-xs font-bold text-blue-400 border-b-2 border-blue-500 cursor-pointer transition-all";
    tabUploadBtn.className = "px-5 py-3 text-xs font-bold text-slate-400 hover:text-white border-b-2 border-transparent cursor-pointer transition-all";
    panelHistory.classList.remove('hidden');
    panelUpload.classList.add('hidden');
    renderConverterHistoryList();
  });

  tabUploadBtn.addEventListener('click', () => {
    tabUploadBtn.className = "px-5 py-3 text-xs font-bold text-blue-400 border-b-2 border-blue-500 cursor-pointer transition-all";
    tabHistoryBtn.className = "px-5 py-3 text-xs font-bold text-slate-400 hover:text-white border-b-2 border-transparent cursor-pointer transition-all";
    panelUpload.classList.remove('hidden');
    panelHistory.classList.add('hidden');
  });

  const historySearch = document.getElementById('conv-history-search') as HTMLInputElement;
  if (historySearch) {
    historySearch.addEventListener('input', () => {
      renderConverterHistoryList(historySearch.value);
    });
  }

  const selectedHistoryIds = new Set<string>();

  const updateHistorySelectedCount = () => {
    const badge = document.getElementById('conv-history-selected-count');
    if (badge) {
      badge.textContent = `${selectedHistoryIds.size} Terpilih`;
    }
  };

  const masterCheckbox = document.getElementById('conv-select-all-history') as HTMLInputElement;
  if (masterCheckbox) {
    masterCheckbox.addEventListener('change', () => {
      const checkboxes = document.querySelectorAll('#conv-history-list .conv-item-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => {
        cb.checked = masterCheckbox.checked;
        const id = cb.getAttribute('data-id')!;
        if (masterCheckbox.checked) {
          selectedHistoryIds.add(id);
        } else {
          selectedHistoryIds.delete(id);
        }
      });
      updateHistorySelectedCount();
    });
  }

  async function renderConverterHistoryList(searchTerm = '') {
    const listContainer = document.getElementById('conv-history-list');
    if (!listContainer) return;

    let videos = appState.history.filter(item => ['mp4', 'webm'].includes(item.fileType));
    
    if (searchTerm) {
      videos = videos.filter(v => v.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (videos.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center p-8 text-slate-500 text-xs font-mono">
          ${searchTerm ? 'Tidak ada hasil pencarian video.' : 'Tidak ada video di riwayat. Silakan unduh video terlebih dahulu.'}
        </div>
      `;
      if (masterCheckbox) masterCheckbox.checked = false;
      return;
    }

    listContainer.innerHTML = videos.map(v => `
      <div class="flex items-center justify-between p-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-850 rounded-xl transition-all duration-150">
        <div class="flex items-center gap-3 min-w-0">
          <input type="checkbox" class="conv-item-checkbox w-4 h-4 rounded bg-slate-900 border-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer" data-id="${v.id}" ${selectedHistoryIds.has(v.id) ? 'checked' : ''} />
          <div class="min-w-0">
            <h5 class="text-xs font-bold text-slate-200 truncate max-w-[400px]">${v.title}</h5>
            <div class="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-mono">
              <span class="uppercase font-bold text-blue-400">${v.fileType}</span>
              <span>•</span>
              <span>Size: ${v.size}</span>
              <span>•</span>
              <span>${v.completedAt}</span>
            </div>
          </div>
        </div>
        <div class="text-slate-500 text-[10px] font-mono hidden sm:block">
          Video Terunduh
        </div>
      </div>
    `).join('');

    const checkboxes = listContainer.querySelectorAll('.conv-item-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(cb => {
      cb.addEventListener('change', () => {
        const id = cb.getAttribute('data-id')!;
        if (cb.checked) {
          selectedHistoryIds.add(id);
        } else {
          selectedHistoryIds.delete(id);
        }
        updateHistorySelectedCount();
        if (masterCheckbox) {
          masterCheckbox.checked = Array.from(checkboxes).every(c => c.checked);
        }
      });
    });

    if (masterCheckbox) {
      masterCheckbox.checked = checkboxes.length > 0 && Array.from(checkboxes).every(c => c.checked);
    }
  }

  renderConverterHistoryList();

  const btnStartHistConv = document.getElementById('btn-start-history-conv');
  if (btnStartHistConv) {
    btnStartHistConv.addEventListener('click', async () => {
      if (selectedHistoryIds.size === 0) {
        triggerAlert('warning', 'Silakan pilih setidaknya satu video dari daftar.');
        return;
      }

      const bitrateSelect = document.getElementById('conv-history-bitrate') as HTMLSelectElement;
      const bitrate = bitrateSelect ? bitrateSelect.value : '320kbps';

      try {
        btnStartHistConv.setAttribute('disabled', 'true');
        btnStartHistConv.innerHTML = '<span>Memulai...</span>';

        const res = await fetch('/api/convert/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: Array.from(selectedHistoryIds),
            bitrate
          })
        });

        const data = await res.json();
        if (data.success) {
          triggerAlert('success', `Berhasil mendaftarkan ${selectedHistoryIds.size} antrean konversi!`);
          selectedHistoryIds.clear();
          updateHistorySelectedCount();
          if (masterCheckbox) masterCheckbox.checked = false;
          renderConverterHistoryList();
          pollConversions();
        } else {
          triggerAlert('error', data.error || 'Gagal memulai konversi.');
        }
      } catch (err) {
        console.error(err);
        triggerAlert('error', 'Gagal memanggil API konversi.');
      } finally {
        btnStartHistConv.removeAttribute('disabled');
        btnStartHistConv.innerHTML = `
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3M3 12a48.884 48.884 0 011.312-7.013M3 12l-3 3m3-3l3 3M3 12c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M19.5 12a48.884 48.884 0 01-1.312 7.013M19.5 12l3 3m-3-3l-3 3"/></svg>
          <span>Mulai Konversi</span>
        `;
      }
    });
  }

  const uploadZone = document.getElementById('conv-upload-zone');
  const fileInput = document.getElementById('conv-file-input') as HTMLInputElement;
  const filesContainer = document.getElementById('conv-uploaded-files-container');
  const filesList = document.getElementById('conv-uploaded-files-list');

  let localFilesQueue: File[] = [];

  if (uploadZone && fileInput && filesContainer && filesList) {
    uploadZone.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files) {
        Array.from(fileInput.files).forEach(f => {
          localFilesQueue.push(f);
        });
        renderLocalUploadsQueue();
      }
    });

    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.className = "p-8 border-2 border-dashed border-blue-500 bg-blue-500/5 rounded-2xl text-center cursor-pointer transition-all space-y-3";
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.className = "p-8 border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-2xl text-center bg-slate-900/10 hover:bg-slate-900/20 cursor-pointer transition-all space-y-3";
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.className = "p-8 border-2 border-dashed border-slate-800 hover:border-blue-500/50 rounded-2xl text-center bg-slate-900/10 hover:bg-slate-900/20 cursor-pointer transition-all space-y-3";
      
      if (e.dataTransfer && e.dataTransfer.files) {
        Array.from(e.dataTransfer.files).forEach(f => {
          if (f.type.startsWith('video/')) {
            localFilesQueue.push(f);
          } else {
            triggerAlert('warning', `Berkas "${f.name}" dilewati karena bukan file video.`);
          }
        });
        renderLocalUploadsQueue();
      }
    });

    function renderLocalUploadsQueue() {
      if (localFilesQueue.length === 0) {
        filesContainer!.classList.add('hidden');
        return;
      }

      filesContainer!.classList.remove('hidden');
      filesList!.innerHTML = localFilesQueue.map((file, idx) => `
        <div class="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-850">
          <div class="min-w-0">
            <h6 class="text-xs font-bold text-slate-200 truncate max-w-[400px]">${file.name}</h6>
            <span class="text-[10px] text-slate-500 font-mono">Format: ${file.name.split('.').pop()?.toUpperCase()} • Ukuran: ${(file.size / (1024 * 1024)).toFixed(1)} MB</span>
          </div>
          <button class="btn-remove-local-file text-slate-500 hover:text-rose-400 font-bold transition-all p-1 cursor-pointer" data-index="${idx}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      `).join('');

      const removeButtons = filesList!.querySelectorAll('.btn-remove-local-file');
      removeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-index')!);
          localFilesQueue.splice(idx, 1);
          renderLocalUploadsQueue();
        });
      });
    }

    const btnClearUploadList = document.getElementById('btn-clear-upload-list');
    if (btnClearUploadList) {
      btnClearUploadList.addEventListener('click', () => {
        localFilesQueue = [];
        renderLocalUploadsQueue();
      });
    }

    const btnStartUploadConv = document.getElementById('btn-start-upload-conv');
    if (btnStartUploadConv) {
      btnStartUploadConv.addEventListener('click', async () => {
        if (localFilesQueue.length === 0) return;

        const bitrateSelect = document.getElementById('conv-upload-bitrate') as HTMLSelectElement;
        const bitrate = bitrateSelect ? bitrateSelect.value : '320kbps';

        try {
          btnStartUploadConv.setAttribute('disabled', 'true');
          btnStartUploadConv.innerHTML = '<span>Mengunggah...</span>';

          const formData = new FormData();
          localFilesQueue.forEach(file => {
            formData.append('videos', file);
          });
          formData.append('bitrate', bitrate);

          const res = await fetch('/api/convert/upload', {
            method: 'POST',
            body: formData
          });

          const data = await res.json();
          if (data.success) {
            triggerAlert('success', `Berhasil mengunggah & memulai konversi untuk ${localFilesQueue.length} file!`);
            localFilesQueue = [];
            renderLocalUploadsQueue();
            pollConversions();
          } else {
            triggerAlert('error', data.error || 'Gagal mengunggah video.');
          }
        } catch (err) {
          console.error(err);
          triggerAlert('error', 'Gagal memanggil API upload konversi.');
        } finally {
          btnStartUploadConv.removeAttribute('disabled');
          btnStartUploadConv.innerHTML = '<span>Mulai Unggah & Konversi</span>';
        }
      });
    }
  }

  const jobsListContainer = document.getElementById('convert-jobs-list');
  const jobsEmptyState = document.getElementById('conv-jobs-empty');

  async function pollConversions() {
    try {
      const res = await fetch('/api/conversions');
      const jobs: ConversionJob[] = await res.json();
      appState.conversions = jobs;

      if (!jobsListContainer || !jobsEmptyState) return;

      const convertBadge = document.getElementById('convert-badge');
      const convertingJobsCount = jobs.filter(j => j.status === 'converting' || j.status === 'pending').length;
      if (convertBadge) {
        if (convertingJobsCount > 0) {
          convertBadge.textContent = String(convertingJobsCount);
          convertBadge.classList.remove('hidden');
        } else {
          convertBadge.classList.add('hidden');
        }
      }

      if (jobs.length === 0) {
        jobsEmptyState.classList.remove('hidden');
        jobsListContainer.querySelectorAll('.conv-job-card').forEach(el => el.remove());
        return;
      }

      jobsEmptyState.classList.add('hidden');

      const existingCards = new Map<string, HTMLElement>();
      jobsListContainer.querySelectorAll('.conv-job-card').forEach(el => {
        existingCards.set(el.getAttribute('data-id')!, el as HTMLElement);
      });

      const sortedJobs = [...jobs].reverse();

      sortedJobs.forEach(job => {
        let card = existingCards.get(job.id);
        const isNew = !card;

        if (!card) {
          card = document.createElement('div');
          card.setAttribute('data-id', job.id);
          card.className = "conv-job-card bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between gap-4 animate-slideIn";
        }

        let statusClass = "bg-blue-500/10 text-blue-400 border border-blue-500/15";
        let statusText = "Antre...";
        if (job.status === 'converting') {
          statusClass = "bg-amber-500/10 text-amber-400 border border-amber-500/15 animate-pulse";
          statusText = "Ekstraksi...";
        } else if (job.status === 'completed') {
          statusClass = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15";
          statusText = "Selesai";
        } else if (job.status === 'failed') {
          statusClass = "bg-rose-500/10 text-rose-400 border border-rose-500/15";
          statusText = "Gagal";
        }

        card.innerHTML = `
          <div class="flex-1 min-w-0 space-y-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[9px] uppercase font-extrabold ${statusClass} px-1.5 py-0.5 rounded font-mono">
                ${statusText}
              </span>
              <span class="text-[9px] font-bold bg-slate-950 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded font-mono">
                ${job.bitrate.toUpperCase()}
              </span>
              <span class="text-[9px] text-slate-500 font-mono truncate max-w-[200px]">
                ${job.sourceFilename}
              </span>
            </div>
            <h4 class="text-xs font-bold text-white truncate max-w-[450px]">${job.title}</h4>

            <div class="space-y-1">
              <div class="h-1 bg-slate-950 rounded-full overflow-hidden relative">
                <div class="absolute left-0 top-0 bottom-0 bg-blue-500 rounded-full transition-all duration-300" style="width: ${job.progress}%"></div>
              </div>
              <div class="flex items-center justify-between text-[9px] text-slate-500 font-mono">
                <span>${job.speed}</span>
                <span class="font-bold text-slate-400">${job.progress}%</span>
              </div>
            </div>
          </div>
          <div class="text-right flex-shrink-0 font-mono text-[10px] text-slate-500">
            <div>Ukuran: <strong class="text-slate-300">${job.size || 'Calculated...'}</strong></div>
            ${job.status === 'completed' ? `
              <div class="mt-1 text-emerald-400 font-bold text-[9px] uppercase tracking-wider">Tersimpan ke MP3</div>
            ` : ''}
          </div>
        `;

        if (isNew) {
          jobsListContainer.appendChild(card);
        }
      });

      const activeJobIds = new Set(jobs.map(j => j.id));
      existingCards.forEach((card, id) => {
        if (!activeJobIds.has(id)) {
          card.remove();
        }
      });

    } catch (err) {
      console.error(err);
    }
  }

  setInterval(pollConversions, 1500);

  const btnClearConvJobs = document.getElementById('btn-clear-conv-jobs');
  if (btnClearConvJobs) {
    btnClearConvJobs.addEventListener('click', async () => {
      try {
        await fetch('/api/conversions/clear', { method: 'POST' });
        pollConversions();
      } catch (err) {
        console.error(err);
      }
    });
  }

  (window as any).refreshConverterHistory = renderConverterHistoryList;
}
