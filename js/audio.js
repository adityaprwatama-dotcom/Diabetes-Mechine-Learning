/* Suara dan musik game "Tangkap makanan sehat".
   Semua bunyi dibuat langsung oleh browser (Web Audio API: osilator, noise, envelope),
   jadi tidak perlu file audio dan tidak ada masalah hak cipta.

   Cara mengganti satu efek dengan file .mp3 / .ogg nanti:
     isi alamatnya di SUMBER_FILE, misalnya  tangkapSehat: "assets/audio/tangkap-sehat.mp3"
   Fungsi putar() otomatis memakai file itu; bila file gagal dimuat, suara sintesis dipakai lagi.

   Dipakai oleh js/game.js lewat objek global window.Suara. */
(() => {
  "use strict";

  const SUMBER_FILE = {
    tangkapSehat: null, tangkapAir: null, tangkapManis: null, mangkukHilang: null,
    naikLevel: null, selesai: null, klik: null, jeda: null, lanjut: null,
  };

  const KUNCI = "hc_game_suara";                 // nama simpanan pengaturan suara di localStorage
  const BAWAAN = { musik: true, efek: true, volume: 0.6 };
  const VOLUME_MUSIK = 0.32;                      // musik sengaja pelan
  const VOLUME_EFEK = 0.8;
  const BATAS_KESELURUHAN = 0.45;                 // volume total dijaga rendah agar tidak mengagetkan

  let atur = muatAturan();
  let ctx = null, utama = null, busEfek = null, filterMusik = null, derauBuffer = null;
  let boleh = false;                              // game sedang berjalan? (diatur oleh game.js)
  const bufferFile = {};

  /* ---------- pengaturan (disimpan di localStorage, aman bila penyimpanan diblokir) ---------- */
  function muatAturan() {
    try {
      const x = JSON.parse(localStorage.getItem(KUNCI));
      if (x && typeof x === "object") {
        const v = Number(x.volume);
        return { musik: x.musik !== false, efek: x.efek !== false, volume: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : BAWAAN.volume };
      }
    } catch { /* penyimpanan tidak tersedia: pakai bawaan */ }
    return { ...BAWAAN };
  }
  function simpanAturan() {
    try { localStorage.setItem(KUNCI, JSON.stringify(atur)); } catch { /* abaikan */ }
  }

  /* ---------- menyiapkan AudioContext (hanya setelah pengguna menekan tombol) ---------- */
  function siapkan() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) {
      ctx = new AC();
      const penjaga = ctx.createDynamicsCompressor();   // meredam bunyi yang terlalu keras
      utama = ctx.createGain();
      utama.connect(penjaga).connect(ctx.destination);
      busEfek = ctx.createGain();
      busEfek.connect(utama);
      filterMusik = ctx.createBiquadFilter();             // dipakai untuk musik "tegang"
      filterMusik.type = "lowpass";
      filterMusik.frequency.value = 9000;
      filterMusik.connect(utama);
      // noise putih 0,5 detik, dibuat sekali lalu dipakai ulang
      derauBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const data = derauBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      terapkanVolume();
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  function terapkanVolume() {
    if (!ctx) return;
    const t = ctx.currentTime;
    utama.gain.setTargetAtTime(atur.volume * BATAS_KESELURUHAN, t, 0.05);
    busEfek.gain.setTargetAtTime(atur.efek ? VOLUME_EFEK : 0, t, 0.02);
  }

  /* ---------- bahan dasar bunyi ---------- */
  const hz = midi => 440 * 2 ** ((midi - 69) / 12);   // nomor nada (MIDI) -> frekuensi

  // Satu nada dengan envelope pendek (cepat naik, lalu memudar).
  function nada(frek, mulai, lama, { tipe = "triangle", vol = 0.3, tujuan = busEfek, geserKe = null, detune = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipe;
    o.frequency.setValueAtTime(frek, mulai);
    if (geserKe) o.frequency.exponentialRampToValueAtTime(geserKe, mulai + lama);
    o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, mulai);
    g.gain.exponentialRampToValueAtTime(vol, mulai + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, mulai + lama);
    o.connect(g).connect(tujuan);
    o.start(mulai);
    o.stop(mulai + lama + 0.03);
  }

  // Bunyi desis/percik pendek dari noise yang disaring.
  function derau(mulai, lama, { frek = 2500, q = 1, vol = 0.25, tujuan = busEfek } = {}) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = derauBuffer;
    f.type = "bandpass"; f.frequency.value = frek; f.Q.value = q;
    g.gain.setValueAtTime(vol, mulai);
    g.gain.exponentialRampToValueAtTime(0.0001, mulai + lama);
    s.connect(f).connect(g).connect(tujuan);
    s.start(mulai);
    s.stop(mulai + lama + 0.02);
  }

  /* ---------- daftar efek suara (sintesis) ---------- */
  const SINTESIS = {
    // dua nada naik pendek yang ceria
    tangkapSehat: t => { nada(hz(76), t, 0.09, { vol: 0.25 }); nada(hz(81), t + 0.08, 0.16, { vol: 0.25 }); },
    // percik pendek lalu satu nada tinggi
    tangkapAir: t => { derau(t, 0.12, { frek: 2800, q: 0.8, vol: 0.22 }); nada(hz(88), t + 0.08, 0.18, { tipe: "sine", vol: 0.18 }); },
    // nada turun dengan dengung rendah
    tangkapManis: t => { nada(330, t, 0.35, { tipe: "sawtooth", vol: 0.08, geserKe: 150 }); nada(82, t, 0.4, { tipe: "square", vol: 0.05 }); },
    // nada turun dua langkah
    mangkukHilang: t => { nada(hz(67), t, 0.16, { tipe: "square", vol: 0.09 }); nada(hz(62), t + 0.17, 0.32, { tipe: "square", vol: 0.09 }); },
    // arpeggio naik empat nada
    naikLevel: t => [72, 76, 79, 84].forEach((m, i) => nada(hz(m), t + i * 0.08, 0.2, { vol: 0.22 })),
    // melodi turun pendek yang lembut
    selesai: t => [69, 67, 64, 62, 60].forEach((m, i) => nada(hz(m), t + i * 0.16, 0.32, { tipe: "sine", vol: 0.2 })),
    // klik halus
    klik: t => nada(1800, t, 0.035, { tipe: "sine", vol: 0.07 }),
    // jeda: dua nada turun; lanjut: dua nada naik
    jeda: t => { nada(hz(81), t, 0.08, { vol: 0.15 }); nada(hz(76), t + 0.09, 0.14, { vol: 0.15 }); },
    lanjut: t => { nada(hz(76), t, 0.08, { vol: 0.15 }); nada(hz(81), t + 0.09, 0.14, { vol: 0.15 }); },
  };

  /* ---------- SATU fungsi pemutar untuk semua efek ---------- */
  function putar(nama) {
    if (!ctx || !atur.efek || ctx.state !== "running") return;
    const t = ctx.currentTime + 0.01;
    if (SUMBER_FILE[nama]) putarFile(nama);
    else if (SINTESIS[nama]) SINTESIS[nama](t);
  }

  async function putarFile(nama) {
    try {
      if (!bufferFile[nama]) {
        const r = await fetch(SUMBER_FILE[nama]);
        bufferFile[nama] = await ctx.decodeAudioData(await r.arrayBuffer());
      }
      const s = ctx.createBufferSource();
      s.buffer = bufferFile[nama];
      s.connect(busEfek);
      s.start();
    } catch {
      SINTESIS[nama]?.(ctx.currentTime);   // file gagal: kembali ke suara sintesis
    }
  }

  /* ---------- musik latar ----------
     Tangga nada pentatonik (do re mi sol la), nuansa gambang: gelombang triangle dengan envelope pendek.
     8 birama x 8 ketukan seperdelapan, plus bass sederhana. Dijadwalkan dengan "lookahead":
     setiap 25 ms, nada untuk 0,12 detik ke depan dipesan ke jam audio, jadi ritme tetap stabil. */
  const SKALA = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];   // C D E G A C D E G A
  const MELODI = [                                           // angka = posisi di SKALA, null = diam
    5, null, 7, null, 8, 7, 5, null,
    6, null, 5, 3, 4, null, null, null,
    5, null, 7, null, 8, null, 9, 8,
    7, null, 5, null, 6, null, null, null,
    4, null, 5, null, 7, 5, 4, null,
    3, null, 4, 5, 2, null, null, null,
    4, 5, 7, null, 8, 7, 5, 4,
    5, null, null, null, null, null, null, null,
  ];
  const BASS = [48, 45, 48, 43, 45, 40, 43, 48];             // satu nada dasar per birama

  const musik = { jalan: false, langkah: 0, waktuBerikut: 0, timer: null, bpm: 110, tegang: false, bus: null };

  function musikMulai() {
    if (musik.jalan || !ctx) return;
    musik.bus = ctx.createGain();                            // jalur baru tiap mulai: tidak bertabrakan dengan yang lama
    musik.bus.gain.value = 0.0001;
    musik.bus.connect(filterMusik);
    musik.bus.gain.setTargetAtTime(VOLUME_MUSIK, ctx.currentTime, 0.15);
    musik.jalan = true;
    musik.langkah = 0;
    musik.waktuBerikut = ctx.currentTime + 0.08;
    jadwalkan();
  }

  function jadwalkan() {
    if (!musik.jalan) return;
    const seperdelapan = 60 / musik.bpm / 2;
    while (musik.waktuBerikut < ctx.currentTime + 0.12) {
      mainkanLangkah(musik.langkah, musik.waktuBerikut, seperdelapan);
      musik.waktuBerikut += seperdelapan;
      musik.langkah = (musik.langkah + 1) % MELODI.length;
    }
    musik.timer = setTimeout(jadwalkan, 25);
  }

  function mainkanLangkah(i, t, d) {
    const detune = musik.tegang ? -45 : 0;                   // saat tegang nada sedikit turun
    const m = MELODI[i];
    if (m !== null) nada(hz(SKALA[m]), t, d * 1.6, { vol: 0.2, tujuan: musik.bus, detune });
    if (i % 4 === 0) nada(hz(BASS[Math.floor(i / 8)]), t, d * 3, { tipe: "sine", vol: 0.3, tujuan: musik.bus, detune });
    if (i % 4 === 2) derau(t, 0.03, { frek: 6000, q: 2, vol: 0.04, tujuan: musik.bus });
  }

  function musikBerhenti() {
    musik.jalan = false;
    clearTimeout(musik.timer);
    if (musik.bus && ctx) {
      const b = musik.bus;
      b.gain.cancelScheduledValues(ctx.currentTime);
      b.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
      setTimeout(() => b.disconnect(), 400);
    }
    musik.bus = null;
  }

  function perbaruiMusik() {
    if (boleh && atur.musik && ctx) musikMulai();
    else musikBerhenti();
  }

  /* ---------- yang dipakai game.js ---------- */
  window.Suara = {
    siapkan,
    putar,
    // true saat sedang bermain, false saat jeda / selesai / tab disembunyikan
    setBoleh(b) { boleh = !!b; perbaruiMusik(); },
    // tempo naik sedikit tiap level (maksimal 140 bpm)
    setTempo(level) { musik.bpm = Math.min(140, 110 + (level - 1) * 4); },
    // musik terdengar lebih tegang saat gula darah di luar zona aman
    setTegang(b) {
      if (musik.tegang === !!b) return;
      musik.tegang = !!b;
      if (ctx) filterMusik.frequency.setTargetAtTime(b ? 900 : 9000, ctx.currentTime, 0.25);
    },
    aturan: () => ({ ...atur }),
    aturMusik(b) { atur.musik = !!b; simpanAturan(); perbaruiMusik(); },
    aturEfek(b) { atur.efek = !!b; simpanAturan(); terapkanVolume(); },
    aturVolume(v) { atur.volume = Math.min(1, Math.max(0, v)); simpanAturan(); terapkanVolume(); },
    musikJalan: () => musik.jalan,   // untuk pengujian
  };
})();
