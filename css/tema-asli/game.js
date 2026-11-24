/* Game edukasi "Tangkap makanan sehat" (halaman game.html).
   Game ini berdiri sendiri: TIDAK memakai model machine learning dan tidak mengirim data apa pun.
   Satu-satunya panggilan ke API adalah cek login (/auth/saya), karena website wajib login.

   Isi file (urut):
     1. KONFIG            semua angka aturan main, mudah diubah
     2. Data              daftar makanan dan fakta "Tahukah kamu?"
     3. Penyimpanan       rekor tertinggi di localStorage
     4. Logika            aturan permainan (tanpa gambar, bisa diuji terpisah)
     5. Gambar            menggambar makanan, piring, dan teks di <canvas>
     6. Tampilan          skor/HUD dan perpindahan layar
     7. Kontrol           keyboard, mouse, sentuhan, tombol
     8. Mulai             cek login lalu tampilkan layar mulai */
(() => {
  "use strict";

  /* =========================================================
     1. KONFIG: ubah angka di sini untuk mengatur permainan
     ========================================================= */
  const KONFIG = {
    lebar: 700, tinggi: 440,                          // ukuran logika area bermain
    poin: { sehat: 10, air: 5, manis: -5 },           // poin tiap jenis makanan
    gulaNaik: { sehat: 5, air: 0, manis: 18 },        // kenaikan gula darah tiap jenis
    gula: {
      awal: 50, min: 0, maks: 100,
      turunPerDetik: 1.2,                             // gula turun sendiri
      batasKurang: 20,                                // di bawah ini = kurang
      batasTinggi: 70,                                // di atas ini = terlalu tinggi
      detikLuarZona: 3,                               // lama di luar zona aman sebelum mangkuk hilang
    },
    mangkukAwal: 3,
    poinPerLevel: 50,
    kecepatanJatuh: 110,                              // piksel per detik di level 1
    naikKecepatan: 0.12,                              // +12% per level
    jedaMuncul: 1.1,                                  // detik antar makanan di level 1
    turunJeda: 0.88,                                  // jeda dikali 0,88 tiap level
    jedaMinimum: 0.45,
    porsiManis: { awal: 0.30, tambahPerLevel: 0.03, maks: 0.45 },
    piring: { y: 376, lebar: 120, kecepatan: 520, tangkapAtas: 345, tangkapBawah: 392 },
    mejaY: 384,
    ukuranMakanan: 76,
  };

  /* =========================================================
     2. Data makanan dan fakta
     ========================================================= */
  // id = id gambar SVG di game.html. jenis: "sehat", "air", atau "manis".
  const MAKANAN = [
    { id: "apel", nama: "Apel", jenis: "sehat" },
    { id: "wortel", nama: "Wortel", jenis: "sehat" },
    { id: "brokoli", nama: "Brokoli", jenis: "sehat" },
    { id: "bayam", nama: "Bayam", jenis: "sehat" },
    { id: "tomat", nama: "Tomat", jenis: "sehat" },
    { id: "pepaya", nama: "Pepaya", jenis: "sehat" },
    { id: "tempe", nama: "Tempe", jenis: "sehat" },
    { id: "telur", nama: "Telur rebus", jenis: "sehat" },
    { id: "ikan", nama: "Ikan", jenis: "sehat" },
    { id: "air", nama: "Air putih", jenis: "air" },
    { id: "esteh", nama: "Es teh manis", jenis: "manis" },
    { id: "donat", nama: "Donat", jenis: "manis" },
    { id: "kue", nama: "Kue", jenis: "manis" },
    { id: "permen", nama: "Permen", jenis: "manis" },
    { id: "sirup", nama: "Sirup", jenis: "manis" },
  ];
  const BAIK = MAKANAN.filter(m => m.jenis !== "manis");   // 9 sehat + air putih
  const MANIS = MAKANAN.filter(m => m.jenis === "manis");

  // Fakta singkat tanpa angka. "sumber" diisi kelompok dari Kemenkes atau WHO.
  const FAKTA = [
    { teks: "Minuman manis seperti es teh manis dan sirup mengandung gula tambahan. Air putih tidak punya gula sama sekali, jadi lebih aman untuk gula darah.",
      ikon: [["esteh", "es teh manis"], ["air", "air putih"]], sumber: "" },
    { teks: "Sayuran seperti bayam dan brokoli kaya serat. Serat membantu gula darah naik lebih pelan setelah makan.",
      ikon: [["bayam", "bayam"], ["brokoli", "brokoli"]], sumber: "" },
    { teks: "Buah utuh seperti apel dan pepaya masih punya serat. Pilih buah utuh daripada minuman buah yang diberi gula.",
      ikon: [["apel", "apel"], ["sirup", "sirup"]], sumber: "" },
    { teks: "Tempe, telur, dan ikan adalah sumber protein. Protein membantu rasa kenyang bertahan lebih lama.",
      ikon: [["tempe", "tempe"], ["ikan", "ikan"]], sumber: "" },
    { teks: "Aktif bergerak secara teratur membantu tubuh memakai gula darah dengan lebih baik.",
      ikon: [["air", "minum air"], ["apel", "camilan buah"]], sumber: "" },
    { teks: "Diabetes tipe 2 sering tidak menimbulkan gejala di awal. Pemeriksaan gula darah berkala membantu mengetahuinya lebih dini.",
      ikon: [["telur", "makan seimbang"], ["air", "air putih"]], sumber: "" },
  ];

  /* =========================================================
     3. Penyimpanan rekor (game tetap jalan bila localStorage diblokir)
     ========================================================= */
  const KUNCI_REKOR = "hc_game_rekor";
  function bacaRekor() {
    try { const n = parseInt(localStorage.getItem(KUNCI_REKOR), 10); return n > 0 ? n : 0; } catch { return 0; }
  }
  function simpanRekor(n) {
    try { localStorage.setItem(KUNCI_REKOR, String(n)); } catch { /* abaikan */ }
  }

  /* =========================================================
     4. Logika permainan (tidak menyentuh layar)
     ========================================================= */
  const batasi = (x, a, b) => Math.min(b, Math.max(a, x));

  const Logika = {
    // "kurang" (< 20), "aman" (20 sampai 70), atau "tinggi" (> 70)
    zona(gula) {
      const G = KONFIG.gula;
      return gula < G.batasKurang ? "kurang" : gula > G.batasTinggi ? "tinggi" : "aman";
    },
    levelDariSkor: skor => 1 + Math.floor(skor / KONFIG.poinPerLevel),
    kecepatan: level => KONFIG.kecepatanJatuh * (1 + KONFIG.naikKecepatan) ** (level - 1),
    jeda: level => Math.max(KONFIG.jedaMinimum, KONFIG.jedaMuncul * KONFIG.turunJeda ** (level - 1)),
    porsiManis(level) {
      const P = KONFIG.porsiManis;
      return Math.min(P.maks, P.awal + P.tambahPerLevel * (level - 1));
    },

    buatKeadaan() {
      return {
        skor: 0, level: 1, gula: KONFIG.gula.awal, mangkuk: KONFIG.mangkukAwal,
        detikLuarZona: 0, waktuMuncul: 0.6, makanan: [], piringX: KONFIG.lebar / 2,
        tangkapan: { sehat: 0, air: 0, manis: 0 }, isiPiring: [], selesai: false,
      };
    },

    // Efek saat sebuah makanan masuk piring. Mengembalikan daftar peristiwa.
    tangkap(k, jenis) {
      const ev = [];
      const sebelum = k.skor;
      k.skor = Math.max(0, k.skor + KONFIG.poin[jenis]);          // skor tidak pernah di bawah 0
      k.gula = batasi(k.gula + KONFIG.gulaNaik[jenis], KONFIG.gula.min, KONFIG.gula.maks);
      k.tangkapan[jenis]++;
      ev.push({ tipe: "tangkap", jenis, poin: k.skor - sebelum });
      const lv = Logika.levelDariSkor(k.skor);
      if (lv > k.level) { k.level = lv; ev.push({ tipe: "naikLevel", level: lv }); }   // level tidak turun lagi
      return ev;
    },

    // Majukan permainan sebanyak dt detik. acak() bisa diganti saat pengujian.
    majukan(k, dt, acak = Math.random) {
      if (k.selesai) return [];
      const ev = [], P = KONFIG.piring, G = KONFIG.gula;

      // a) munculkan makanan baru
      k.waktuMuncul -= dt;
      while (k.waktuMuncul <= 0) {
        const daftar = acak() < Logika.porsiManis(k.level) ? MANIS : BAIK;
        const m = daftar[Math.floor(acak() * daftar.length)];
        k.makanan.push({
          id: m.id, jenis: m.jenis,
          x: 40 + acak() * (KONFIG.lebar - 80), y: -40,
          v: Logika.kecepatan(k.level) * (0.9 + acak() * 0.2),
          rot: (acak() - 0.5) * 0.6, vr: (acak() - 0.5) * 1.5,
        });
        k.waktuMuncul += Logika.jeda(k.level);
      }

      // b) gerakkan makanan, cek yang masuk piring, buang yang lolos (tanpa hukuman)
      const sisa = [];
      for (const f of k.makanan) {
        f.y += f.v * dt;
        f.rot += f.vr * dt;
        const kenaPiring = f.y >= P.tangkapAtas && f.y <= P.tangkapBawah && Math.abs(f.x - k.piringX) <= P.lebar / 2;
        if (kenaPiring) {
          k.isiPiring = [...k.isiPiring, f.id].slice(-2);
          for (const e of Logika.tangkap(k, f.jenis)) ev.push({ ...e, x: f.x, y: f.y });
        } else if (f.y < KONFIG.tinggi + 50) {
          sisa.push(f);
        }
      }
      k.makanan = sisa;

      // c) gula darah turun sendiri
      k.gula = batasi(k.gula - G.turunPerDetik * dt, G.min, G.maks);

      // d) terlalu lama di luar zona aman: mangkuk berkurang, gula kembali ke 50
      if (Logika.zona(k.gula) === "aman") k.detikLuarZona = 0;
      else k.detikLuarZona += dt;
      if (k.detikLuarZona >= G.detikLuarZona) {
        k.mangkuk--;
        k.gula = G.awal;
        k.detikLuarZona = 0;
        ev.push({ tipe: "mangkukHilang", mangkuk: k.mangkuk });
        if (k.mangkuk <= 0) { k.selesai = true; ev.push({ tipe: "selesai" }); }
      }
      return ev;
    },
  };
  // Dibuka untuk pengujian otomatis di browser (tidak dipakai bagian lain website).
  window.LogikaGame = { KONFIG, Logika, MAKANAN };

  /* =========================================================
     5. Gambar di canvas
     ========================================================= */
  const $ = s => document.querySelector(s);
  const kanvas = $("#kanvas"), c = kanvas.getContext("2d");
  const gerakKurang = window.matchMedia("(prefers-reduced-motion: reduce)");
  const WARNA = { teal: "#17504F", nasi: "#FFFDF5", kunyit: "#F4B72A", cabai: "#D63A2A", tinta: "#12292A", kayu: "#8A5A33", kayuTerang: "#A8723F" };
  const gambar = {};   // id -> { img, w, h }

  // Ubah tiap <g id="..."> di game.html menjadi gambar yang bisa digambar di canvas (sekali saja).
  function siapkanGambar() {
    const ids = MAKANAN.map(m => m.id).concat("piring");
    return Promise.all(ids.map(id => new Promise(selesai => {
      const g = document.getElementById(id);
      if (!g) return selesai();
      const [x, y, w, h] = id === "piring" ? [-66, -22, 132, 44] : [-34, -34, 68, 68];
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w * 4}" height="${h * 4}">${g.outerHTML}</svg>`;
      const img = new Image();
      img.onload = () => { gambar[id] = { img, w, h }; selesai(); };
      img.onerror = () => selesai();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    })));
  }

  // Ukuran canvas mengikuti layar, dan dikali devicePixelRatio agar tajam di layar retina.
  let sx = 1, sy = 1;
  function ukurUlang() {
    const r = kanvas.getBoundingClientRect();
    if (!r.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    kanvas.width = Math.round(r.width * dpr);
    kanvas.height = Math.round(r.height * dpr);
    sx = kanvas.width / KONFIG.lebar;
    sy = kanvas.height / KONFIG.tinggi;
    if (k) gambarAdegan(performance.now() / 1000);
  }

  function gambarBenda(id, x, y, lebar, rot = 0) {
    const g = gambar[id];
    if (!g) return;
    const s = lebar / g.w;
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    c.drawImage(g.img, -g.w * s / 2, -g.h * s / 2, g.w * s, g.h * s);
    c.restore();
  }

  function gambarAdegan(detik) {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, kanvas.width, kanvas.height);
    c.setTransform(sx, 0, 0, sy, 0, 0);
    const L = KONFIG.lebar, T = KONFIG.tinggi;

    c.fillStyle = WARNA.teal;
    c.fillRect(0, 0, L, T);
    if (!k) return;

    // Rona di tepi bila gula darah di luar zona aman
    const zona = Logika.zona(k.gula);
    if (zona !== "aman") {
      const kuat = gerakKurang.matches ? 0.35 : 0.25 + 0.15 * Math.sin(detik * 7);
      const warna = zona === "tinggi" ? "214,58,42" : "244,183,42";
      const r = c.createRadialGradient(L / 2, T / 2, T * 0.45, L / 2, T / 2, L * 0.62);
      r.addColorStop(0, `rgba(${warna},0)`);
      r.addColorStop(1, `rgba(${warna},${kuat})`);
      c.fillStyle = r;
      c.fillRect(0, 0, L, T);
    }

    // Makanan jatuh, dengan garis titik-titik kecil di atasnya
    for (const f of k.makanan) {
      if (!gerakKurang.matches) {
        c.strokeStyle = "rgba(255,253,245,.22)";
        c.lineWidth = 2.5; c.lineCap = "round"; c.setLineDash([1, 7]);
        c.beginPath();
        c.moveTo(f.x, f.y - 40); c.lineTo(f.x, f.y - 66);
        c.moveTo(f.x - 8, f.y - 44); c.lineTo(f.x - 8, f.y - 60);
        c.moveTo(f.x + 8, f.y - 44); c.lineTo(f.x + 8, f.y - 60);
        c.stroke();
        c.setLineDash([]);
      }
      gambarBenda(f.id, f.x, f.y, KONFIG.ukuranMakanan, gerakKurang.matches ? 0 : f.rot);
    }

    // Meja warung
    c.fillStyle = WARNA.kayu; c.fillRect(0, KONFIG.mejaY, L, T - KONFIG.mejaY);
    c.fillStyle = WARNA.kayuTerang; c.fillRect(0, KONFIG.mejaY, L, 6);

    // Piring dan dua makanan terakhir di atasnya
    const px = k.piringX, py = KONFIG.piring.y;
    gambarBenda("piring", px, py, 132);
    k.isiPiring.forEach((id, i) => gambarBenda(id, px + (i ? 20 : -18), py - (i ? 22 : 18), 38));

    // Teks melayang (+10, gula naik, dan lainnya)
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const t of teks) {
      const umur = t.umur / t.lama;
      const naik = gerakKurang.matches ? 0 : -40 * umur;
      c.globalAlpha = 1 - umur;
      if (t.kotak) {
        c.font = "700 14px 'DM Sans', sans-serif";
        const w = c.measureText(t.isi).width + 20;
        c.fillStyle = t.warna;
        c.beginPath();
        c.roundRect ? c.roundRect(t.x - w / 2, t.y + naik - 13, w, 26, 4) : c.rect(t.x - w / 2, t.y + naik - 13, w, 26);
        c.fill();
        c.fillStyle = WARNA.nasi;
        c.fillText(t.isi, t.x, t.y + naik + 1);
      } else {
        c.font = `800 ${t.besar || 20}px Manrope, sans-serif`;
        c.lineWidth = 4; c.strokeStyle = "rgba(18,41,42,.6)";
        c.strokeText(t.isi, t.x, t.y + naik);
        c.fillStyle = t.warna;
        c.fillText(t.isi, t.x, t.y + naik);
      }
    }
    c.globalAlpha = 1;
  }

  /* =========================================================
     6. Tampilan: HUD dan perpindahan layar
     ========================================================= */
  let k = null;            // keadaan permainan yang sedang berjalan
  let mode = "cek";        // "cek", "mulai", "daftar", "main", "jeda", "selesai"
  let teks = [];           // teks melayang di canvas
  let indeksFakta = Math.floor(Math.random() * FAKTA.length);
  const terakhirHud = {};  // nilai HUD terakhir, supaya halaman tidak diubah tiap frame

  const svgUse = (id, kelas = "") => `<svg ${kelas ? `class="${kelas}" ` : ""}viewBox="-34 -34 68 68" aria-hidden="true"><use href="#${id}"/></svg>`;

  function isiDaftarMakanan() {
    $("#ikonBaik").innerHTML = BAIK.map(m => `<li title="${m.nama}">${svgUse(m.id)}<span class="sr-only">${m.nama}</span></li>`).join("");
    $("#ikonManis").innerHTML = MANIS.map(m => `<li title="${m.nama}">${svgUse(m.id)}<span class="sr-only">${m.nama}</span></li>`).join("");
    $("#daftarBaik").innerHTML = BAIK.map(m => `<li>${svgUse(m.id)}<span>${m.nama}</span></li>`).join("");
    $("#daftarManis").innerHTML = MANIS.map(m => `<li>${svgUse(m.id)}<span>${m.nama}</span></li>`).join("");
    $("#hudMangkuk").innerHTML = Array.from({ length: KONFIG.mangkukAwal },
      () => '<svg viewBox="-15 -7 30 20" aria-hidden="true"><use href="#mangkuk"/></svg>').join("");
  }

  // Tampilkan satu layar saja sesuai mode.
  function tampilkan(fokus) {
    $("#layarMulai").hidden = mode !== "mulai";
    $("#layarDaftar").hidden = mode !== "daftar";
    $("#arena").hidden = !(mode === "main" || mode === "jeda");
    $("#layarJeda").hidden = mode !== "jeda";
    $("#layarSelesai").hidden = mode !== "selesai";
    if (fokus) fokus.focus({ preventScroll: true });
    if (mode === "main" || mode === "jeda") ukurUlang();
  }

  function umumkan(t) { $("#pengumuman").textContent = t; }

  function perbaruiHUD(paksa) {
    const ubah = (kunci, nilai, fn) => { if (paksa || terakhirHud[kunci] !== nilai) { terakhirHud[kunci] = nilai; fn(nilai); } };
    ubah("skor", k.skor, v => { $("#hudSkor").textContent = v; });
    ubah("level", k.level, v => { $("#hudLevel").textContent = `Level ${v}`; });
    const gula = Math.round(k.gula), zona = Logika.zona(k.gula);
    ubah("gula", gula, v => {
      $("#penanda").style.left = v + "%";
      const bar = $("#barGula");
      bar.setAttribute("aria-valuenow", v);
      bar.setAttribute("aria-valuetext", `${v}, ${zona === "aman" ? "aman" : zona === "tinggi" ? "terlalu tinggi" : "kurang"}`);
    });
    ubah("zona", zona, v => $("#hudGula").classList.toggle("bahaya", v !== "aman"));
    const sisaDetik = zona === "aman" ? 0 : Math.max(1, Math.ceil(KONFIG.gula.detikLuarZona - k.detikLuarZona));
    const pesan = zona === "aman" ? "" : zona === "tinggi"
      ? `gula terlalu tinggi, hindari yang manis (${sisaDetik})`
      : `gula kurang, tangkap makanan sehat (${sisaDetik})`;
    ubah("pesan", pesan, v => { const p = $("#peringatan"); p.textContent = v; p.hidden = !v; });
    ubah("mangkuk", k.mangkuk, v => {
      document.querySelectorAll("#hudMangkuk svg").forEach((s, i) => s.classList.toggle("hilang", i >= v));
      $("#hudMangkuk").setAttribute("aria-label", `${v} mangkuk tersisa`);
    });
  }

  function tambahTeks(isi, x, y, opsi = {}) {
    teks.push({ isi, x, y, umur: 0, lama: gerakKurang.matches ? 0.7 : 0.9, warna: WARNA.kunyit, ...opsi });
  }

  // Menanggapi peristiwa dari logika: teks melayang, suara, dan pengumuman untuk pembaca layar.
  function tanganiPeristiwa(e) {
    if (e.tipe === "tangkap") {
      if (e.jenis === "manis") {
        tambahTeks("gula naik", e.x, e.y - 30, { kotak: true, warna: WARNA.cabai });
        if (e.poin) tambahTeks(String(e.poin), e.x + 44, e.y - 52, { warna: "#ff8a7a", besar: 16 });
        Suara.putar("tangkapManis");
      } else {
        tambahTeks(`+${e.poin}`, e.x, e.y - 34);
        Suara.putar(e.jenis === "air" ? "tangkapAir" : "tangkapSehat");
      }
    } else if (e.tipe === "naikLevel") {
      tambahTeks(`level ${e.level}`, KONFIG.lebar / 2, 200, { besar: 34, lama: 1.4 });
      Suara.setTempo(e.level);
      Suara.putar("naikLevel");
      umumkan(`Naik ke level ${e.level}`);
    } else if (e.tipe === "mangkukHilang") {
      if (e.mangkuk > 0) {
        tambahTeks("mangkuk hilang", KONFIG.lebar / 2, 230, { kotak: true, warna: WARNA.cabai, lama: 1.4 });
        Suara.putar("mangkukHilang");
        umumkan(`Mangkuk hilang. Sisa ${e.mangkuk}. Gula darah kembali ke 50.`);
      }
    } else if (e.tipe === "selesai") {
      akhiri();
    }
  }

  /* ---------- putaran permainan (requestAnimationFrame + selisih waktu) ---------- */
  let rafId = 0, waktuLalu = 0;
  const tekan = { kiri: false, kanan: false };
  let targetX = null;   // posisi tujuan piring dari mouse/jari

  function gerakPiring(dt) {
    const P = KONFIG.piring, min = P.lebar / 2, maks = KONFIG.lebar - P.lebar / 2;
    const arah = (tekan.kanan ? 1 : 0) - (tekan.kiri ? 1 : 0);
    if (arah) { targetX = null; k.piringX += arah * P.kecepatan * dt; }
    else if (targetX !== null) {
      const selisih = targetX - k.piringX, langkah = 1400 * dt;
      k.piringX += Math.abs(selisih) <= langkah ? selisih : Math.sign(selisih) * langkah;
    }
    k.piringX = batasi(k.piringX, min, maks);
  }

  function putaran(t) {
    rafId = requestAnimationFrame(putaran);
    const dt = Math.min(0.05, Math.max(0, (t - waktuLalu) / 1000));   // dibatasi agar tidak "melompat"
    waktuLalu = t;
    if (mode !== "main") return;
    gerakPiring(dt);
    const ev = Logika.majukan(k, dt);
    teks = teks.filter(x => (x.umur += dt) < x.lama);
    Suara.setTegang(Logika.zona(k.gula) !== "aman");
    ev.forEach(tanganiPeristiwa);
    if (mode !== "main") return;   // permainan baru saja selesai
    perbaruiHUD();
    gambarAdegan(t / 1000);
  }
  function mulaiPutaran() { cancelAnimationFrame(rafId); waktuLalu = performance.now(); rafId = requestAnimationFrame(putaran); }
  function berhentiPutaran() { cancelAnimationFrame(rafId); }

  /* ---------- pindah keadaan ---------- */
  function mulaiMain() {
    Suara.siapkan();                      // suara baru boleh dibuat setelah pengguna menekan tombol
    Suara.setBoleh(false);                // hentikan musik lama dulu agar tidak bertabrakan
    k = Logika.buatKeadaan();
    teks = []; targetX = null; tekan.kiri = tekan.kanan = false;
    Suara.setTempo(1); Suara.setTegang(false);
    mode = "main";
    tampilkan($("#arena"));
    perbaruiHUD(true);
    gambarAdegan(0);
    umumkan("Permainan dimulai. Gula darah 50, zona aman.");
    Suara.setBoleh(true);
    mulaiPutaran();
  }

  function jeda() {
    if (mode !== "main") return;
    mode = "jeda";
    berhentiPutaran();
    Suara.setBoleh(false);
    Suara.putar("jeda");
    tekan.kiri = tekan.kanan = false;
    tampilkan($("#tblLanjut"));
  }

  function lanjut() {
    if (mode !== "jeda") return;
    mode = "main";
    tampilkan($("#arena"));
    Suara.putar("lanjut");
    Suara.setBoleh(true);
    mulaiPutaran();
  }

  function keMenu() {
    berhentiPutaran();
    Suara.setBoleh(false);
    Suara.setTegang(false);
    k = null;
    mode = "mulai";
    tampilkan($("#tblMulai"));
  }

  function akhiri() {
    mode = "selesai";
    berhentiPutaran();
    Suara.setBoleh(false);
    Suara.setTegang(false);
    Suara.putar("selesai");
    const rekorLama = bacaRekor(), rekorBaru = k.skor > rekorLama;
    if (rekorBaru) simpanRekor(k.skor);
    $("#akhirSkor").textContent = k.skor;
    $("#akhirRekor").textContent = rekorBaru && k.skor > 0 ? "poin, rekor baru!" : `poin, rekor kamu ${Math.max(rekorLama, k.skor)}`;
    $("#akhirBaik").textContent = `${k.tangkapan.sehat + k.tangkapan.air} makanan sehat masuk piring`;
    $("#akhirManis").textContent = `${k.tangkapan.manis} makanan manis ikut tertangkap`;
    tampilkanFakta();
    tampilkan($("#tblLagi"));
    umumkan(`Selesai. Skor ${k.skor}.`);
  }

  function tampilkanFakta() {
    const f = FAKTA[indeksFakta];
    indeksFakta = (indeksFakta + 1) % FAKTA.length;
    $("#faktaTeks").textContent = f.teks;
    $("#faktaIkon").innerHTML = f.ikon.map(([id, label]) => `<figure>${svgUse(id)}<figcaption>${label}</figcaption></figure>`).join("");
    $("#faktaSumber").textContent = "Sumber: " + (f.sumber || "(diisi dari Kemenkes atau WHO)");
  }

  /* =========================================================
     7. Kontrol
     ========================================================= */
  $("#tblMulai").addEventListener("click", mulaiMain);
  $("#tblLagi").addEventListener("click", mulaiMain);
  $("#tblJeda").addEventListener("click", jeda);
  $("#tblLanjut").addEventListener("click", lanjut);
  $("#tblKeMenu").addEventListener("click", keMenu);
  $("#tblFaktaLain").addEventListener("click", tampilkanFakta);
  $("#tblDaftar").addEventListener("click", () => { mode = "daftar"; tampilkan($("#tblTutupDaftar")); });
  $("#tblTutupDaftar").addEventListener("click", () => { mode = "mulai"; tampilkan($("#tblDaftar")); });

  // Klik halus untuk semua tombol (setelah suara disiapkan)
  document.addEventListener("click", e => { if (e.target.closest("button")) Suara.putar("klik"); });

  window.addEventListener("keydown", e => {
    if (e.target.closest && e.target.closest("input")) return;   // jangan ganggu slider volume
    const t = e.key.toLowerCase();
    if (mode === "main") {
      if (t === "arrowleft" || t === "a") { tekan.kiri = true; e.preventDefault(); }
      if (t === "arrowright" || t === "d") { tekan.kanan = true; e.preventDefault(); }
      if (t === "p" || t === "escape") { e.preventDefault(); jeda(); }
    } else if (mode === "jeda") {
      if (t === "p" || t === "escape") { e.preventDefault(); lanjut(); }
    } else if (t === "enter" && !e.target.closest("button, a")) {
      // Enter di tombol sudah menekan tombol itu sendiri; di tempat lain Enter = mulai
      if ((mode === "mulai" && !$("#tblMulai").disabled) || mode === "selesai") { e.preventDefault(); mulaiMain(); }
    }
  });
  window.addEventListener("keyup", e => {
    const t = e.key.toLowerCase();
    if (t === "arrowleft" || t === "a") tekan.kiri = false;
    if (t === "arrowright" || t === "d") tekan.kanan = false;
  });
  window.addEventListener("blur", () => { tekan.kiri = tekan.kanan = false; });

  // Mouse dan jari: piring mengikuti posisi pointer di area bermain
  function arahkanKe(e) {
    if (mode !== "main" || e.target.closest("button")) return;
    const r = kanvas.getBoundingClientRect();
    targetX = (e.clientX - r.left) / r.width * KONFIG.lebar;
  }
  $("#arena").addEventListener("pointerdown", arahkanKe);
  $("#arena").addEventListener("pointermove", arahkanKe);

  // Tab disembunyikan: otomatis jeda
  document.addEventListener("visibilitychange", () => { if (document.hidden) jeda(); });
  new ResizeObserver(ukurUlang).observe(kanvas);

  // Pengaturan suara
  function tampilkanAturanSuara() {
    const a = Suara.aturan();
    $("#tblMusik").setAttribute("aria-pressed", a.musik);
    $("#labelMusik").textContent = a.musik ? "musik: hidup" : "musik: mati";
    $("#tblEfek").setAttribute("aria-pressed", a.efek);
    $("#labelEfek").textContent = a.efek ? "efek suara: hidup" : "efek suara: mati";
    $("#volume").value = Math.round(a.volume * 100);
  }
  $("#tblMusik").addEventListener("click", () => { Suara.aturMusik(!Suara.aturan().musik); tampilkanAturanSuara(); });
  $("#tblEfek").addEventListener("click", () => { Suara.aturEfek(!Suara.aturan().efek); tampilkanAturanSuara(); });
  $("#volume").addEventListener("input", e => Suara.aturVolume(e.target.value / 100));
  tampilkanAturanSuara();

  /* =========================================================
     8. Mulai: cek login dulu (website wajib login)
     ========================================================= */
  const HOST = ["localhost", "127.0.0.1"].includes(location.hostname) ? location.hostname : "127.0.0.1";
  const API = `http://${HOST}:8000`;

  async function cekLogin() {
    try {
      const r = await fetch(API + "/auth/saya", { credentials: "include" });
      const d = await r.json();
      if (!d.masuk) { location.replace("index.html"); return false; }   // belum masuk: ke layar Masuk
      $("#namaPemain").textContent = `Pemain: ${d.pengguna.nama}`;
      return true;
    } catch {
      $("#cekAkunTeks").textContent = "Tidak dapat terhubung ke API. Pastikan python app.py berjalan pada port 8000, lalu muat ulang halaman ini.";
      $("#cekAkunLink").hidden = false;
      return false;
    }
  }

  isiDaftarMakanan();
  cekLogin().then(ok => {
    if (!ok) return;
    $("#cekAkun").hidden = true;
    $("#papan").hidden = false;
    mode = "mulai";
    tampilkan();
    siapkanGambar().then(() => {
      const b = $("#tblMulai");
      b.disabled = false;
      b.textContent = "Mulai main";
    });
  });
})();
