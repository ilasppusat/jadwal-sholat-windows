/* Pengganti api.php untuk versi desktop: proxy + cache berkas ke MyQuran (Kemenag) & Nominatim.
   Berjalan di main process Electron; dipanggil lewat app://jadwal/api.php?action=… */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseCities, parseSchedule, matchCity, pad } from './core.js';

const UPSTREAM_BASE = 'https://api.myquran.com/v2';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'JadwalSholat-Desktop/1.0 (Windows prayer times app)';
const HTTP_TIMEOUT = 8000;
const MAX_BODY = 2_000_000;
const DAY_S = 86400;

export class ApiError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

export function createBackend({ cacheDir, seedCitiesFile }) {
  const inflight = new Map();
  let nominatimLast = 0;

  async function httpGetJson(url) {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      redirect: 'error',
      signal: AbortSignal.timeout(HTTP_TIMEOUT),
    });
    if (res.status !== 200) throw new Error(`Upstream gagal (${res.status})`);
    const text = await res.text();
    if (text.length > MAX_BODY) throw new Error('Respons upstream terlalu besar');
    return JSON.parse(text);
  }

  const cacheFile = (key) => path.join(cacheDir, key.replace(/[^a-z0-9_-]/gi, '_') + '.json');

  async function readCache(key) {
    try {
      const c = JSON.parse(await fs.readFile(cacheFile(key), 'utf8'));
      return c && typeof c.t === 'number' && c.d ? c : null;
    } catch { return null; }
  }

  async function writeCache(key, data) {
    try {
      await fs.mkdir(cacheDir, { recursive: true });
      const file = cacheFile(key);
      const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify({ t: Math.floor(Date.now() / 1000), d: data }));
      await fs.rename(tmp, file);
    } catch { /* cache gagal ditulis: abaikan */ }
  }

  /** Cache segar → pakai; jika tidak, ambil dari upstream; bila gagal, pakai data lama (stale-if-error). */
  async function remember(key, ttl, fetcher, fallback = null) {
    const cached = await readCache(key);
    if (cached && Date.now() / 1000 - cached.t < ttl) return cached.d;
    if (inflight.has(key)) return inflight.get(key);
    const p = (async () => {
      try {
        const data = await fetcher();
        await writeCache(key, data);
        return data;
      } catch (e) {
        console.warn('[jadwal-sholat]', key, e.message);
        if (cached) return cached.d;
        const fb = fallback ? await fallback() : null;
        if (fb) return fb;
        throw new ApiError('Server Kemenag sedang tidak dapat dihubungi. Periksa koneksi internet lalu coba lagi.', 502);
      }
    })().finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  async function seedCities() {
    try { return JSON.parse(await fs.readFile(seedCitiesFile, 'utf8')); } catch { return null; }
  }

  const cities = () => remember('cities', 30 * DAY_S,
    async () => parseCities(await httpGetJson(`${UPSTREAM_BASE}/sholat/kota/semua`)),
    seedCities);

  const intParam = (q, name, min, max) => {
    const v = q.get(name);
    if (!v || !/^\d{1,4}$/.test(v) || +v < min || +v > max) throw new ApiError(`Parameter '${name}' tidak valid.`);
    return +v;
  };

  async function schedule(q) {
    const city = q.get('city') || '';
    const list = await cities();
    if (!/^\d{4}$/.test(city) || !list.some((c) => c.id === city)) throw new ApiError('Kota tidak ditemukan.', 404);
    const now = new Date();
    const year = intParam(q, 'year', now.getFullYear() - 1, now.getFullYear() + 1);
    const month = intParam(q, 'month', 1, 12);
    const ym = `${year}-${pad(month)}`;
    const isPast = ym < `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    return remember(`jadwal_${city}_${ym}`, (isPast ? 60 : 7) * DAY_S, async () => {
      const res = await httpGetJson(`${UPSTREAM_BASE}/sholat/jadwal/${city}/${year}/${pad(month)}`);
      return parseSchedule(res, city, year, month);
    });
  }

  async function locate(q) {
    let lat = parseFloat(q.get('lat')), lon = parseFloat(q.get('lon'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -11.5 || lat > 6.5 || lon < 94.5 || lon > 141.5) {
      throw new ApiError('Lokasi berada di luar wilayah Indonesia.', 422);
    }
    // Dibulatkan (~1 km) demi privasi dan efisiensi cache.
    lat = Math.round(lat * 100) / 100;
    lon = Math.round(lon * 100) / 100;
    const addr = await remember(`geo_${lat.toFixed(2)}_${lon.toFixed(2)}`, 180 * DAY_S, async () => {
      // Kebijakan Nominatim: maks. 1 request/detik.
      const wait = 1100 - (Date.now() - nominatimLast);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      nominatimLast = Date.now();
      const qs = new URLSearchParams({
        format: 'jsonv2', lat: String(lat), lon: String(lon), zoom: '14', addressdetails: '1', 'accept-language': 'id',
      });
      const res = await httpGetJson(`${NOMINATIM_BASE}/reverse?${qs}`);
      if (!res || typeof res.address !== 'object') throw new Error('Alamat tidak ditemukan');
      return Object.fromEntries(Object.entries(res.address).filter(([, v]) => typeof v === 'string'));
    });
    const list = await cities();
    const id = matchCity(addr, list);
    if (!id) throw new ApiError('Kab/kota untuk lokasi Anda belum ditemukan. Silakan pilih manual.', 404);
    return { id, lokasi: list.find((c) => c.id === id).lokasi };
  }

  /** Tangani satu request API; mengembalikan { status, body }. */
  async function handle(searchParams) {
    try {
      const action = searchParams.get('action') || '';
      const data = action === 'cities' ? await cities()
        : action === 'schedule' ? await schedule(searchParams)
        : action === 'locate' ? await locate(searchParams)
        : (() => { throw new ApiError('Aksi tidak dikenal.', 404); })();
      return { status: 200, body: { ok: true, data } };
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 500;
      if (!(e instanceof ApiError)) console.error('[jadwal-sholat]', e);
      return { status, body: { ok: false, error: e instanceof ApiError ? e.message : 'Terjadi kesalahan pada aplikasi.' } };
    }
  }

  return { handle };
}
