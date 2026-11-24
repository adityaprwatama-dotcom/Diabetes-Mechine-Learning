/* Landing page HealthCheck (tampil pertama setiap website dibuka).
   Diadaptasi dari komponen React "ScrollGlobe" ke JavaScript biasa:
   progress bar, titik navigasi dengan label, dan objek melayang (di sini tetesan darah)
   yang berpindah posisi/ukuran dengan halus saat bagian aktif berganti.
   - Tombol data-lp-ke="masuk|daftar" menutup landing dan membuka layar login pada tab itu.
   - Pengguna yang sesinya masih aktif langsung dibawa ke website (event "hc:akun" dari js/app.js). */
(() => {
  const lp = document.getElementById("landing");
  if (!lp) return;
  const tetes = document.getElementById("lpTetes");
  const isiProgress = document.getElementById("lpProgress");
  const navTitik = document.getElementById("lpTitik");
  const atas = lp.querySelector(".lp-atas");
  const bagian = [...lp.querySelectorAll(".lp-bagian")];

  // Posisi tetesan per bagian (seperti globeConfig.positions di kode asli)
  const POSISI = [
    { top: 52, left: 74, skala: 1.35, putar: -6, redup: 1 },     // Selamat datang: kanan
    { top: 27, left: 85, skala: 0.62, putar: 12, redup: 0.95 },  // Mengapa penting: kecil di kanan atas
    { top: 55, left: 80, skala: 1.6, putar: -10, redup: 0.95 },  // Cara kerja: kanan, besar
    { top: 50, left: 50, skala: 2.1, putar: 0, redup: 0.16 },    // Mulai sekarang: tengah, jadi latar samar
  ];
  const POSISI_HP = [
    { top: 25, left: 50, skala: 0.95, putar: -6, redup: 1 },
    { top: 14, left: 86, skala: 0.5, putar: 12, redup: 0.6 },
    { top: 18, left: 86, skala: 0.6, putar: -10, redup: 0.45 },
    { top: 50, left: 50, skala: 1.8, putar: 0, redup: 0.12 },
  ];

  let aktif = -1, menunggu = false;

  // Titik navigasi kanan + label yang muncul lalu memudar
  const titik = bagian.map((b, i) => {
    const wadah = document.createElement("div");
    const label = document.createElement("span");
    label.className = "lp-titik-label"; label.textContent = b.dataset.label || "Bagian " + (i + 1);
    const tombol = document.createElement("button");
    tombol.type = "button"; tombol.setAttribute("aria-label", "Ke bagian " + label.textContent);
    tombol.addEventListener("click", () => b.scrollIntoView({ behavior: "smooth", block: "start" }));
    wadah.append(label, tombol); navTitik.append(wadah);
    return { tombol, label };
  });

  function aturTetes(i) {
    const p = (innerWidth <= 740 ? POSISI_HP : POSISI)[i];
    tetes.style.transform = `translate3d(${p.left}vw, ${p.top}vh, 0) translate3d(-50%, -50%, 0)`;
    tetes.style.opacity = p.redup;
    tetes.style.setProperty("--lp-skala", p.skala);
    tetes.style.setProperty("--lp-putar", p.putar + "deg");
    tetes.dataset.bagian = i;
  }

  function perbarui() {
    menunggu = false;
    if (lp.hidden) return;
    const tinggi = document.documentElement.scrollHeight - innerHeight;
    const progres = tinggi > 0 ? Math.min(Math.max(scrollY / tinggi, 0), 1) : 0;
    isiProgress.style.transform = `scaleX(${progres})`;
    atas.classList.toggle("lp-bergulir", scrollY > 20);

    // Bagian aktif = bagian yang tengahnya paling dekat dengan tengah layar
    const tengah = innerHeight / 2;
    let baru = 0, jarak = Infinity;
    bagian.forEach((b, i) => {
      const r = b.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - tengah);
      if (d < jarak) { jarak = d; baru = i; }
    });
    if (baru !== aktif) {
      aktif = baru;
      aturTetes(aktif);
      titik.forEach((t, i) => {
        t.tombol.classList.toggle("aktif", i === aktif);
        t.label.classList.remove("muncul");
        if (i === aktif) { void t.label.offsetWidth; t.label.classList.add("muncul"); }
      });
    }
  }
  const saatGulir = () => { if (!menunggu) { menunggu = true; requestAnimationFrame(perbarui); } };
  addEventListener("scroll", saatGulir, { passive: true });
  addEventListener("resize", () => { aktif = -1; saatGulir(); });

  // Isi tiap bagian muncul halus saat masuk layar
  const pengamat = "IntersectionObserver" in window
    ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) e.target.classList.add("tampil"); }), { threshold: 0.2 })
    : null;
  bagian.forEach(b => pengamat ? pengamat.observe(b) : b.classList.add("tampil"));

  /* ---------- buka / tutup landing ---------- */
  function tutup(tab) {
    lp.hidden = true;
    document.body.classList.remove("lp-buka");
    scrollTo(0, 0);
    if (!tab) return;
    document.querySelector(`.tab[data-tab="${tab}"]`)?.click();
    document.querySelector(tab === "daftar" ? "#registerForm input" : "#loginForm input")?.focus({ preventScroll: true });
  }
  function buka() {
    lp.hidden = false;
    document.body.classList.add("lp-buka");
    scrollTo(0, 0);
    aktif = -1; perbarui();
  }

  lp.addEventListener("click", e => {
    const ke = e.target.closest("[data-lp-ke]");
    if (ke) { tutup(ke.dataset.lpKe); return; }
    const gulir = e.target.closest("[data-lp-gulir]");
    if (gulir) bagian[+gulir.dataset.lpGulir]?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("lpLogo").addEventListener("click", e => { e.preventDefault(); scrollTo({ top: 0, behavior: "smooth" }); });
  document.getElementById("lpKembali")?.addEventListener("click", buka);

  // Sesi masih aktif saat website dibuka: lewati landing, langsung ke website
  let pertama = true;
  document.addEventListener("hc:akun", e => {
    if (pertama && e.detail?.masuk && !lp.hidden) tutup();
    pertama = false;
  });

  perbarui();
})();
