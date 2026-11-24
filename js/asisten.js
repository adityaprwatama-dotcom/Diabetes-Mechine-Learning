/* Menu "Tanya AI": obrolan dengan asisten kesehatan (POST /asisten/chat di asisten.py).
   Riwayat obrolan hanya disimpan di memori halaman ini (hilang saat dimuat ulang atau keluar akun).
   Jawaban datang mengalir (NDJSON): {"t": "..."} berkali-kali, lalu {"selesai": true} atau {"error": "..."}. */
(() => {
  const HOST = ["localhost", "127.0.0.1"].includes(location.hostname) ? location.hostname : "127.0.0.1";
  const API = (window.API_BASE_URL || `http://${HOST}:8000`).replace(/\/$/, "");
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const log = $("#chatLog"), form = $("#chatForm"), input = $("#chatInput"), kirim = $("#chatKirim"), sambut = $("#chatSambut");
  if (!log || !form) return;

  let riwayat = [];        // [{role: "user"|"assistant", content: "..."}] yang dikirim ke server
  let pengendali = null;   // AbortController permintaan yang sedang berjalan

  /* ---------- format jawaban: Markdown sederhana, semua teks di-escape dulu ---------- */
  const sebaris = t => esc(t)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/(^|[\s(])\*(?!\s)([^*]+?)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");

  function format(teks) {
    const out = [];
    let daftar = null;   // "ul" atau "ol" yang sedang terbuka
    const tutup = () => { if (daftar) { out.push(`</${daftar}>`); daftar = null; } };
    for (const baris of teks.split("\n")) {
      const t = baris.trim();
      let m;
      if (!t) { tutup(); continue; }
      if ((m = t.match(/^#{1,6}\s+(.*)$/))) { tutup(); out.push(`<h4>${sebaris(m[1])}</h4>`); continue; }
      if ((m = t.match(/^[-*•]\s+(.*)$/))) {
        if (daftar !== "ul") { tutup(); out.push("<ul>"); daftar = "ul"; }
        out.push(`<li>${sebaris(m[1])}</li>`); continue;
      }
      if ((m = t.match(/^(\d+)[.)]\s+(.*)$/))) {
        if (daftar !== "ol") { tutup(); out.push(`<ol start="${Number(m[1])}">`); daftar = "ol"; }
        out.push(`<li>${sebaris(m[2])}</li>`); continue;
      }
      if (/^(-{3,}|\*{3,})$/.test(t)) { tutup(); out.push("<hr>"); continue; }
      tutup(); out.push(`<p>${sebaris(t)}</p>`);
    }
    tutup();
    return out.join("");
  }

  /* ---------- tampilan ---------- */
  const keBawah = () => { log.scrollTop = log.scrollHeight; };

  function gelembung(peran, html) {
    sambut.hidden = true;
    const el = document.createElement("div");
    el.className = `chat-msg ${peran}`;
    el.innerHTML = peran === "ai"
      ? `<span class="chat-ava" aria-hidden="true">✦</span><div class="chat-bubble">${html}</div>`
      : `<div class="chat-bubble">${html}</div>`;
    log.appendChild(el);
    keBawah();
    return el.querySelector(".chat-bubble");
  }

  function sibuk(ya) {
    kirim.disabled = ya;
    kirim.textContent = ya ? "Menjawab..." : "Kirim ➤";
    form.classList.toggle("sibuk", ya);
  }

  function aturTinggi() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
  }

  /* ---------- kirim pertanyaan ---------- */
  async function tanya(teks) {
    teks = teks.trim();
    if (!teks || pengendali) return;
    input.value = ""; aturTinggi();
    gelembung("user", format(teks));
    riwayat.push({ role: "user", content: teks });
    const bubble = gelembung("ai", '<span class="chat-ketik"><i></i><i></i><i></i></span>');
    sibuk(true);

    const ini = new AbortController();
    pengendali = ini;
    let jawaban = "", gagal = "", catatan = "";
    try {
      const r = await fetch(API + "/asisten/chat", {
        method: "POST", credentials: "include", signal: ini.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pesan: riwayat }),
      });
      if (!r.ok) {
        let data = {};
        try { data = await r.json(); } catch { /* jawaban kosong */ }
        throw new Error(data.error || "Permintaan gagal diproses.");
      }
      const baca = r.body.getReader(), dekoder = new TextDecoder();
      let sisa = "";
      for (;;) {
        const { value, done } = await baca.read();
        if (done) break;
        sisa += dekoder.decode(value, { stream: true });
        const baris = sisa.split("\n");
        sisa = baris.pop();
        for (const b of baris) {
          if (!b.trim()) continue;
          const ev = JSON.parse(b);
          if (ev.t) { jawaban += ev.t; bubble.innerHTML = format(jawaban); keBawah(); }
          if (ev.error) gagal = ev.error;
          if (ev.catatan) catatan = ev.catatan;
        }
      }
      if (!jawaban && !gagal) gagal = "AI tidak memberikan jawaban. Coba lagi.";
    } catch (ex) {
      if (ex.name === "AbortError") return;   // "Obrolan baru" ditekan saat AI menjawab
      gagal = (ex.message || "").includes("Failed to fetch")
        ? "Tidak dapat terhubung ke API. Pastikan python app.py berjalan pada port 8000." : ex.message;
    } finally {
      if (pengendali === ini) { pengendali = null; sibuk(false); }
    }

    if (jawaban) riwayat.push({ role: "assistant", content: jawaban });
    else riwayat.pop();   // pertanyaan tanpa jawaban tidak ikut dikirim lagi, supaya bisa diulang
    if (gagal && !jawaban) { bubble.parentElement.classList.add("galat"); bubble.innerHTML = `<p>${esc(gagal)}</p>`; input.value = teks; aturTinggi(); }
    else if (gagal) bubble.insertAdjacentHTML("beforeend", `<p class="chat-info">${esc(gagal)}</p>`);
    if (catatan) bubble.insertAdjacentHTML("beforeend", `<p class="chat-info">${esc(catatan)}</p>`);
    keBawah();
    input.focus();
  }

  function obrolanBaru() {
    if (pengendali) { pengendali.abort(); pengendali = null; sibuk(false); }
    riwayat = [];
    log.querySelectorAll(".chat-msg").forEach(x => x.remove());
    sambut.hidden = false;
    input.value = ""; aturTinggi();
  }

  form.addEventListener("submit", e => { e.preventDefault(); tanya(input.value); });
  input.addEventListener("keydown", e => {   // Enter = kirim, Shift+Enter = baris baru
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); tanya(input.value); }
  });
  input.addEventListener("input", aturTinggi);
  sambut.querySelectorAll(".chat-saran button").forEach(b => b.addEventListener("click", () => tanya(b.textContent)));
  $("#chatBaru").addEventListener("click", obrolanBaru);
  // Saat keluar akun: hapus obrolan agar pengguna berikutnya tidak melihatnya (event dari js/app.js).
  document.addEventListener("hc:akun", e => { if (!e.detail?.masuk) obrolanBaru(); });
})();
