# Kebijakan Keamanan

Aplikasi dibuat oleh [bantenweb.com](https://bantenweb.com).

## Versi yang didukung

Perbaikan keamanan hanya diberikan untuk versi terbaru. Selalu pakai installer terbaru dari sumber resmi.

| Versi | Didukung |
|---|---|
| 1.0.x (terbaru) | Ya |
| Lebih lama | Tidak |

## Melaporkan celah keamanan

Jika Anda menemukan celah keamanan, **jangan umumkan di tempat publik** (media sosial, issue publik) sebelum diperbaiki.

Kirim laporan secara pribadi melalui kontak di [bantenweb.com](https://bantenweb.com). Sertakan:

- versi aplikasi dan versi Windows,
- langkah untuk mereproduksi masalah,
- dampak yang Anda perkirakan.

Kami berusaha membalas dalam 7 hari dan merilis perbaikan secepatnya. Pelapor akan disebut namanya di catatan rilis bila bersedia.

## Memastikan installer asli

Unduh hanya dari sumber resmi (bantenweb.com). Setiap rilis disertai berkas `SHA256SUMS.txt`. Cocokkan hash installer Anda dengan PowerShell:

```powershell
Get-FileHash .\JadwalSholat-Setup-1.0.0.exe -Algorithm SHA256
```

Jika hasilnya berbeda dengan yang tercantum di halaman unduhan resmi, **jangan jalankan berkas tersebut**.

## Perlindungan yang diterapkan

- Tampilan aplikasi berjalan terisolasi (`contextIsolation`, `sandbox`, tanpa `nodeIntegration`). Tampilan tidak bisa mengakses berkas atau menjalankan perintah.
- Hanya 3 fungsi yang dibuka ke tampilan: lokasi, notifikasi, dan teks tooltip tray.
- Content Security Policy ketat. Semua tampilan dimuat dari berkas lokal di dalam aplikasi, dan tidak ada skrip dari internet.
- Navigasi keluar aplikasi diblokir. Tautan luar dibuka di browser bawaan.
- Izin browser hanya notifikasi. Kamera, mikrofon, dan izin lain selalu ditolak.
- **Electron Fuses** dikunci saat build:
  - `RunAsNode`, `NODE_OPTIONS`, dan `--inspect` dimatikan, sehingga `.exe` tidak bisa disalahgunakan untuk menjalankan kode lain.
  - Pemeriksaan keutuhan `app.asar` aktif: jika isi aplikasi diubah, aplikasi menolak berjalan.
  - Aplikasi hanya dimuat dari `app.asar`.
- Tidak butuh hak administrator.
- Tidak ada telemetri, iklan, atau pelacakan. Lihat [PRIVASI.md](PRIVASI.md).
