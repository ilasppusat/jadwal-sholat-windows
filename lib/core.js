/* Logika murni (tanpa DOM/Capacitor) — porting dari api.php & src/bootstrap.php versi web.
   Dapat diuji langsung dengan `node --test`. */

export const PRAYERS = {
  imsak:   { name: 'Imsak',   ar: 'إمساك' },
  subuh:   { name: 'Subuh',   ar: 'الفجر' },
  terbit:  { name: 'Terbit',  ar: 'الشروق' },
  dhuha:   { name: 'Dhuha',   ar: 'الضحى' },
  dzuhur:  { name: 'Dzuhur',  ar: 'الظهر' },
  ashar:   { name: 'Ashar',   ar: 'العصر' },
  maghrib: { name: 'Maghrib', ar: 'المغرب' },
  isya:    { name: 'Isya',    ar: 'العشاء' },
};
export const KEYS = Object.keys(PRAYERS);
export const MAIN = ['subuh', 'dzuhur', 'ashar', 'maghrib', 'isya'];
export const AUX = new Set(['imsak', 'terbit', 'dhuha']);
export const TZ_LABEL = { 7: 'WIB', 8: 'WITA', 9: 'WIT' };
export const HOUR = 36e5, DAY = 864e5;

export const pad = (n) => String(n).padStart(2, '0');
export const titleCase = (s) => String(s).toLowerCase()
  .replace(/(^|[\s(\-/])([a-z])/g, (_, p, c) => p + c.toUpperCase());
export const fold = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
export const isValidCity = (c) => !!c && /^\d{4}$/.test(c.id) && typeof c.lokasi === 'string';

export const ymdUTC = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const addDays = (date, n) => {
  const [y, m, d] = date.split('-').map(Number);
  return ymdUTC(new Date(Date.UTC(y, m - 1, d + n)));
};
/** Waktu "dinding" kota sebagai Date UTC (tidak bergantung zona waktu perangkat). */
export const cityDate = (tz, now = Date.now()) => new Date(now + tz * HOUR);
/** "YYYY-MM-DD" + "HH:MM" waktu kota → epoch ms. */
export const toEpoch = (tz, date, hm) => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, mi) - tz * HOUR;
};

/** Hanya izinkan karakter nama wilayah yang wajar. */
export function cleanText(s, max = 80) {
  const t = String(s ?? '').replace(/[^\p{L}\p{N} .,'()/-]/gu, '').replace(/\s+/g, ' ').trim();
  return t.slice(0, max);
}

/** Offset zona waktu (WIB/WITA/WIT) berdasarkan nama provinsi. */
export function tzOffset(province) {
  const p = String(province).toUpperCase();
  if (/PAPUA|MALUKU/.test(p)) return 9;
  if (/BALI|NUSA TENGGARA|NTB|NTT|SULAWESI|GORONTALO|KALIMANTAN (SELATAN|TIMUR|UTARA)|KALSEL|KALTIM|KALTARA/.test(p)) return 8;
  return 7;
}

/** Normalisasi nama kab/kota untuk pencocokan lokasi. */
export function normRegion(s) {
  let t = String(s).toUpperCase();
  t = t.replace(/^(KOTA ADMINISTRASI|KABUPATEN ADMINISTRASI|KABUPATEN|KAB\.?|KOTA)\s+/, '');
  t = t.replaceAll('KEPULAUAN', 'KEP').replaceAll('KEP.', 'KEP');
  return t.replace(/[^A-Z0-9]+/g, ' ').trim();
}

export function regionKind(s) {
  const t = String(s).trimStart().toUpperCase();
  if (t.startsWith('KOTA')) return 'KOTA';
  if (t.startsWith('KAB')) return 'KAB';
  return null;
}

/** Validasi respons /sholat/kota/semua → [{id, lokasi}] terurut. */
export function parseCities(res) {
  if (!res || !res.status || !Array.isArray(res.data)) throw new Error('Daftar kota tidak valid.');
  const map = new Map();
  for (const row of res.data) {
    const id = String(row?.id ?? '');
    const name = cleanText(row?.lokasi);
    if (/^\d{4}$/.test(id) && name) map.set(id, name);
  }
  if (map.size < 100) throw new Error('Daftar kota tidak lengkap.');
  return [...map].map(([id, lokasi]) => ({ id, lokasi })).sort((a, b) => a.lokasi.localeCompare(b.lokasi));
}

/** Validasi respons /sholat/jadwal/{id}/{y}/{m} → format bulan internal. */
export function parseSchedule(res, id, y, m) {
  const d = res?.data;
  if (!res?.status || !d || !Array.isArray(d.jadwal)) throw new Error('Jadwal tidak valid.');
  const days = {};
  for (const row of d.jadwal) {
    const date = String(row?.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const t = {};
    let ok = true;
    for (const k of KEYS) {
      const v = String(row[k] ?? '');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) { ok = false; break; }
      t[k] = v;
    }
    if (ok) days[date] = t;
  }
  if (Object.keys(days).length < 28) throw new Error('Jadwal tidak lengkap.');
  const sorted = Object.fromEntries(Object.entries(days).sort(([a], [b]) => a.localeCompare(b)));
  const daerah = cleanText(d.daerah);
  return {
    id, lokasi: cleanText(d.lokasi), daerah, tz: tzOffset(daerah),
    month: `${y}-${pad(m)}`, days: sorted,
  };
}

/** Cocokkan komponen alamat OSM (Nominatim) dengan daftar kab/kota Kemenag. */
export function matchCity(addr, cities) {
  const order = ['city', 'town', 'county', 'municipality', 'regency', 'state_district', 'city_district', 'village', 'suburb'];
  const candidates = order.filter((k) => typeof addr[k] === 'string' && addr[k]).map((k) => [k, cleanText(addr[k])]);
  const index = cities.map((c) => ({ id: c.id, norm: normRegion(c.lokasi), kind: regionKind(c.lokasi) }));

  const pick = (hits, kind, field) => {
    if (!hits.length) return null;
    const prefer = kind ?? (field === 'city' ? 'KOTA' : 'KAB');
    return (hits.find((h) => h.kind === prefer) || hits[0]).id;
  };

  // 1) Kecocokan persis.
  for (const [field, raw] of candidates) {
    const n = normRegion(raw);
    const id = pick(index.filter((c) => c.norm === n), regionKind(raw), field);
    if (id) return id;
  }
  // 2) Kecocokan sebagian per kata (mis. "Jakarta Selatan" → "Kota Jakarta").
  for (const [field, raw] of candidates) {
    const n = ` ${normRegion(raw)} `;
    const hits = index.filter((c) => c.norm.length >= 4 && n.includes(` ${c.norm} `))
      .sort((a, b) => b.norm.length - a.norm.length);
    const id = pick(hits, regionKind(raw), field);
    if (id) return id;
  }
  return null;
}

/** Peringkat pencarian kota. */
export function searchCities(all, query, limit = 60) {
  const q = fold(query.trim()).replace(/^(kab\.?|kabupaten|kota)\s+/, '');
  if (!q) return { total: all.length, list: [] };
  const scored = [];
  for (const c of all) {
    const name = fold(titleCase(c.lokasi));
    const bare = name.replace(/^(kab\.|kota)\s+/, '');
    const pos = bare.indexOf(q);
    if (pos === -1 && name.indexOf(q) === -1) continue;
    scored.push([pos === 0 ? 0 : bare.split(/\s+/).some((w) => w.startsWith(q)) ? 1 : 2, name.startsWith('kota') ? 0 : 1, c]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].lokasi.localeCompare(b[2].lokasi));
  return { total: scored.length, list: scored.slice(0, limit).map((s) => s[2]), q };
}

/* ---------- Hijriah ---------- */
const HIJRI_MONTHS = ['Muharram', 'Safar', "Rabi'ul Awal", "Rabi'ul Akhir", 'Jumadil Awal', 'Jumadil Akhir',
  'Rajab', "Sya'ban", 'Ramadan', 'Syawal', "Dzulqa'dah", 'Dzulhijjah'];
let fmtHijriNum = null;
try {
  const f = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
  if (/^islamic/.test(f.resolvedOptions().calendar)) fmtHijriNum = f;
} catch { /* tidak didukung */ }

export function hijriTabular(d) {
  const jd = Math.floor(d.getTime() / 864e5) + 2440588;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709);
  return { day: l - Math.floor((709 * month) / 24), month, year: 30 * n + j - 30 };
}

function hijriParts(d) {
  if (fmtHijriNum) {
    try {
      const p = {};
      for (const { type, value } of fmtHijriNum.formatToParts(d)) p[type] = parseInt(value, 10);
      if (p.day >= 1 && p.day <= 30 && p.month >= 1 && p.month <= 12 && p.year > 1300) return p;
    } catch { /* fallback */ }
  }
  return hijriTabular(d);
}

export function formatHijri(d) {
  const h = hijriParts(d);
  return `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year} H`;
}

/* ---------- Penjadwalan notifikasi ---------- */
/**
 * Daftar notifikasi mendatang dari data bulan yang tersedia.
 * @param {object} o
 * @param {(date:string)=>object|null} o.dayRow  baris jadwal untuk tanggal kota
 * @param {number} o.tz
 * @param {string} o.today         tanggal kota hari ini
 * @param {number} o.now
 * @param {string[]} o.prayers     waktu yang diaktifkan
 * @param {number} o.before        menit pengingat sebelum waktu (0 = mati)
 * @param {number} o.max           batas jumlah (iOS: 64 notifikasi terjadwal)
 */
export function planNotifications({ dayRow, tz, today, now, prayers, before, max = 60, days = 8 }) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const row = dayRow(date);
    if (!row) continue;
    for (const k of KEYS) {
      if (!prayers.includes(k)) continue;
      const at = toEpoch(tz, date, row[k]);
      if (before > 0 && k !== 'imsak' && k !== 'terbit') {
        const r = at - before * 60e3;
        if (r > now + 5e3) out.push({ kind: 'remind', k, date, at: r, time: row[k] });
      }
      if (at > now + 5e3) out.push({ kind: 'adzan', k, date, at, time: row[k] });
    }
  }
  out.sort((a, b) => a.at - b.at);
  return out.slice(0, max);
}
