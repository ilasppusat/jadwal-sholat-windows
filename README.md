# Jadwal Sholat — Windows

Aplikasi dibuat oleh [bantenweb.com](https://bantenweb.com).

Versi desktop Windows 10/11 dari [Jadwal Sholat (web)](../jadwal-sholat), dibangun dengan **Electron**. Tampilannya sama persis dengan versi web. Datanya tetap dari **Bimas Islam Kementerian Agama RI** melalui API publik MyQuran (`api.myquran.com/v2`).

## Fitur
- Jadwal harian & bulanan untuk 500+ kab/kota, jam real-time, hitung mundur, langit dinamis, cetak jadwal bulanan.
- **Berjalan di system tray**: menutup jendela tidak menghentikan aplikasi, jadi pengingat adzan dan pengingat 10 menit sebelumnya tetap muncul sebagai **notifikasi Windows** dengan suara. Tooltip ikon tray menampilkan waktu sholat berikutnya.
- **Jalankan saat Windows dimulai** (klik kanan ikon tray), dan saat itu aplikasi langsung masuk ke tray.
- **Deteksi lokasi via layanan lokasi Windows** (Pengaturan → Privasi & keamanan → Lokasi).
- **Offline**: jadwal & daftar kota di-cache di `%APPDATA%\Jadwal Sholat\jadwal-data`. Daftar kota juga sudah dibawa di dalam aplikasi.
- Hanya bisa dibuka satu kali. Membuka aplikasi lagi akan menampilkan jendela yang sudah berjalan.

## Perbedaan arsitektur dari versi web
Versi web memakai proxy PHP (`api.php`). Versi desktop **tidak membutuhkan PHP atau server**:

| Web | Desktop |
|---|---|
| `api.php` + `src/bootstrap.php` | [`lib/backend.js`](lib/backend.js) di main process, dilayani lewat skema `app://jadwal/api.php` sehingga `app.js` tidak perlu diubah |
| Validasi & pencocokan kota | [`lib/core.js`](lib/core.js) (sama dengan versi mobile) |
| Cache berkas `storage/` | `%APPDATA%\Jadwal Sholat\jadwal-data` (TTL sama: jadwal 7 hari, bulan lalu 60 hari, kota 30 hari, lokasi 180 hari) |
| Geolocation browser | Windows Location API via PowerShell (`System.Device`) |
| Service worker + Web Notification | Tidak dipakai. Diganti cache lokal + notifikasi native Electron |

Perubahan pada [`app/assets/js/app.js`](app/assets/js/app.js) dibanding versi web hanya pada bagian yang memeriksa `DESKTOP` (lokasi, notifikasi, tooltip tray, service worker).

## Struktur
| Berkas | Fungsi |
|---|---|
| `main.js` | Jendela, tray, protokol `app://`, notifikasi, lokasi Windows, izin |
| `preload.cjs` | Jembatan aman `window.desktop` (contextIsolation + sandbox) |
| `lib/backend.js`, `lib/core.js` | Pengganti `api.php` |
| `app/` | UI (salinan dari versi web) |
| `seed/cities.json` | Daftar kota bawaan untuk pemakaian pertama tanpa internet |
| `build/icon.png` | Ikon aplikasi (dikonversi otomatis ke `.ico`) |
| `tests/` | Uji backend (`npm test`, memanggil API asli) |

## Pengembangan
Kebutuhan: Node.js 20+ (sudah dites dengan Node 24).

```bash
npm install
node node_modules/electron/install.js   # hanya bila npm melewati skrip install Electron
npm start                                # jalankan aplikasi
npm test                                 # uji backend
```

> Bila menjalankan dari terminal VS Code dan Electron berlaku seperti Node biasa (error `does not provide an export named 'app'`), hapus dulu variabel `ELECTRON_RUN_AS_NODE`: PowerShell `Remove-Item Env:ELECTRON_RUN_AS_NODE`.

## Membuat installer
```bash
npm run dist            # dist\JadwalSholat-Setup-1.0.0.exe  (installer NSIS, ±110 MB)
npm run dist:portable   # dist\JadwalSholat-Portable-1.0.0.exe (tanpa instalasi)
```
Installer dipasang per pengguna (tidak perlu hak admin), folder instalasi bisa dipilih, dan membuat shortcut di Desktop & Start Menu. Uninstall lewat **Pengaturan → Aplikasi**.

Setiap build juga menulis `dist\SHA256SUMS.txt` (atau jalankan `npm run checksums`). Cantumkan isinya di halaman unduhan.

**Keamanan:** Electron Fuses dikunci saat build (`build.electronFuses`): RunAsNode, `NODE_OPTIONS`, dan `--inspect` dimatikan, dan keutuhan `app.asar` diperiksa. Lihat [SECURITY.md](SECURITY.md), [PRIVASI.md](PRIVASI.md), dan [CHECKLIST.md](CHECKLIST.md).

**Catatan SmartScreen:** installer belum ditandatangani (code signing), jadi Windows akan menampilkan "Windows protected your PC". Klik **More info → Run anyway**. Untuk distribusi publik, tandatangani dengan sertifikat code signing (atur `win.signtoolOptions` / variabel `CSC_LINK` di electron-builder).

## Sinkron dengan versi web
Bila UI web berubah, salin ulang `index.html` (hapus meta `og:`/`twitter:`/`canonical`/`manifest`), `assets/css/app.css`, dan `assets/js/app.js`. Setelah itu terapkan lagi bagian `DESKTOP` di `app.js`.

## Lisensi
[MIT](LICENSE). Data jadwal © Bimas Islam Kementerian Agama RI; data lokasi © kontributor OpenStreetMap.
