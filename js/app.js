/* HealthCheck: navigasi, form cek risiko, riwayat, login, dan dasbor admin.
   Tamu  : riwayat disimpan di localStorage browser.
   Login : riwayat disimpan di database lewat API (cookie sesi, credentials: "include"). */
(() => {
  // Alamat API memakai nama host yang sama dengan halaman (127.0.0.1 atau localhost) agar cookie login terkirim.
  const HOST = ["localhost", "127.0.0.1"].includes(location.hostname) ? location.hostname : "127.0.0.1";
  const API = (window.API_BASE_URL || `http://${HOST}:8000`).replace(/\/$/, "");
  const KEY = "healthcheck_history_v1";
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const NAMA_HALAMAN = { beranda: "Beranda", cek: "Cek Risiko", riwayat: "Riwayat", edukasi: "Edukasi", profil: "Profil", akun: "Akun", admin: "Dasbor Admin" };
  let akun = null;   // pengguna yang sedang login, atau null

  /* ---------- panggilan API ---------- */
  async function panggil(path, opsi = {}) {
    const r = await fetch(API + path, {
      method: opsi.method || "GET",
      credentials: "include",
      headers: opsi.body ? { "Content-Type": "application/json" } : {},
      body: opsi.body ? JSON.stringify(opsi.body) : undefined,
    });
    let data = {};
    try { data = await r.json(); } catch { /* jawaban kosong */ }
    if (!r.ok) throw Object.assign(new Error(data.error || "Permintaan gagal diproses."), { status: r.status });
    return data;
  }
  const pesanKoneksi = ex => (ex.message || "").includes("Failed to fetch")
    ? "Tidak dapat terhubung ke API. Pastikan python app.py berjalan pada port 8000." : ex.message;

  /* ---------- navigasi ---------- */
  function page(id) {
    if (!document.getElementById(id)) id = "beranda";
    if (id === "admin" && akun?.peran !== "admin") id = akun ? "beranda" : "akun";
    $$(".page").forEach(x => x.classList.toggle("active", x.id === id));
    $$("[data-nav]").forEach(x => x.classList.toggle("active", x.dataset.nav === id));
    $("#pageName").textContent = NAMA_HALAMAN[id] || "Beranda";
    history.replaceState(null, "", "#" + id);
    $("#sidebar").classList.remove("open");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (id === "riwayat") muatRiwayat();
    if (id === "admin") muatAdmin();
  }
  $$("a[href^='#']").forEach(a => a.addEventListener("click", e => {
    const id = a.getAttribute("href").slice(1);
    if (document.getElementById(id)) { e.preventDefault(); page(id); }
  }));
  $("#menuToggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  const now = new Date();
  $("#todayLabel").textContent = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
  $("#dateText").textContent = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  /* ---------- riwayat ---------- */
  const bacaLokal = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
  const simpanLokal = a => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* penyimpanan diblokir */ } };
  const pill = label => `<span class="pill ${label === "Risiko tinggi" ? "high" : "low"}">${esc(label)}</span>`;

  function tampilkanRiwayat(baris) {
    $("#historyBody").innerHTML = baris.length
      ? baris.map(x => `<tr><td>${esc(x.date)}</td><td>${esc(x.age)} tahun</td><td>${pill(x.label)}</td><td>${Math.round(x.probability * 100)}%</td></tr>`).join("")
      : '<tr><td colspan="4" class="empty">Belum ada riwayat pemeriksaan.</td></tr>';
    $("#totalChecks").textContent = baris.length;
  }

  async function muatRiwayat() {
    if (!akun) return tampilkanRiwayat(bacaLokal());
    try {
      const d = await panggil("/riwayat");
      tampilkanRiwayat(d.riwayat.map(r => ({ date: r.waktu, age: r.input.age, label: r.label, probability: r.skor })));
    } catch (ex) {
      $("#historyBody").innerHTML = `<tr><td colspan="4" class="empty">${esc(pesanKoneksi(ex))}</td></tr>`;
    }
  }

  $("#clearHistory").addEventListener("click", async () => {
    const tempat = akun ? "di akun Anda (database)" : "di browser ini";
    if (!confirm(`Hapus seluruh riwayat pemeriksaan ${tempat}?`)) return;
    if (!akun) { simpanLokal([]); return muatRiwayat(); }
    try { await panggil("/riwayat", { method: "DELETE" }); } catch (ex) { alert(pesanKoneksi(ex)); }
    muatRiwayat();
  });

  /* ---------- form cek risiko ---------- */
  function bmi() {
    const w = +$("#weight").value, h = +$("#height").value / 100;
    if (w > 0 && h > 0) {
      const n = w / (h * h);
      $("#bmiValue").textContent = n.toFixed(1);
      $("#bmiStatus").textContent = n < 18.5 ? "Di bawah rentang normal" : n < 25 ? "Rentang normal" : n < 30 ? "Berat badan berlebih" : "Obesitas";
      return +n.toFixed(2);
    }
    $("#bmiValue").textContent = "—";
    $("#bmiStatus").textContent = "Isi berat & tinggi badan";
    return null;
  }
  $("#weight").addEventListener("input", bmi);
  $("#height").addEventListener("input", bmi);
  $("#riskForm").addEventListener("reset", () => setTimeout(() => { $("#formError").hidden = true; $("#resultPanel").hidden = true; bmi(); }, 0));
  // Sembunyikan hasil lama begitu isian form diubah, supaya hasil tidak tertukar dengan data baru.
  const hideResult = () => { $("#resultPanel").hidden = true; };
  $("#riskForm").addEventListener("input", hideResult);
  $("#riskForm").addEventListener("change", hideResult);

  $("#riskForm").addEventListener("submit", async e => {
    e.preventDefault();
    const form = e.currentTarget, err = $("#formError"), btn = $("#submitBtn");
    err.hidden = true; hideResult();
    if (!form.reportValidity()) return;
    const n = bmi();
    if (n === null) { err.textContent = "Masukkan berat dan tinggi badan untuk menghitung BMI."; err.hidden = false; return; }
    const f = new FormData(form);
    const data = {
      gender: f.get("gender"), age: +f.get("age"), hypertension: +f.get("hypertension"), heart_disease: +f.get("heart_disease"),
      smoking_history: f.get("smoking_history"), bmi: n, blood_glucose_level: +f.get("blood_glucose_level"),
    };
    btn.disabled = true; btn.textContent = "Memproses data...";
    try {
      const out = await panggil("/predict", { method: "POST", body: data });
      showResult(out);
      if (!akun) {
        const arr = bacaLokal();
        arr.unshift({ date: new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }), age: data.age, label: out.label, probability: out.probability });
        simpanLokal(arr.slice(0, 50));
      }
      muatRiwayat();
      $("#resultPanel").scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (ex) {
      err.textContent = pesanKoneksi(ex); err.hidden = false;
    } finally {
      btn.disabled = false; btn.textContent = "Proses pemeriksaan →";
    }
  });

  // Faktor risiko utama dan rekomendasi (dikirim oleh API: r.faktor dan r.rekomendasi).
  function detail(r) {
    const faktor = Array.isArray(r.faktor) ? r.faktor : [], saran = Array.isArray(r.rekomendasi) ? r.rekomendasi : [];
    const daftarFaktor = faktor.length ? `<ol class="factor-list">${faktor.map(x => `<li>${esc(x.teks)}</li>`).join("")}</ol>` : '<p class="factor-none">Tidak ada faktor yang menonjol menaikkan skor.</p>';
    const daftarSaran = saran.length ? `<div class="result-section"><p class="eyebrow">REKOMENDASI</p><ul class="rec-list">${saran.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "";
    return `<div class="result-section"><p class="eyebrow">FAKTOR YANG PALING MENAIKKAN SKOR</p>${daftarFaktor}<small class="factor-hint">Dihitung dari model, dibandingkan dengan rata-rata data latih dan dengan kondisi tanpa riwayat penyakit atau merokok.</small></div>${daftarSaran}`;
  }

  function showResult(r) {
    const high = r.label === "Risiko tinggi", p = Math.max(0, Math.min(100, +r.probability * 100)), el = $("#resultPanel");
    const simpan = r.tersimpan ? "Hasil ini tersimpan di akun Anda." : akun ? "Hasil ini belum tersimpan ke database (database tidak terhubung)." : "Hasil ini hanya tersimpan di browser. Masuk ke akun agar tersimpan di database.";
    el.hidden = false;
    el.innerHTML = `<div class="result-top"><span class="result-badge ${high ? "high" : "low"}">${high ? "!" : "✓"}</span><div><p class="eyebrow">HASIL SKRINING AWAL</p><h3>${esc(r.label)}</h3><p>Skor keluaran model: ${p.toFixed(1)}%</p></div></div><div class="scorebar"><div class="scorefill" style="width:${p}%"></div></div><div class="scorecaption"><span>Skor model</span><b>${p.toFixed(1)}%</b></div>${detail(r)}<p class="save-note" id="saveNote">${esc(simpan)}</p><div class="result-note">${esc(r.disclaimer || "Hasil ini merupakan skrining awal, bukan diagnosis medis. Konsultasikan dengan dokter.")}</div><div class="actions"><button class="btn primary" id="seeHistory">Lihat riwayat →</button><button class="btn outline" id="newCheck">Cek kembali</button></div>`;
    $("#seeHistory").onclick = () => page("riwayat");
    $("#newCheck").onclick = () => { $("#riskForm").reset(); el.hidden = true; page("cek"); };
  }

  /* ---------- akun: masuk, daftar, keluar ---------- */
  function tampilkanAkun() {
    const masuk = !!akun, admin = akun?.peran === "admin";
    const inisial = masuk ? akun.nama.trim().charAt(0).toUpperCase() : "?";
    $("#authBox").hidden = masuk;
    $("#accountBox").hidden = !masuk;
    $("#sideUser").hidden = !masuk;
    $("#navAdmin").hidden = !admin;
    $("#navAkunText").textContent = masuk ? "Akun saya" : "Masuk / Daftar";
    $("#topAvatar").textContent = inisial;
    $("#akunJudul").textContent = masuk ? "Akun saya" : "Masuk ke HealthCheck";
    if (masuk) {
      $("#sideAvatar").textContent = $("#akunAvatar").textContent = inisial;
      $("#sideNama").textContent = $("#akunNama").textContent = akun.nama;
      $("#akunEmail").textContent = akun.email;
      $("#sidePeran").textContent = $("#akunPeran").textContent = admin ? "Admin" : "Pengguna";
    }
    $("#historyIntro").textContent = masuk ? "Hasil pemeriksaan yang tersimpan di akun Anda." : "Hasil pemeriksaan yang tersimpan pada browser perangkat ini.";
    $("#historyNote").textContent = masuk ? "Data disimpan di database HealthCheck dan terhubung dengan akun Anda." : "Data disimpan secara lokal di browser. Masuk ke akun agar riwayat tersimpan di database.";
    muatRiwayat();
  }

  async function cekSesi() {
    try { akun = (await panggil("/auth/saya")).pengguna; } catch { akun = null; }
    tampilkanAkun();
  }

  const authError = t => { $("#authInfo").hidden = true; $("#authError").textContent = t; $("#authError").hidden = !t; };
  $$(".tab").forEach(t => t.addEventListener("click", () => {
    $$(".tab").forEach(x => x.classList.toggle("active", x === t));
    $("#loginForm").hidden = t.dataset.tab !== "masuk";
    $("#registerForm").hidden = t.dataset.tab !== "daftar";
    authError("");
  }));

  async function kirimAuth(form, path, body) {
    const btn = form.querySelector("button[type=submit]"), teks = btn.textContent;
    authError(""); btn.disabled = true; btn.textContent = "Memproses...";
    try {
      akun = (await panggil(path, { method: "POST", body })).pengguna;
      form.reset(); tampilkanAkun();
      page(akun.peran === "admin" ? "admin" : "cek");
    } catch (ex) {
      authError(pesanKoneksi(ex));
    } finally {
      btn.disabled = false; btn.textContent = teks;
    }
  }

  $("#loginForm").addEventListener("submit", e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    kirimAuth(e.currentTarget, "/auth/masuk", { email: f.get("email"), password: f.get("password") });
  });
  $("#registerForm").addEventListener("submit", e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("password2")) return authError("Kata sandi dan ulangi kata sandi tidak sama.");
    kirimAuth(e.currentTarget, "/auth/daftar", { nama: f.get("nama"), email: f.get("email"), password: f.get("password"), setuju: f.get("setuju") === "on" });
  });

  async function keluar() {
    try { await panggil("/auth/keluar", { method: "POST" }); } catch { /* tetap keluar di tampilan */ }
    akun = null; tampilkanAkun(); page("beranda");
  }
  $("#logoutBtn").addEventListener("click", keluar);
  $("#logoutBtn2").addEventListener("click", keluar);

  /* ---------- dasbor admin ---------- */
  const adminError = t => { $("#adminError").textContent = t; $("#adminError").hidden = !t; };
  let dipilih = null;   // pengguna yang riwayatnya sedang dibuka

  async function muatAdmin() {
    if (akun?.peran !== "admin") return;
    adminError("");
    try {
      const [s, u] = await Promise.all([panggil("/admin/statistik"), panggil("/admin/pengguna")]);
      $("#stPengguna").textContent = s.pengguna;
      $("#stAktif").textContent = `${s.pengguna_aktif} aktif`;
      $("#stPemeriksaan").textContent = s.pemeriksaan;
      $("#stMinggu").textContent = `${s.pemeriksaan_7_hari} dalam 7 hari`;
      $("#stTinggi").textContent = `${s.persen_risiko_tinggi}%`;
      $("#stTinggiN").textContent = `${s.risiko_tinggi} pemeriksaan`;
      $("#userBody").innerHTML = u.pengguna.length ? u.pengguna.map(x => `<tr>
        <td>${esc(x.nama)}</td><td>${esc(x.email)}</td><td>${x.peran === "admin" ? "Admin" : "Pengguna"}</td>
        <td><span class="pill ${x.aktif ? "low" : "high"}">${x.aktif ? "Aktif" : "Nonaktif"}</span></td>
        <td>${x.jumlah_pemeriksaan}</td><td>${esc(x.terakhir || "-")}</td>
        <td class="aksi"><button class="btn outline small" data-lihat="${x.id}">Riwayat</button>${x.id === akun.id ? "" :
          `<button class="btn outline small ${x.aktif ? "danger" : ""}" data-status="${x.id}" data-aktif="${x.aktif ? 0 : 1}">${x.aktif ? "Nonaktifkan" : "Aktifkan"}</button>`}</td></tr>`).join("")
        : '<tr><td colspan="7" class="empty">Belum ada pengguna.</td></tr>';
      if (dipilih) lihatRiwayat(dipilih);
    } catch (ex) {
      adminError(pesanKoneksi(ex));
      if (ex.status === 401 || ex.status === 403) cekSesi();
    }
  }

  async function lihatRiwayat(uid) {
    try {
      const d = await panggil(`/admin/pengguna/${uid}/riwayat`);
      dipilih = uid;
      $("#adminHistory").hidden = false;
      $("#ahJudul").textContent = `Riwayat ${d.pengguna.nama}`;
      $("#ahEmail").textContent = `${d.pengguna.email} · ${d.riwayat.length} pemeriksaan`;
      $("#ahBody").innerHTML = d.riwayat.length ? d.riwayat.map(r => `<tr><td>${esc(r.waktu)}</td><td>${esc(r.input.age)}</td>
        <td>${esc(r.input.blood_glucose_level)} mg/dL</td><td>${esc(r.input.bmi)}</td><td>${pill(r.label)}</td><td>${Math.round(r.skor * 100)}%</td>
        <td><button class="btn outline small danger" data-hapus="${r.id}">Hapus</button></td></tr>`).join("")
        : '<tr><td colspan="7" class="empty">Belum ada riwayat.</td></tr>';
    } catch (ex) { adminError(pesanKoneksi(ex)); }
  }

  $("#userBody").addEventListener("click", async e => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.lihat) return lihatRiwayat(+b.dataset.lihat);
    if (b.dataset.status) {
      const aktif = b.dataset.aktif === "1";
      if (!aktif && !confirm("Nonaktifkan akun ini? Pengguna tidak akan bisa masuk.")) return;
      try { await panggil(`/admin/pengguna/${b.dataset.status}`, { method: "PATCH", body: { aktif } }); } catch (ex) { adminError(pesanKoneksi(ex)); }
      muatAdmin();
    }
  });
  $("#ahBody").addEventListener("click", async e => {
    const b = e.target.closest("button[data-hapus]");
    if (!b || !confirm("Hapus riwayat ini?")) return;
    try { await panggil(`/admin/riwayat/${b.dataset.hapus}`, { method: "DELETE" }); } catch (ex) { adminError(pesanKoneksi(ex)); }
    muatAdmin();
  });
  $("#ahHapusSemua").addEventListener("click", async () => {
    if (!dipilih || !confirm("Hapus SEMUA riwayat pengguna ini?")) return;
    try { await panggil(`/admin/pengguna/${dipilih}/riwayat`, { method: "DELETE" }); } catch (ex) { adminError(pesanKoneksi(ex)); }
    muatAdmin();
  });
  $("#adminRefresh").addEventListener("click", muatAdmin);

  /* ---------- status API & mulai ---------- */
  async function cekApi() {
    const el = $("#apiStatus");
    try { const d = await panggil("/health"); el.textContent = "● API terhubung · " + (d.fitur?.length || 7) + " fitur model tersedia"; }
    catch { el.textContent = "● API belum terhubung · jalankan python app.py"; }
  }

  cekApi();
  cekSesi().then(() => {
    const awal = location.hash.slice(1);
    if (awal && document.getElementById(awal)) page(awal);
  });
})();
