"""
Login, riwayat di database, dan fitur admin (Flask Blueprint, didaftarkan di app.py).

Ringkasan endpoint:
  POST   /auth/daftar                      daftar akun user (wajib setuju penyimpanan data)
  POST   /auth/masuk                       login
  POST   /auth/keluar                      logout
  GET    /auth/saya                        akun yang sedang login
  GET    /riwayat                          riwayat milik sendiri
  DELETE /riwayat                          hapus semua riwayat milik sendiri
  GET    /admin/statistik                  (admin) jumlah pengguna, pemeriksaan, % risiko tinggi
  GET    /admin/pengguna                   (admin) daftar pengguna
  PATCH  /admin/pengguna/<id>              (admin) aktifkan / nonaktifkan akun
  GET    /admin/pengguna/<id>/riwayat      (admin) riwayat seorang pengguna
  DELETE /admin/pengguna/<id>/riwayat      (admin) hapus semua riwayat seorang pengguna
  DELETE /admin/riwayat/<id>               (admin) hapus satu riwayat
"""
import json
import re
import time
from functools import wraps
from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash
import db

bp = Blueprint("auth", __name__)
POLA_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PESAN_DB_MATI = "Database belum menyala. Nyalakan MySQL di XAMPP Control Panel, lalu coba lagi."

# Batas percobaan login gagal (disimpan di memori; hilang saat API dimatikan)
MAKS_GAGAL, JEDA_DETIK = 5, 15 * 60
_gagal = {}


def galat(pesan, kode=400):
    return jsonify({"error": pesan}), kode


@bp.errorhandler(db.DatabaseMati)
def _db_mati(_):
    return galat(PESAN_DB_MATI, 503)


def data_json():
    d = request.get_json(silent=True)
    return d if isinstance(d, dict) else {}


def publik(u):
    """Data akun yang aman dikirim ke browser (tanpa password_hash)."""
    return {"id": u["id"], "nama": u["nama"], "email": u["email"], "peran": u["peran"]}


def pengguna_sekarang():
    """Akun yang sedang login, atau None. Dicek ulang ke database agar akun yang dinonaktifkan langsung keluar."""
    uid = session.get("user_id")
    if not uid:
        return None
    try:
        u = db.ambil("SELECT id, nama, email, peran, aktif FROM users WHERE id=%s", (uid,), satu=True)
    except db.DatabaseMati:
        return None
    if not u or not u["aktif"]:
        session.clear()
        return None
    return u


def wajib_login(fn):
    @wraps(fn)
    def bungkus(*a, **kw):
        u = pengguna_sekarang()
        if not u:
            return galat("Silakan masuk terlebih dahulu.", 401)
        return fn(u, *a, **kw)
    return bungkus


def wajib_admin(fn):
    @wraps(fn)
    def bungkus(*a, **kw):
        u = pengguna_sekarang()
        if not u:
            return galat("Silakan masuk terlebih dahulu.", 401)
        if u["peran"] != "admin":
            return galat("Halaman ini hanya untuk admin.", 403)
        return fn(u, *a, **kw)
    return bungkus


def simpan_riwayat(nilai, skor, label):
    """Dipanggil dari /predict. Menyimpan hasil bila pengguna sedang login. Mengembalikan True bila tersimpan."""
    u = pengguna_sekarang()
    if not u:
        return False
    try:
        db.ubah("INSERT INTO riwayat (user_id, input, skor, label) VALUES (%s, %s, %s, %s)",
                (u["id"], json.dumps(nilai), round(skor, 4), label))
        return True
    except db.DatabaseMati:
        return False


def baris_riwayat(r):
    return {"id": r["id"], "waktu": r["waktu"].strftime("%Y-%m-%d %H:%M"), "label": r["label"],
            "skor": float(r["skor"]), "input": json.loads(r["input"])}


# ------------------------------------------------------------------ akun
@bp.post("/auth/daftar")
def daftar():
    d = data_json()
    nama = str(d.get("nama", "")).strip()
    email = str(d.get("email", "")).strip().lower()
    sandi = str(d.get("password", ""))
    if not 2 <= len(nama) <= 100:
        return galat("Nama wajib diisi (2-100 karakter).")
    if not POLA_EMAIL.match(email) or len(email) > 190:
        return galat("Format email tidak valid.")
    if not 8 <= len(sandi) <= 128:
        return galat("Kata sandi minimal 8 karakter.")
    if d.get("setuju") is not True:
        return galat("Anda perlu menyetujui penyimpanan hasil cek risiko untuk membuat akun.")
    if db.ambil("SELECT id FROM users WHERE email=%s", (email,), satu=True):
        return galat("Email sudah terdaftar. Silakan masuk.", 409)
    uid, _ = db.ubah("INSERT INTO users (nama, email, password_hash, peran, setuju_simpan) "
                     "VALUES (%s, %s, %s, 'user', NOW())", (nama, email, generate_password_hash(sandi)))
    session.clear()
    session["user_id"] = uid
    return jsonify({"pesan": "Akun berhasil dibuat.", "pengguna": {"id": uid, "nama": nama, "email": email, "peran": "user"}}), 201


@bp.post("/auth/masuk")
def masuk():
    d = data_json()
    email = str(d.get("email", "")).strip().lower()
    sandi = str(d.get("password", ""))
    kunci = f"{request.remote_addr}|{email}"
    gagal = [t for t in _gagal.get(kunci, []) if time.time() - t < JEDA_DETIK]
    if len(gagal) >= MAKS_GAGAL:
        return galat("Terlalu banyak percobaan gagal. Coba lagi 15 menit lagi.", 429)
    u = db.ambil("SELECT * FROM users WHERE email=%s", (email,), satu=True)
    if not u or not check_password_hash(u["password_hash"], sandi):
        _gagal[kunci] = gagal + [time.time()]
        return galat("Email atau kata sandi salah.", 401)
    if not u["aktif"]:
        return galat("Akun ini dinonaktifkan oleh admin.", 403)
    _gagal.pop(kunci, None)
    session.clear()
    session["user_id"] = u["id"]
    return jsonify({"pesan": "Berhasil masuk.", "pengguna": publik(u)})


@bp.post("/auth/keluar")
def keluar():
    session.clear()
    return jsonify({"pesan": "Berhasil keluar."})


@bp.get("/auth/saya")
def saya():
    u = pengguna_sekarang()
    return jsonify({"masuk": bool(u), "pengguna": publik(u) if u else None})


# ------------------------------------------------------------------ riwayat milik sendiri
@bp.get("/riwayat")
@wajib_login
def riwayat_saya(u):
    rows = db.ambil("SELECT * FROM riwayat WHERE user_id=%s ORDER BY waktu DESC, id DESC LIMIT 100", (u["id"],))
    return jsonify({"riwayat": [baris_riwayat(r) for r in rows]})


@bp.delete("/riwayat")
@wajib_login
def hapus_riwayat_saya(u):
    _, n = db.ubah("DELETE FROM riwayat WHERE user_id=%s", (u["id"],))
    return jsonify({"pesan": f"{n} riwayat dihapus.", "dihapus": n})


# ------------------------------------------------------------------ admin
@bp.get("/admin/statistik")
@wajib_admin
def statistik(_):
    p = db.ambil("SELECT COUNT(*) AS total, COALESCE(SUM(aktif), 0) AS aktif FROM users WHERE peran='user'", satu=True)
    r = db.ambil("SELECT COUNT(*) AS total, COALESCE(SUM(label='Risiko tinggi'), 0) AS tinggi, "
                 "COALESCE(SUM(waktu >= NOW() - INTERVAL 7 DAY), 0) AS minggu_ini FROM riwayat", satu=True)
    total, tinggi = int(r["total"]), int(r["tinggi"])
    return jsonify({
        "pengguna": int(p["total"]), "pengguna_aktif": int(p["aktif"]),
        "pemeriksaan": total, "pemeriksaan_7_hari": int(r["minggu_ini"]),
        "risiko_tinggi": tinggi, "persen_risiko_tinggi": round(100 * tinggi / total, 1) if total else 0.0,
    })


@bp.get("/admin/pengguna")
@wajib_admin
def daftar_pengguna(_):
    rows = db.ambil(
        "SELECT u.id, u.nama, u.email, u.peran, u.aktif, u.dibuat, COUNT(r.id) AS jumlah, MAX(r.waktu) AS terakhir "
        "FROM users u LEFT JOIN riwayat r ON r.user_id = u.id GROUP BY u.id ORDER BY u.dibuat DESC")
    return jsonify({"pengguna": [{
        "id": x["id"], "nama": x["nama"], "email": x["email"], "peran": x["peran"], "aktif": bool(x["aktif"]),
        "dibuat": x["dibuat"].strftime("%Y-%m-%d"), "jumlah_pemeriksaan": int(x["jumlah"]),
        "terakhir": x["terakhir"].strftime("%Y-%m-%d %H:%M") if x["terakhir"] else None} for x in rows]})


@bp.patch("/admin/pengguna/<int:uid>")
@wajib_admin
def ubah_status(admin, uid):
    aktif = data_json().get("aktif")
    if not isinstance(aktif, bool):
        return galat("Kirim {\"aktif\": true} atau {\"aktif\": false}.")
    if uid == admin["id"]:
        return galat("Admin tidak dapat menonaktifkan akunnya sendiri.")
    if not db.ambil("SELECT id FROM users WHERE id=%s", (uid,), satu=True):
        return galat("Pengguna tidak ditemukan.", 404)
    db.ubah("UPDATE users SET aktif=%s WHERE id=%s", (int(aktif), uid))
    return jsonify({"pesan": "Akun diaktifkan." if aktif else "Akun dinonaktifkan.", "aktif": aktif})


@bp.get("/admin/pengguna/<int:uid>/riwayat")
@wajib_admin
def riwayat_pengguna(_, uid):
    u = db.ambil("SELECT id, nama, email, peran FROM users WHERE id=%s", (uid,), satu=True)
    if not u:
        return galat("Pengguna tidak ditemukan.", 404)
    rows = db.ambil("SELECT * FROM riwayat WHERE user_id=%s ORDER BY waktu DESC, id DESC", (uid,))
    return jsonify({"pengguna": u, "riwayat": [baris_riwayat(r) for r in rows]})


@bp.delete("/admin/pengguna/<int:uid>/riwayat")
@wajib_admin
def hapus_riwayat_pengguna(_, uid):
    _, n = db.ubah("DELETE FROM riwayat WHERE user_id=%s", (uid,))
    return jsonify({"pesan": f"{n} riwayat dihapus.", "dihapus": n})


@bp.delete("/admin/riwayat/<int:rid>")
@wajib_admin
def hapus_satu_riwayat(_, rid):
    _, n = db.ubah("DELETE FROM riwayat WHERE id=%s", (rid,))
    if not n:
        return galat("Riwayat tidak ditemukan.", 404)
    return jsonify({"pesan": "Riwayat dihapus.", "dihapus": n})
