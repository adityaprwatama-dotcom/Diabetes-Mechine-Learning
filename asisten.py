"""
Asisten AI "Tanya AI": tanya jawab kesehatan (fokus diabetes) memakai Groq (paket gratis).

- Endpoint: POST /asisten/chat  (wajib login, sama seperti /predict)
- Kirim: {"pesan": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}, ...]}
  Riwayat obrolan disimpan di browser (hilang saat halaman dimuat ulang), TIDAK disimpan di MySQL.
- Jawaban dikirim mengalir (streaming) sebagai NDJSON, satu objek JSON per baris:
    {"t": "potongan teks"}   ... berkali-kali
    {"selesai": true, "catatan": "..."}   di akhir (catatan opsional)
    {"error": "pesan"}       bila gagal di tengah jalan
- Butuh GROQ_API_KEY di file .env (buat gratis di https://console.groq.com/keys, tanpa kartu kredit).
  Paket gratis punya batas permintaan per menit/per hari. Isi obrolan dikirim ke server Groq,
  karena itu halaman Tanya AI meminta pengguna tidak menulis data pribadi.
"""
import json
import os
import time
import groq
from flask import Blueprint, Response, request, jsonify, stream_with_context
import auth
import db

bp = Blueprint("asisten", __name__)

# Model bawaan bisa diganti lewat ASISTEN_MODEL di .env (daftar model: https://console.groq.com/docs/models).
MODEL = os.getenv("ASISTEN_MODEL", "openai/gpt-oss-120b")
MAKS_TOKEN = 3000            # batas panjang satu jawaban (kuota gratis Groq sekitar 8.000 token per menit)
MAKS_PESAN = 30              # pesan per obrolan yang dikirim ke AI
MAKS_KARAKTER = 4000         # per pesan pengguna
MAKS_TOTAL = 60000           # seluruh obrolan
KUOTA, JENDELA = 30, 60 * 60  # maksimal 30 pertanyaan per pengguna per jam (disimpan di memori), agar kuota gratis tidak habis oleh satu orang
_pemakaian = {}

SISTEM = """Anda adalah "Asisten HealthCheck", asisten kesehatan berbahasa Indonesia di website HealthCheck \
(website skrining risiko diabetes berbasis machine learning, proyek mahasiswa).

Tugas Anda:
- Menjawab pertanyaan seputar kesehatan, terutama diabetes: gejala, faktor risiko, pencegahan, pola makan, \
aktivitas fisik, kadar gula darah, HbA1c, BMI, hipertensi, komplikasi, dan cara membaca hasil pemeriksaan. \
Topik kesehatan umum lain (gizi, tidur, olahraga, kesehatan jantung, kesehatan mental, dan sebagainya) juga boleh.
- Menjelaskan dengan bahasa awam yang ramah, jelas, dan ringkas. Pakai poin-poin bila membantu. \
Jelaskan istilah medis saat pertama dipakai.
- Bila pertanyaan di luar topik kesehatan, tolak dengan sopan dalam satu kalimat dan tawarkan bantuan topik kesehatan.

Batasan penting:
- Anda BUKAN dokter dan tidak memberi diagnosis. Untuk keluhan pribadi, beri informasi umum lalu sarankan \
memeriksakan diri ke dokter atau puskesmas.
- Jangan menyuruh memulai, menghentikan, atau mengubah dosis obat (termasuk insulin). Arahkan ke dokter.
- Bila ada tanda gawat darurat (nyeri dada, sesak napas berat, pingsan, kebingungan mendadak, gula darah sangat \
rendah atau sangat tinggi disertai gejala, tanda stroke, keinginan menyakiti diri), minta pengguna segera ke IGD \
terdekat atau menghubungi 119 (layanan gawat darurat Indonesia).
- Skor dari fitur "Cek Risiko" HealthCheck adalah skor risiko model, bukan diagnosis atau peluang pasti.
- Jangan mengarang angka, penelitian, atau sumber. Bila tidak yakin, katakan terus terang."""


def _boleh_bertanya(uid):
    """Batas sederhana agar kuota gratis Groq tidak dihabiskan satu orang."""
    kini = time.time()
    daftar = [t for t in _pemakaian.get(uid, []) if kini - t < JENDELA]
    if len(daftar) >= KUOTA:
        _pemakaian[uid] = daftar
        return False
    daftar.append(kini)
    _pemakaian[uid] = daftar
    return True


def periksa_pesan(data):
    """Mengembalikan (daftar_pesan, None) bila valid, atau (None, pesan_galat)."""
    pesan = data.get("pesan") if isinstance(data, dict) else None
    if not isinstance(pesan, list) or not pesan:
        return None, "Tulis pertanyaan terlebih dahulu."
    pesan = pesan[-MAKS_PESAN:]
    if isinstance(pesan[0], dict) and pesan[0].get("role") == "assistant":
        pesan = pesan[1:]   # potongan riwayat harus diawali pesan pengguna
    bersih, total = [], 0
    for i, p in enumerate(pesan):
        if not isinstance(p, dict) or not isinstance(p.get("content"), str):
            return None, "Format obrolan tidak valid."
        peran, isi = p.get("role"), p["content"].strip()
        if peran != ("user" if i % 2 == 0 else "assistant"):
            return None, "Urutan obrolan tidak valid."
        if not isi:
            return None, "Pesan tidak boleh kosong."
        if peran == "user" and len(isi) > MAKS_KARAKTER:
            return None, f"Pertanyaan terlalu panjang (maksimal {MAKS_KARAKTER} karakter)."
        total += len(isi)
        bersih.append({"role": peran, "content": isi})
    if not bersih or bersih[-1]["role"] != "user":
        return None, "Pesan terakhir harus berupa pertanyaan."
    if total > MAKS_TOTAL:
        return None, "Obrolan sudah terlalu panjang. Klik \"Obrolan baru\" untuk memulai lagi."
    return bersih, None


def _baris(obj):
    return json.dumps(obj, ensure_ascii=False) + "\n"


def _pesan_galat(ex):
    if isinstance(ex, groq.AuthenticationError):
        return "Kunci API Groq tidak valid. Periksa GROQ_API_KEY di file .env."
    if isinstance(ex, groq.RateLimitError):
        return "Kuota gratis AI sedang habis (batas per menit atau per hari). Coba lagi beberapa saat lagi."
    if isinstance(ex, groq.NotFoundError):
        return f"Model AI '{MODEL}' tidak ditemukan. Periksa ASISTEN_MODEL di file .env."
    if isinstance(ex, groq.PermissionDeniedError):
        return "Kunci API tidak punya izin memakai model ini."
    if isinstance(ex, groq.APIConnectionError):
        return "Tidak dapat terhubung ke layanan AI. Periksa koneksi internet server."
    if isinstance(ex, groq.APIStatusError) and ex.status_code == 413:
        return "Obrolan terlalu panjang untuk kuota gratis. Klik \"Obrolan baru\" lalu tanyakan lagi."
    if isinstance(ex, groq.APIStatusError) and ex.status_code >= 500:
        return "Layanan AI sedang gangguan. Coba lagi nanti."
    return "Permintaan ke layanan AI ditolak. Coba ulangi dengan pertanyaan lain."


@bp.post("/asisten/chat")
def chat():
    try:
        db.ambil("SELECT 1")
    except db.DatabaseMati:
        return jsonify({"error": auth.PESAN_DB_MATI}), 503
    u = auth.pengguna_sekarang()
    if not u:
        return jsonify({"error": "Silakan masuk terlebih dahulu."}), 401
    kunci = os.getenv("GROQ_API_KEY")
    if not kunci:
        return jsonify({"error": "Asisten AI belum diaktifkan. Admin perlu mengisi GROQ_API_KEY di file .env lalu menyalakan ulang API."}), 503

    pesan, galat = periksa_pesan(request.get_json(silent=True))
    if galat:
        return jsonify({"error": galat}), 400
    if not _boleh_bertanya(u["id"]):
        return jsonify({"error": f"Batas {KUOTA} pertanyaan per jam sudah tercapai. Coba lagi nanti."}), 429

    opsi = {}
    if MODEL.startswith("openai/gpt-oss"):
        opsi["reasoning_effort"] = "low"   # model ini "berpikir" dulu; dibuat singkat agar cepat dan hemat kuota

    def alirkan():
        try:
            klien = groq.Groq(api_key=kunci)
            aliran = klien.chat.completions.create(
                model=MODEL,
                messages=[{"role": "system", "content": SISTEM}] + pesan,
                max_completion_tokens=MAKS_TOKEN,
                stream=True,
                **opsi,
            )
            alasan, ada_teks = None, False
            for potong in aliran:
                if not potong.choices:
                    continue
                pilihan = potong.choices[0]
                if pilihan.finish_reason:
                    alasan = pilihan.finish_reason
                teks = pilihan.delta.content   # hanya jawaban; proses "berpikir" model tidak ditampilkan
                if teks:
                    ada_teks = True
                    yield _baris({"t": teks})
            catatan = ""
            if alasan == "length":
                catatan = "Jawaban terpotong karena terlalu panjang. Minta AI melanjutkan atau meringkas."
            elif not ada_teks:
                catatan = "AI tidak memberikan jawaban. Coba lagi."
            yield _baris({"selesai": True, "catatan": catatan})
        except Exception as ex:   # galat API Groq maupun jaringan; pesan dibuat ramah di _pesan_galat
            yield _baris({"error": _pesan_galat(ex)})

    return Response(stream_with_context(alirkan()), mimetype="application/x-ndjson",
                    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
