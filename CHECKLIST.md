# Checklist Keamanan & Kepercayaan

Terakhir diperbarui: 11 November 2026.

Tanda `[x]` = sudah dikerjakan, `[ ]` = belum.

## 1. Keamanan kode aplikasi

- [x] Tampilan terisolasi: `contextIsolation`, `sandbox`, `nodeIntegration: false` ([main.js](main.js))
- [x] Preload hanya membuka 3 fungsi: lokasi, notifikasi, tooltip tray ([preload.cjs](preload.cjs))
- [x] Content Security Policy ketat, semua tampilan dimuat dari berkas lokal `app://`
- [x] Navigasi keluar aplikasi dan jendela baru diblokir
- [x] Izin browser hanya notifikasi
- [x] Pengaman agar tidak bisa membaca berkas di luar folder `app/`
- [x] Validasi parameter, tolak redirect, batas waktu, dan batas ukuran respons di [lib/backend.js](lib/backend.js)
- [x] `innerHTML` hanya diisi teks tetap; data dari luar lewat `textContent`
- [x] Tanpa telemetri, iklan, atau pelacakan
- [x] **Electron Fuses dikunci** di `package.json` → `build.electronFuses`
  - [x] `RunAsNode`, `NODE_OPTIONS`, dan `--inspect` dimatikan
  - [x] Pemeriksaan keutuhan `app.asar` aktif, dan aplikasi hanya dimuat dari asar
  - [x] Sudah diuji: `@electron/fuses read` menunjukkan semua fuse sesuai, dan salinan yang `app.asar`-nya diubah menolak berjalan
- [x] PowerShell lokasi tidak lagi memakai `-ExecutionPolicy Bypass` (mengurangi false positive antivirus). Sudah diuji: lokasi tetap terbaca.
- [x] `npm audit` tidak menemukan kerentanan. Electron 45.3.0 adalah versi terbaru (dicek 11 November 2026).

## 2. Bukti keaslian installer

- [x] Hash SHA-256 dibuat otomatis setiap build (`npm run dist` → `dist/SHA256SUMS.txt`, skrip [scripts/checksums.js](scripts/checksums.js))
- [ ] **Tandatangani installer (code signing).** Pilihan:
  - sertifikat OV/EV dari CA (Sectigo, DigiCert, SSL.com, dll.), atau
  - Azure Trusted Signing, atau
  - SignPath Foundation (gratis untuk proyek open source).
  Setelah ada sertifikat, isi `CSC_LINK` / `CSC_KEY_PASSWORD` atau `win.azureSignOptions` di electron-builder.
- [ ] Pindai installer di VirusTotal dan cantumkan tautan hasilnya di halaman unduhan
- [ ] Ajukan false positive ke vendor antivirus bila ada yang mendeteksi aplikasi sebagai malware

## 3. Distribusi resmi

- [ ] Halaman unduhan resmi di bantenweb.com: tombol unduh, hash SHA-256, tautan VirusTotal, Kebijakan Privasi
- [ ] Publikasikan kode sumber di GitHub (lisensi MIT sudah ada)
- [ ] Build rilis lewat GitHub Actions dengan *build provenance attestation* (`actions/attest-build-provenance`)
- [ ] Terbitkan di Microsoft Store (target `appx`/MSIX di electron-builder; akun pengembang perorangan gratis)
- [ ] Daftarkan ke winget (`winget-pkgs`)

## 4. Pembaruan

- [ ] Auto-update dengan `electron-updater` (sebaiknya setelah code signing aktif agar pembaruan juga ditandatangani)
- [ ] Rutin: perbarui Electron setiap ada rilis keamanan, lalu build ulang dan perbarui `SHA256SUMS.txt`

## 5. Transparansi

- [x] [SECURITY.md](SECURITY.md): cara melaporkan celah dan cara memastikan installer asli
- [x] [PRIVASI.md](PRIVASI.md): data apa yang disimpan, dikirim ke mana, dan cara menghapusnya
- [ ] Ganti kontak di SECURITY.md dengan email khusus keamanan (mis. `security@bantenweb.com`)
- [ ] Tampilkan tautan Kebijakan Privasi di halaman unduhan dan/atau di menu aplikasi

## 6. Kredit bantenweb.com di semua versi

- [x] Windows: footer aplikasi, menu tray, README, `package.json`
- [x] Web (`jadwal-sholat`): footer `index.html` + gaya di `app.css`, README. Versi cache service worker dinaikkan ke 1.0.2.
- [x] Mobile (`jadwal-sholat-mobile`): bagian "Tentang" di halaman Pengaturan + gaya di `styles.css`, `package.json`
- [ ] Web: deploy ulang ke server
- [ ] Mobile: `npm run sync`, lalu uji di HP bahwa tautan bantenweb.com terbuka di browser (bukan di dalam aplikasi)
