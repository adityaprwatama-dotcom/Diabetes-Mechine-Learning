/* Maskot dokter beranimasi (Beranda dan layar sambutan Tanya AI).
   Terjemahan JavaScript biasa dari komponen React "MascotPortfolioHero"; tokohnya diganti dokter
   (rambut cokelat bergelombang, jas putih, baju biru, stetoskop, tangan mengacungkan jempol).
   - Kepala menoleh mengikuti kursor (lapisan wajah, hidung, telinga, rambut bergerak berbeda = efek 3D).
   - Berkedip sendiri (kadang dua kali), bernapas, dan melihat-lihat sendiri bila kursor diam.
   - Diklik: tersenyum, melambai sebentar, dan muncul balon kata (teks dari atribut data-sapa, dipisah "|").
   - Dokter yang diberi atribut data-sapa-masuk (di Beranda) melambaikan tangan dan menyapa pengguna
     dengan namanya, sekali setiap selesai masuk (event "hc:akun" dari js/app.js).
   Cara pakai di HTML: <button type="button" class="dokter" data-dokter data-sapa="Halo!|Apa kabar?"></button>
   Tidak mengirim apa pun ke server; nama diambil dari menu samping yang sudah tampil di layar. */
(() => {
  const KULIT = "#f7c9a3", RAMBUT = "#5b3220", RAMBUT_TUA = "#3e1f12", GARIS = "#4a3a33",
    JAS = "#fbfdfd", BAJU = "#5aa8ea", STETOSKOP = "#1f3a66";

  /* ---------- rumus gerak (sama dengan versi aslinya) ---------- */
  // Arah kursor relatif ke kepala, -1..1, melunak di tepi agar kepala tidak "mentok".
  const arah = (px, py, cx, cy, rx, ry) => { const s = v => v / Math.sqrt(1 + v * v); return [s((px - cx) / rx), s((py - cy) / ry)]; };
  // Mendekati target dengan halus, tidak tergantung kecepatan layar.
  const dekati = (kini, target, dt, laju) => target + (kini - target) * Math.exp(-laju * dt);
  // Seberapa jauh tiap lapisan bergeser. Semakin "maju" lapisannya, semakin jauh geserannya.
  const pose = (x, y, dekat) => ({
    badan: { dx: x * 4, dy: 0 },
    kepala: { dx: x * 10, dy: y * 7, rot: x * 4 },
    telinga: { dx: -x * 7, dy: -y * 3, depan: 1 + x * 0.16, belakang: 1 - x * 0.16 },
    rambut: { dx: x * 12, dy: y * 4 },
    pipi: { dx: x * 16, dy: y * 12 },
    wajah: { dx: x * 22, dy: y * (y < 0 ? 10 : 17) },
    hidung: { dx: x * 9, dy: y * 6 },
    mata: { dx: x * 4, dy: y * 4, skala: 1 + dekat * 0.12 },
    alis: { dx: x * 3, dy: y * 2 + Math.min(0, y) * 3 - dekat * 9 },
  });
  // Kedip: 1 = terbuka, turun ke 0,08 selama 150 ms.
  const kedip = sejak => (sejak < 0 || sejak > 0.15) ? 1 : 1 - Math.sin(Math.PI * sejak / 0.15) * 0.92;

  /* ---------- gambar dokter (SVG 600 x 720) ---------- */
  function gambar(n) {
    const u = k => `url(#${k}${n})`;
    const g = `stroke="${GARIS}" stroke-width="4" stroke-linejoin="round"`;
    const KEPALA = "M300 150 C402 150 458 226 458 330 C458 440 392 520 300 520 C208 520 142 440 142 330 C142 226 198 150 300 150Z";
    const PONI = "M144 330 C132 262 152 212 192 186 C222 168 256 172 276 192 C290 170 322 158 356 166 C398 176 436 210 450 254 C458 280 460 306 456 330 C444 292 424 266 398 254 C382 266 354 270 330 262 C316 252 308 240 304 226 C290 246 262 258 234 254 C212 264 192 282 180 304 C164 306 152 316 144 330Z";
    const RAMBUT_BLK = "M126 392 C90 312 100 200 168 146 C214 104 268 92 312 96 C380 100 448 140 480 210 C506 270 494 346 474 392 L456 300 L146 300Z";
    const JAS_BDN = "M28 730 C38 642 98 590 200 572 L400 572 C502 590 562 642 572 730Z";
    const LENGAN = "M14 730 L36 616 C44 590 74 580 100 588 L152 606 C172 616 174 646 160 666 L120 730Z";
    const LEHER = "M262 480 L338 480 L344 570 Q300 590 256 570Z";
    const mata = cx => `<ellipse cx="${cx}" cy="340" rx="34" ry="37" fill="#fff" stroke="#3a2418" stroke-width="3"/>
<circle cx="${cx + 2}" cy="344" r="25" fill="${u("iris")}"/><circle cx="${cx + 2}" cy="346" r="12" fill="#1a0d06"/>
<circle cx="${cx - 9}" cy="331" r="8.5" fill="#fff"/><circle cx="${cx + 12}" cy="357" r="4" fill="#fff" opacity=".85"/>
<path d="M${cx - 37} 332 Q${cx} 292 ${cx + 37} 332" fill="none" stroke="#2a160b" stroke-width="7" stroke-linecap="round"/>`;
    const jari = (x, y, l, t, sudut) => `<rect x="${x}" y="${y}" width="${l}" height="${t}" rx="${l / 2}" fill="${KULIT}" ${g} transform="rotate(${sudut} ${x + l / 2} ${y + t})"/>`;
    return `<svg viewBox="0 0 600 720" aria-hidden="true" focusable="false">
<defs>
<radialGradient id="bayang${n}" cx="46%" cy="40%" r="62%"><stop offset=".62" stop-color="#b4502a" stop-opacity="0"/><stop offset="1" stop-color="#b4502a" stop-opacity=".26"/></radialGradient>
<radialGradient id="kilau${n}" cx="38%" cy="30%" r="44%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="rona${n}"><stop offset="0" stop-color="#ff7468" stop-opacity=".5"/><stop offset="1" stop-color="#ff7468" stop-opacity="0"/></radialGradient>
<radialGradient id="rambut${n}" cx="42%" cy="18%" r="85%"><stop offset="0" stop-color="#c98a5a" stop-opacity=".45"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
<radialGradient id="iris${n}" cx="45%" cy="35%" r="70%"><stop offset="0" stop-color="#b0652e"/><stop offset=".7" stop-color="#6b3415"/><stop offset="1" stop-color="#3d1a08"/></radialGradient>
<radialGradient id="hidung${n}" cx="42%" cy="36%" r="66%"><stop offset="0" stop-color="#ffb08f" stop-opacity=".2"/><stop offset="1" stop-color="#d0704a" stop-opacity=".42"/></radialGradient>
<linearGradient id="leher${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a4420" stop-opacity=".42"/><stop offset=".55" stop-color="#9a4420" stop-opacity=".06"/></linearGradient>
<linearGradient id="jas${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#0d3b33" stop-opacity=".14"/></linearGradient>
<clipPath id="mulut${n}"><path d="M232 420 Q300 438 368 420 Q360 488 300 492 Q240 488 232 420Z"/></clipPath>
</defs>
<ellipse cx="300" cy="712" rx="250" ry="14" fill="#000" opacity=".1"/>
<g data-l="badan">
<path d="${JAS_BDN}" fill="${JAS}" ${g}/><path d="${JAS_BDN}" fill="${u("jas")}"/>
<path d="${LEHER}" fill="${KULIT}" ${g}/><path d="${LEHER}" fill="${u("leher")}"/>
<path d="M222 572 L300 730 L378 572Z" fill="${BAJU}" ${g}/>
<path d="M256 570 L300 636 L344 570Z" fill="${KULIT}"/>
<path d="M252 566 L300 640 L348 566" fill="none" stroke="#3d86c6" stroke-width="9" stroke-linejoin="round"/>
<path d="M222 572 L300 730 L262 730 L192 642 L214 618 L196 596Z M378 572 L300 730 L338 730 L408 642 L386 618 L404 596Z" fill="#f2f7f7" ${g}/>
<path d="M226 596 C206 584 196 566 200 548 M374 596 C394 584 404 566 400 548" fill="none" stroke="#b9c4cb" stroke-width="5" stroke-linecap="round"/>
<path d="M252 562 C222 598 214 660 230 730 M348 562 C380 598 398 640 404 676" fill="none" stroke="${STETOSKOP}" stroke-width="11" stroke-linecap="round"/>
<circle cx="406" cy="690" r="26" fill="#c6d0d6" ${g}/><circle cx="406" cy="690" r="14" fill="#8a99a2"/><circle cx="399" cy="682" r="5" fill="#fff" opacity=".8"/>
<g class="dk-lengan">
<path d="${LENGAN}" fill="${JAS}" ${g}/><path d="${LENGAN}" fill="${u("jas")}"/>
<g class="jempol">
<path d="M94 528 C88 496 94 462 112 452 C128 446 138 460 132 478 L124 520Z" fill="${KULIT}" ${g}/>
<path d="M80 548 C80 530 94 520 112 522 L150 526 C164 528 168 542 160 552 C172 558 172 574 160 580 C168 588 164 602 150 604 L98 606 C84 606 76 596 76 580Z" fill="${KULIT}" ${g}/>
<path d="M128 552 L160 552 M128 580 L160 580" stroke="#c0704c" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/>
</g>
<g class="lambai">
${jari(66, 436, 22, 64, -14)}${jari(92, 424, 22, 72, -5)}${jari(118, 426, 22, 70, 5)}${jari(142, 440, 21, 60, 14)}${jari(150, 500, 22, 56, -55)}
<path d="M72 500 C70 478 90 472 116 474 C146 476 166 486 166 510 L162 570 C160 592 142 604 118 604 C92 604 76 592 74 570Z" fill="${KULIT}" ${g}/>
<path d="M100 532 Q118 546 138 532" fill="none" stroke="#c0704c" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>
</g>
<path d="M72 602 L156 602 L160 624 L68 626Z" fill="${JAS}" ${g}/>
</g>
</g>
<g data-l="kepala">
<g data-l="rambutBlk"><path d="${RAMBUT_BLK}" fill="${RAMBUT}" ${g}/><path d="${RAMBUT_BLK}" fill="${u("rambut")}"/></g>
<g data-l="telingaKiri"><ellipse cx="146" cy="352" rx="31" ry="40" fill="${KULIT}" ${g}/><ellipse cx="146" cy="352" rx="31" ry="40" fill="${u("bayang")}"/><path d="M156 328 Q132 338 136 362 Q140 380 156 380" fill="none" stroke="#c0623a" stroke-opacity=".4" stroke-width="6" stroke-linecap="round"/></g>
<g data-l="telingaKanan"><ellipse cx="454" cy="352" rx="31" ry="40" fill="${KULIT}" ${g}/><ellipse cx="454" cy="352" rx="31" ry="40" fill="${u("bayang")}"/><path d="M444 328 Q468 338 464 362 Q460 380 444 380" fill="none" stroke="#c0623a" stroke-opacity=".4" stroke-width="6" stroke-linecap="round"/></g>
<path d="${KEPALA}" fill="${KULIT}" ${g}/><path d="${KEPALA}" fill="${u("bayang")}"/><path d="${KEPALA}" fill="${u("kilau")}"/>
<g data-l="pipi"><g class="biasa"><ellipse cx="194" cy="414" rx="40" ry="26" fill="${u("rona")}"/><ellipse cx="406" cy="414" rx="40" ry="26" fill="${u("rona")}"/></g><g class="senang"><ellipse cx="194" cy="410" rx="48" ry="32" fill="${u("rona")}"/><ellipse cx="406" cy="410" rx="48" ry="32" fill="${u("rona")}"/></g></g>
<g data-l="wajah">
<g data-l="alis">
<path class="biasa" d="M198 276 Q234 254 272 266 M328 266 Q366 254 402 276" fill="none" stroke="#3b2214" stroke-width="17" stroke-linecap="round"/>
<path class="senang" d="M198 264 Q234 240 272 254 M328 254 Q366 240 402 264" fill="none" stroke="#3b2214" stroke-width="17" stroke-linecap="round"/>
</g>
<g data-l="mata">
<g class="biasa">${mata(238)}${mata(362)}</g>
<path class="senang" d="M206 350 Q238 312 270 350 M330 350 Q362 312 394 350" fill="none" stroke="#2a160b" stroke-width="12" stroke-linecap="round"/>
</g>
<g class="biasa">${mulut(n, "")}</g>
<g class="senang">${mulut(n, ` transform="translate(300 420) scale(1.1 1.22) translate(-300 -420)"`)}</g>
<g data-l="hidung"><ellipse cx="300" cy="404" rx="22" ry="9" fill="#9a4420" opacity=".14"/><ellipse cx="300" cy="388" rx="23" ry="20" fill="${KULIT}"/><ellipse cx="300" cy="388" rx="23" ry="20" fill="${u("hidung")}"/><ellipse cx="292" cy="380" rx="8" ry="6" fill="#fff" opacity=".5"/></g>
</g>
<g data-l="poni">
<path d="${PONI}" fill="${RAMBUT}" ${g}/><path d="${PONI}" fill="${u("rambut")}"/>
<path d="M176 250 C196 214 230 196 268 200 M318 186 C352 180 392 196 420 226" fill="none" stroke="${RAMBUT_TUA}" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>
<path d="M200 214 C222 198 246 194 262 198 M336 190 C362 190 384 200 400 214" fill="none" stroke="#b07548" stroke-opacity=".6" stroke-width="5" stroke-linecap="round"/>
</g>
<path d="M150 168 C180 132 228 116 270 118 M330 116 C380 120 424 146 452 186" fill="none" stroke="${RAMBUT_TUA}" stroke-opacity=".5" stroke-width="5" stroke-linecap="round"/>
<g class="dk-jambul"><path d="M118 196 C104 176 112 150 132 146 C128 162 132 176 142 184Z M462 190 C478 170 472 146 452 140 C458 156 456 170 446 180Z M276 100 C268 76 284 58 310 56 C300 70 302 86 312 98Z" fill="${RAMBUT}" ${g}/></g>
</g>
</svg>`;
  }

  function mulut(n, ubah) {
    return `<g${ubah}><path d="M232 420 Q300 438 368 420 Q360 488 300 492 Q240 488 232 420Z" fill="#7a1e1e"/>
<g clip-path="url(#mulut${n})"><ellipse cx="300" cy="494" rx="40" ry="22" fill="#e46a6f"/><path d="M222 414 Q300 440 378 414 L378 446 Q300 462 222 446Z" fill="#fff"/></g>
<path d="M232 420 Q300 438 368 420 Q360 488 300 492 Q240 488 232 420Z" fill="none" stroke="#5a2a1a" stroke-width="4" stroke-linejoin="round"/>
<path d="M222 412 Q226 424 236 428 M378 412 Q374 424 364 428" fill="none" stroke="#c0623a" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/></g>`;
  }

  /* ---------- pasang dokter ke setiap <button data-dokter> ---------- */
  const semua = [];
  let nomor = 0;

  // Tersenyum + melambai, sambil menampilkan pesan satu per satu.
  function lambai(d, pesan, lama) {
    clearTimeout(d.timer);
    d.timerPesan.forEach(clearTimeout);
    d.timerPesan = [];
    d.el.classList.add("dk-senang", "dk-melambai");
    const tiap = lama / pesan.length;
    pesan.forEach((p, i) => d.timerPesan.push(setTimeout(() => { d.gelembung.textContent = p; d.gelembung.dataset.on = "true"; }, i * tiap)));
    d.timerPesan.push(setTimeout(() => d.el.classList.remove("dk-melambai"), Math.min(lama, 3600)));
    d.timer = setTimeout(() => { d.el.classList.remove("dk-senang", "dk-melambai"); d.gelembung.dataset.on = "false"; }, lama);
  }

  function pasang(el) {
    const n = ++nomor;
    const sapa = (el.dataset.sapa || "Halo!").split("|").map(s => s.trim()).filter(Boolean);
    el.innerHTML = gambar(n) + `<span class="dk-gelembung" data-on="false" aria-live="polite"></span>`;
    if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", "Sapa dokter");
    const L = {};
    el.querySelectorAll("svg [data-l]").forEach(x => { L[x.dataset.l] = x; });
    const d = { el, L, gelembung: el.querySelector(".dk-gelembung"), timer: 0, timerPesan: [], sapaTertunda: null,
      gx: 0, gy: 0, dekat: 0, kedipBerikut: performance.now() + 1800 + Math.random() * 1500, kedipPada: -1e9, terlihat: false };
    semua.push(d);

    let ke = -1;
    el.addEventListener("click", () => { ke = (ke + 1) % sapa.length; lambai(d, [sapa[ke]], 2400); });
    // Saat halaman/menu tersembunyi, perulangan untuk dokter ini tidak bekerja (hemat baterai).
    // Sapaan setelah masuk baru dimainkan saat dokter benar-benar terlihat di layar.
    new IntersectionObserver(([e]) => {
      d.terlihat = e.isIntersecting;
      if (d.terlihat && d.sapaTertunda) {
        const pesan = d.sapaTertunda;
        d.sapaTertunda = null;
        setTimeout(() => lambai(d, pesan, 6500), 450);
      }
    }).observe(el);
  }

  /* ---------- sapaan setelah masuk (dokter Beranda) ---------- */
  let sudahMasuk = false;
  document.addEventListener("hc:akun", e => {
    const masuk = !!e.detail?.masuk;
    if (masuk && !sudahMasuk) {   // hanya saat baru masuk, bukan setiap kali tampilan akun diperbarui
      const nama = (document.getElementById("sideNama")?.textContent || "").trim().split(/\s+/)[0];
      const halo = nama && nama !== "-" ? `Halooo, ${nama}! 👋` : "Halooo! 👋";
      semua.filter(d => d.el.hasAttribute("data-sapa-masuk")).forEach(d => {
        d.sapaTertunda = [halo, "Selamat datang di HealthCheck. Yuk jaga kesehatanmu hari ini!"];
      });
    }
    sudahMasuk = masuk;
  });

  /* ---------- satu perulangan animasi untuk semua dokter ---------- */
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  let px = 0, py = 0, gerakTerakhir = -1e9, sebelum = performance.now();
  const catat = e => { px = e.clientX; py = e.clientY; gerakTerakhir = performance.now(); };
  addEventListener("pointermove", catat, { passive: true });
  addEventListener("pointerdown", catat, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { gerakTerakhir = -1e9; });
  addEventListener("blur", () => { gerakTerakhir = -1e9; });

  const tr = (dx, dy) => `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`;

  function bingkai(kini) {
    requestAnimationFrame(bingkai);
    const dt = Math.min(0.05, (kini - sebelum) / 1000);
    sebelum = kini;
    const diam = mq.matches;
    for (const d of semua) {
      if (!d.terlihat) continue;
      const r = d.el.getBoundingClientRect();
      if (!r.width) continue;
      const cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.45;   // titik tengah kepala
      let tx = 0, ty = 0, tn = 0;
      if (d.el.classList.contains("dk-melambai")) {   // saat menyapa: menatap ke depan
        ty = 0.1;
      } else if (performance.now() - gerakTerakhir <= 3500) {
        const jangkau = Math.max(innerWidth, innerHeight);
        [tx, ty] = arah(px, py, cx, cy, jangkau * 0.3, jangkau * 0.26);
        tn = Math.max(0, 1 - Math.hypot(px - cx, py - cy) / (r.width * 0.45));
      } else if (!diam) {   // tidak ada yang menggerakkan kursor: melihat-lihat sendiri
        const t = kini / 1000;
        tx = Math.sin(t * 0.45) * 0.55 + Math.sin(t * 1.1) * 0.1;
        ty = Math.sin(t * 0.31 + 1) * 0.25;
      }
      const laju = diam ? 30 : 7;
      d.gx = dekati(d.gx, tx, dt, laju);
      d.gy = dekati(d.gy, ty, dt, laju);
      d.dekat = dekati(d.dekat, tn, dt, 8);
      const p = pose(d.gx, d.gy, d.dekat);
      const napas = diam ? 0 : Math.sin(kini / 620) * 1.6;
      if (!diam && kini > d.kedipBerikut) {
        d.kedipPada = kini;
        d.kedipBerikut = kini + (Math.random() < 0.2 ? 260 : 2200 + Math.random() * 3200);   // kadang kedip dua kali
      }
      const buka = diam ? 1 : kedip((kini - d.kedipPada) / 1000);
      const L = d.L;
      L.badan.setAttribute("transform", tr(p.badan.dx, p.badan.dy + napas * 0.4));
      L.kepala.setAttribute("transform", tr(p.kepala.dx, p.kepala.dy + napas) + ` rotate(${p.kepala.rot.toFixed(2)} 300 520)`);
      L.telingaKiri.setAttribute("transform", tr(p.telinga.dx, p.telinga.dy) + ` translate(146 352) scale(${p.telinga.depan.toFixed(3)} 1) translate(-146 -352)`);
      L.telingaKanan.setAttribute("transform", tr(p.telinga.dx, p.telinga.dy) + ` translate(454 352) scale(${p.telinga.belakang.toFixed(3)} 1) translate(-454 -352)`);
      L.rambutBlk.setAttribute("transform", tr(p.rambut.dx * 0.4, p.rambut.dy * 0.4));
      L.poni.setAttribute("transform", tr(p.rambut.dx, p.rambut.dy));
      L.pipi.setAttribute("transform", tr(p.pipi.dx, p.pipi.dy));
      L.wajah.setAttribute("transform", tr(p.wajah.dx, p.wajah.dy));
      L.hidung.setAttribute("transform", tr(p.hidung.dx, p.hidung.dy));
      L.alis.setAttribute("transform", tr(p.alis.dx, p.alis.dy));
      L.mata.setAttribute("transform", tr(p.mata.dx, p.mata.dy) +
        ` translate(300 340) scale(${p.mata.skala.toFixed(3)} ${(p.mata.skala * buka).toFixed(3)}) translate(-300 -340)`);
    }
  }

  /* ---------- hiasan poster Tanya AI ---------- */
  // Ruang berperspektif satu titik di belakang poster (kotak 1000 x 1000 yang direnggangkan).
  function ruang(svg) {
    const x0 = 95, x1 = 905, y0 = 85, y1 = 865, vx = 500, vy = 475, garis = [], kotak = [];
    const keluar = (x, y) => {
      const dx = x - vx, dy = y - vy;
      const t = Math.min(dx > 0 ? (1000 - x) / dx : dx < 0 ? -x / dx : Infinity, dy > 0 ? (1000 - y) / dy : dy < 0 ? -y / dy : Infinity);
      return [x, y, x + dx * t, y + dy * t];
    };
    for (let i = 0; i <= 14; i++) { const x = x0 + (x1 - x0) * i / 14; garis.push([x, y0, x, y1], keluar(x, y0), keluar(x, y1)); }
    for (let j = 0; j <= 11; j++) { const y = y0 + (y1 - y0) * j / 11; garis.push([x0, y, x1, y], keluar(x0, y), keluar(x1, y)); }
    for (const s of [1.07, 1.16, 1.28, 1.45, 1.7]) {
      const l = vx + (x0 - vx) * s, r = vx + (x1 - vx) * s, t = vy + (y0 - vy) * s, b = vy + (y1 - vy) * s;
      kotak.push(`<path d="M${l} ${t}H${r}V${b}H${l}Z"/>`);
    }
    svg.innerHTML = `<g stroke="currentColor" stroke-width=".8" fill="none" opacity=".13">` +
      garis.map(s => `<line x1="${s[0]}" y1="${s[1]}" x2="${s[2]}" y2="${s[3]}"/>`).join("") + kotak.join("") + "</g>";
  }

  // Bunga lima kelopak sebagai satu garis tertutup.
  function bunga() {
    const pj = [1, 0.84, 0.95, 0.78, 0.9];
    let d = "";
    for (let i = 0; i <= 180; i++) {
      const a = i / 180 * Math.PI * 2;
      const k = Math.floor((a + Math.PI / 5) / (Math.PI * 2) * 5) % 5;
      const r = 50 * (0.3 + 0.7 * Math.pow(Math.abs(Math.cos(a * 5 / 2)), 0.9) * pj[k]);
      d += (i ? "L" : "M") + (60 + Math.cos(a - Math.PI / 2) * r).toFixed(1) + " " + (60 + Math.sin(a - Math.PI / 2) * r).toFixed(1);
    }
    return d + "Z";
  }

  document.querySelectorAll("[data-ruang]").forEach(ruang);
  document.querySelectorAll(".dk-bunga path").forEach(p => p.setAttribute("d", bunga()));
  // Tiap huruf judul dibungkus agar bisa melompat saat disentuh kursor.
  document.querySelectorAll("[data-huruf]").forEach(el => {
    el.innerHTML = Array.from(el.textContent).map(c => `<span class="dk-ch">${c === " " ? "&nbsp;" : c}</span>`).join("");
  });
  document.querySelectorAll("[data-fokus]").forEach(b => b.addEventListener("click", () => document.querySelector(b.dataset.fokus)?.focus()));

  document.querySelectorAll("[data-dokter]").forEach(pasang);
  if (semua.length) requestAnimationFrame(bingkai);
})();
