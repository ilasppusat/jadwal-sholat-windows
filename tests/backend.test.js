import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBackend } from '../lib/backend.js';

const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'js-desk-'));
const be = createBackend({ cacheDir, seedCitiesFile: new URL('../seed/cities.json', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') });
const q = (o) => new URLSearchParams(o);

test('aksi tidak dikenal → 404', async () => {
  const r = await be.handle(q({ action: 'x' }));
  assert.equal(r.status, 404); assert.equal(r.body.ok, false);
});

test('validasi parameter jadwal', async () => {
  assert.equal((await be.handle(q({ action: 'schedule', city: '9999', year: '2026', month: '1' }))).status, 404);
  assert.equal((await be.handle(q({ action: 'schedule', city: '1301', year: '1999', month: '1' }))).status, 400);
  assert.equal((await be.handle(q({ action: 'locate', lat: '40', lon: '10' }))).status, 422);
});

test('daftar kota & jadwal bulan ini (jaringan)', async () => {
  const c = await be.handle(q({ action: 'cities' }));
  assert.equal(c.status, 200); assert.ok(c.body.data.length > 400);
  const d = new Date();
  const s = await be.handle(q({ action: 'schedule', city: '1301', year: String(d.getFullYear()), month: String(d.getMonth() + 1) }));
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.ok(Object.keys(s.body.data.days).length >= 28);
  assert.equal(s.body.data.tz, 7);
  assert.ok(fs.readdirSync(cacheDir).some((f) => f.startsWith('jadwal_1301')));
});

test('deteksi kota dari koordinat (Bogor)', async () => {
  const r = await be.handle(q({ action: 'locate', lat: '-6.597', lon: '106.799' }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.data.lokasi, /BOGOR/);
});
