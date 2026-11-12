/* Jadwal Sholat — main process Electron (Windows). */
import { app, BrowserWindow, Menu, Notification, Tray, ipcMain, nativeImage, protocol, session, shell } from 'electron';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBackend } from './lib/backend.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.join(ROOT, 'app');
const ICON_PNG = path.join(ROOT, 'build', 'icon.png');
const SCHEME = 'app';
const ORIGIN = `${SCHEME}://jadwal`;
const APP_ID = 'id.jadwalsholat.desktop';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; "
  + "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

// Skema app:// diperlakukan seperti HTTPS (secure context) agar fetch & Notification berjalan normal.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false } },
]);

if (!app.requestSingleInstanceLock()) app.quit();
app.setAppUserModelId(APP_ID);

let win = null;
let tray = null;
let quitting = false;
let trayHintShown = false;
const startHidden = process.argv.includes('--hidden');

/* ---------- penyajian berkas & API ---------- */
function registerProtocol() {
  const backend = createBackend({
    // Bukan "cache": di Windows nama folder tidak case-sensitive, bentrok dengan folder "Cache" milik Chromium.
    cacheDir: path.join(app.getPath('userData'), 'jadwal-data'),
    seedCitiesFile: path.join(ROOT, 'seed', 'cities.json'),
  });

  protocol.handle(SCHEME, async (req) => {
    const url = new URL(req.url);
    if (url.host !== 'jadwal' || (req.method !== 'GET' && req.method !== 'HEAD')) {
      return new Response('Not found', { status: 404 });
    }
    if (url.pathname === '/api.php') {
      const { status, body } = await backend.handle(url.searchParams);
      return new Response(JSON.stringify(body), {
        status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.normalize(path.join(APP_DIR, rel));
    if (!file.startsWith(APP_DIR + path.sep)) return new Response('Forbidden', { status: 403 });
    try {
      const buf = await fs.readFile(file);
      return new Response(buf, {
        headers: {
          'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
          'Content-Security-Policy': CSP,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
}

/* ---------- lokasi via Windows Location API ---------- */
// Geolocation Chromium di Electron butuh API key Google; Windows punya layanan lokasi sendiri.
const PS_LOCATE = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Device
$w = New-Object System.Device.Location.GeoCoordinateWatcher([System.Device.Location.GeoPositionAccuracy]::Default)
$w.Start()
$t = 0
while ($w.Status -ne 'Ready' -and $w.Permission -ne 'Denied' -and $t -lt 120) { Start-Sleep -Milliseconds 100; $t++ }
if ($w.Permission -eq 'Denied') { 'DENIED'; exit }
$c = $w.Position.Location
$w.Stop()
if ($c.IsUnknown) { 'UNKNOWN' } else { [string]::Format([Globalization.CultureInfo]::InvariantCulture, '{0},{1}', $c.Latitude, $c.Longitude) }
`;

function windowsLocation() {
  return new Promise((resolve) => {
    // Tanpa "-ExecutionPolicy Bypass": kebijakan eksekusi hanya berlaku untuk berkas .ps1, bukan -Command,
    // dan flag itu sering dicurigai antivirus.
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS_LOCATE],
      { timeout: 20000, windowsHide: true }, (err, stdout) => {
        const out = String(stdout || '').trim();
        if (out === 'DENIED') return resolve({ error: 'denied' });
        const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/m.exec(out);
        if (m) return resolve({ lat: +m[1], lon: +m[2] });
        resolve({ error: err ? 'failed' : 'unknown' });
      });
  });
}

/* ---------- jendela, tray, notifikasi ---------- */
function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 820, minWidth: 380, minHeight: 560,
    show: false,
    backgroundColor: '#0b1026',
    title: 'Jadwal Sholat',
    icon: ICON_PNG,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(ROOT, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false, // jam & pengingat tetap jalan saat jendela tersembunyi di tray
      autoplayPolicy: 'no-user-gesture-required',
      spellcheck: false,
    },
  });
  win.removeMenu();
  win.loadURL(`${ORIGIN}/index.html`);
  win.once('ready-to-show', () => { if (!startHidden) win.show(); });

  // Tautan eksternal dibuka di browser; navigasi keluar aplikasi diblokir.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(ORIGIN)) e.preventDefault(); });

  // Tutup = sembunyikan ke tray, agar pengingat adzan tetap berbunyi.
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
    if (!trayHintShown && Notification.isSupported()) {
      trayHintShown = true;
      new Notification({
        title: 'Jadwal Sholat tetap berjalan',
        body: 'Aplikasi diperkecil ke system tray agar pengingat waktu sholat tetap aktif. Klik kanan ikon untuk keluar.',
        icon: ICON_PNG, silent: true,
      }).show();
    }
  });
  win.on('closed', () => { win = null; });
}

function buildTrayMenu() {
  const login = app.getLoginItemSettings();
  return Menu.buildFromTemplate([
    { label: 'Buka Jadwal Sholat', click: showWindow },
    { type: 'separator' },
    {
      label: 'Jalankan saat Windows dimulai', type: 'checkbox', checked: login.openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] });
        tray.setContextMenu(buildTrayMenu());
      },
    },
    { type: 'separator' },
    { label: 'Aplikasi dibuat oleh bantenweb.com', click: () => shell.openExternal('https://bantenweb.com') },
    { type: 'separator' },
    { label: 'Keluar', click: () => { quitting = true; app.quit(); } },
  ]);
}

function createTray() {
  const img = nativeImage.createFromPath(ICON_PNG).resize({ width: 32, height: 32, quality: 'best' });
  tray = new Tray(img);
  tray.setToolTip('Jadwal Sholat');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', showWindow);
}

function setupIpc() {
  ipcMain.handle('desktop:locate', () => windowsLocation());
  ipcMain.handle('desktop:notify', (_e, { title, body } = {}) => {
    if (!Notification.isSupported()) return false;
    const n = new Notification({ title: String(title || '').slice(0, 120), body: String(body || '').slice(0, 300), icon: ICON_PNG });
    n.on('click', showWindow);
    n.show();
    return true;
  });
  ipcMain.on('desktop:title', (_e, t) => { if (tray && typeof t === 'string') tray.setToolTip(t.slice(0, 120)); });
}

function setupPermissions() {
  const allowed = new Set(['notifications']);
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(allowed.has(perm)));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => allowed.has(perm));
}

app.on('second-instance', showWindow);
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* tetap hidup di tray */ });

app.whenReady().then(() => {
  setupPermissions();
  registerProtocol();
  setupIpc();
  createTray();
  createWindow();
});
