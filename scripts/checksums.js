/* Menulis dist/SHA256SUMS.txt untuk semua installer .exe di dist/.
   Cantumkan isinya di halaman unduhan agar pengguna bisa memastikan berkas tidak diubah orang lain.
   Verifikasi di Windows:  Get-FileHash .\JadwalSholat-Setup-1.0.0.exe -Algorithm SHA256 */
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

const sha256 = (file) => new Promise((resolve, reject) => {
  const h = createHash('sha256');
  createReadStream(file).on('data', (d) => h.update(d)).on('error', reject).on('end', () => resolve(h.digest('hex')));
});

const files = (await fs.readdir(DIST)).filter((f) => f.toLowerCase().endsWith('.exe')).sort();
if (!files.length) {
  console.error('Tidak ada berkas .exe di dist/. Jalankan "npm run dist" dulu.');
  process.exit(1);
}

const lines = [];
for (const f of files) lines.push(`${await sha256(path.join(DIST, f))}  ${f}`);
await fs.writeFile(path.join(DIST, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
console.log('dist/SHA256SUMS.txt\n' + lines.join('\n'));
