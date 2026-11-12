# Kebijakan Privasi — Jadwal Sholat (Windows)

Aplikasi dibuat oleh [bantenweb.com](https://bantenweb.com). Berlaku sejak 11 November 2026.

**Ringkasnya:** tidak ada akun, iklan, telemetri, atau pelacakan. Aplikasi hanya menghubungi dua layanan publik untuk mengambil jadwal dan, bila Anda memintanya, nama kab/kota dari lokasi Anda.

## Data yang disimpan di komputer Anda

| Data | Lokasi | Keterangan |
|---|---|---|
| Kota pilihan & pengaturan (notifikasi, dll.) | Penyimpanan lokal aplikasi di `%APPDATA%\Jadwal Sholat` | Tidak dikirim ke mana pun |
| Cache jadwal, daftar kota, dan hasil pencarian lokasi | `%APPDATA%\Jadwal Sholat\jadwal-data` | Supaya aplikasi tetap bisa dipakai saat offline |

## Data yang dikirim ke pihak lain

| Tujuan | Kapan | Yang dikirim |
|---|---|---|
| `api.myquran.com` (sumber data Bimas Islam Kemenag RI) | Saat mengambil jadwal atau daftar kota | Kode kota, tahun, dan bulan |
| `nominatim.openstreetmap.org` | **Hanya** saat Anda memakai deteksi lokasi | Koordinat yang **dibulatkan sekitar 1 km** |

Seperti semua koneksi internet, kedua layanan tersebut dapat melihat alamat IP Anda. Kebijakan privasinya mengikuti masing-masing layanan.

## Lokasi

Deteksi lokasi memakai layanan lokasi Windows dan hanya berjalan saat Anda menekan tombol lokasi. Anda bisa mematikannya di **Pengaturan → Privasi & keamanan → Lokasi**. Koordinat lengkap tidak pernah dikirim. Yang dikirim hanya koordinat yang sudah dibulatkan untuk mencari nama kab/kota.

## Menghapus data

Uninstall aplikasi tidak menghapus data pengaturan secara otomatis. Untuk menghapus semuanya, hapus folder `%APPDATA%\Jadwal Sholat` setelah uninstall.

## Kontak

Pertanyaan tentang privasi: melalui [bantenweb.com](https://bantenweb.com).
