"""
Menguji login, riwayat di database, admin, dan keamanan. Jalankan SETELAH `python app.py` aktif
dan MySQL di XAMPP menyala:
    python test_auth.py
Akun uji memakai email @uji.healthcheck.local dan dihapus lagi di akhir.
"""
import http.cookiejar
import json
import time
import urllib.error
import urllib.request
from werkzeug.security import generate_password_hash
import db

API = "http://127.0.0.1:8000"
DOMAIN = "@uji.healthcheck.local"
USER = {"nama": "Pengguna Uji", "email": "user" + DOMAIN, "password": "sandiUji123", "setuju": True}
ADMIN_EMAIL, ADMIN_SANDI = "admin" + DOMAIN, "adminUji123"
SEHAT = dict(gender="Female", age=25, hypertension=0, heart_disease=0, smoking_history="never", bmi=22, blood_glucose_level=90)
hasil = []


class Klien:
    """Browser kecil: menyimpan cookie sesi seperti browser sungguhan."""
    def __init__(self):
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    def __call__(self, metode, path, data=None, header=None):
        body = json.dumps(data).encode() if data is not None else None
        req = urllib.request.Request(API + path, body, {"Content-Type": "application/json", **(header or {})}, method=metode)
        try:
            with self.op.open(req) as r:
                return r.status, json.loads(r.read() or b"{}"), dict(r.headers)
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"{}"), dict(e.headers)


def cek(nama, kondisi, info=""):
    hasil.append(bool(kondisi))
    print(f"[{'LULUS' if kondisi else 'GAGAL'}] {nama}" + (f"  ->  {info}" if info else ""))


def bersihkan():
    db.ubah("DELETE FROM users WHERE email LIKE %s", ("%" + DOMAIN,))


try:
    db.ambil("SELECT 1")
except db.DatabaseMati:
    raise SystemExit("MySQL belum menyala. Nyalakan MySQL di XAMPP, lalu jalankan lagi.")
bersihkan()

# ---------------- tamu
tamu = Klien()
s, d, _ = tamu("POST", "/predict", SEHAT)
cek("1. Tamu (belum masuk) ditolak saat cek risiko", s == 401, d.get("error"))
s, d, _ = tamu("GET", "/auth/saya"); cek("2. Tamu: status belum masuk", s == 200 and d["masuk"] is False)
s, d, _ = tamu("GET", "/riwayat"); cek("3. Tamu tidak bisa membuka riwayat database", s == 401, d.get("error"))

# ---------------- daftar
u = Klien()
s, d, _ = u("POST", "/auth/daftar", {**USER, "setuju": False}); cek("4. Daftar tanpa persetujuan ditolak", s == 400, d.get("error"))
s, d, _ = u("POST", "/auth/daftar", {**USER, "password": "pendek"}); cek("5. Kata sandi < 8 karakter ditolak", s == 400, d.get("error"))
s, d, _ = u("POST", "/auth/daftar", {**USER, "email": "bukan-email"}); cek("6. Email tidak valid ditolak", s == 400, d.get("error"))
s, d, _ = u("POST", "/auth/daftar", USER); cek("7. Daftar akun user berhasil", s == 201 and d["pengguna"]["peran"] == "user")
s, d, _ = Klien()("POST", "/auth/daftar", USER); cek("8. Email yang sama tidak bisa daftar lagi", s == 409, d.get("error"))
baris = db.ambil("SELECT password_hash, setuju_simpan FROM users WHERE email=%s", (USER["email"],), satu=True)
cek("9. Kata sandi tersimpan sebagai hash, waktu persetujuan tercatat",
    baris["password_hash"] != USER["password"] and baris["password_hash"].startswith(("scrypt:", "pbkdf2:")) and baris["setuju_simpan"] is not None,
    baris["password_hash"].split("$")[0])
s, d, _ = u("GET", "/auth/saya"); cek("10. Setelah daftar langsung masuk", d["masuk"] is True and d["pengguna"]["email"] == USER["email"])

# ---------------- riwayat user
s1, d1, _ = u("POST", "/predict", SEHAT)
s2, d2, _ = u("POST", "/predict", {**SEHAT, "age": 62, "hypertension": 1, "blood_glucose_level": 220, "bmi": 33})
cek("11. Hasil cek risiko tersimpan saat login", d1.get("tersimpan") is True and d2.get("tersimpan") is True)
s, d, _ = u("GET", "/riwayat")
cek("12. Riwayat database berisi 2 hasil (terbaru di atas)", s == 200 and len(d["riwayat"]) == 2 and d["riwayat"][0]["label"] == d2["label"],
    [(r["label"], r["skor"]) for r in d.get("riwayat", [])])
cek("13. Skor yang disimpan sama dengan skor API", abs(d["riwayat"][1]["skor"] - d1["probability"]) < 1e-4)
s, d, _ = u("GET", "/admin/statistik"); cek("14. User biasa tidak bisa membuka halaman admin", s == 403, d.get("error"))

# ---------------- keluar / masuk
u("POST", "/auth/keluar")
s, d, _ = u("GET", "/auth/saya"); cek("15. Keluar berhasil", d["masuk"] is False)
s, d, _ = u("POST", "/auth/masuk", {"email": USER["email"], "password": "salah12345"}); cek("16. Kata sandi salah ditolak", s == 401, d.get("error"))
s, d, _ = u("POST", "/auth/masuk", {"email": "' OR 1=1 -- ", "password": "x' OR '1'='1"}); cek("17. Percobaan SQL injection ditolak", s == 401, d.get("error"))
s, d, _ = u("POST", "/auth/masuk", {"email": USER["email"].upper(), "password": USER["password"]}); cek("18. Masuk berhasil (email tidak peka huruf besar)", s == 200)

# ---------------- admin
db.ubah("INSERT INTO users (nama, email, password_hash, peran) VALUES (%s, %s, %s, 'admin')",
        ("Admin Uji", ADMIN_EMAIL, generate_password_hash(ADMIN_SANDI)))
a = Klien()
s, d, _ = a("POST", "/auth/masuk", {"email": ADMIN_EMAIL, "password": ADMIN_SANDI}); cek("19. Admin bisa masuk", s == 200 and d["pengguna"]["peran"] == "admin")
s, d, _ = a("GET", "/admin/statistik"); cek("20. Admin melihat statistik", s == 200 and d["pemeriksaan"] >= 2, d)
s, d, _ = a("GET", "/admin/pengguna")
uid = next((x["id"] for x in d.get("pengguna", []) if x["email"] == USER["email"]), None)
jml = next((x["jumlah_pemeriksaan"] for x in d.get("pengguna", []) if x["email"] == USER["email"]), None)
cek("21. Admin melihat daftar pengguna (tanpa password_hash)", s == 200 and uid and jml == 2 and "password_hash" not in json.dumps(d))
s, d, _ = a("GET", f"/admin/pengguna/{uid}/riwayat"); cek("22. Admin melihat riwayat seorang pengguna", s == 200 and len(d["riwayat"]) == 2)
rid = d["riwayat"][0]["id"]
s, _, _ = a("DELETE", f"/admin/riwayat/{rid}"); s2, _, _ = a("DELETE", f"/admin/riwayat/{rid}")
cek("23. Admin menghapus satu riwayat (hapus kedua kali = 404)", s == 200 and s2 == 404)
s, d, _ = a("DELETE", f"/admin/pengguna/{uid}/riwayat"); cek("24. Admin menghapus semua riwayat pengguna", s == 200 and d["dihapus"] == 1)
s, d, _ = a("PATCH", f"/admin/pengguna/{uid}", {"aktif": False}); cek("25. Admin menonaktifkan akun", s == 200 and d["aktif"] is False)
s, d, _ = u("GET", "/auth/saya"); cek("26. Akun nonaktif langsung keluar dari sesinya", d["masuk"] is False)
s, d, _ = Klien()("POST", "/auth/masuk", {"email": USER["email"], "password": USER["password"]}); cek("27. Akun nonaktif tidak bisa masuk", s == 403, d.get("error"))
aid = db.ambil("SELECT id FROM users WHERE email=%s", (ADMIN_EMAIL,), satu=True)["id"]
s, d, _ = a("PATCH", f"/admin/pengguna/{aid}", {"aktif": False}); cek("28. Admin tidak bisa menonaktifkan dirinya sendiri", s == 400, d.get("error"))
s, d, _ = a("PATCH", f"/admin/pengguna/{uid}", {"aktif": True})
s2, _, _ = Klien()("POST", "/auth/masuk", {"email": USER["email"], "password": USER["password"]})
cek("29. Akun diaktifkan kembali bisa masuk lagi", s == 200 and s2 == 200)

# ---------------- keamanan lain
k = Klien()
# email unik tiap run: blokir dari run sebelumnya masih tersimpan di memori API selama 15 menit
email_brute = f"brute{int(time.time())}{DOMAIN}"
kode = [k("POST", "/auth/masuk", {"email": email_brute, "password": f"tebak{i}"})[0] for i in range(6)]
cek("30. Login dibatasi setelah 5 kali gagal", kode[:5] == [401] * 5 and kode[5] == 429, kode)
_, _, h = k("OPTIONS", "/auth/masuk", header={"Origin": "http://127.0.0.1:5500", "Access-Control-Request-Method": "POST",
                                              "Access-Control-Request-Headers": "content-type"})
cek("31. CORS mengizinkan Live Server dengan cookie", h.get("Access-Control-Allow-Origin") == "http://127.0.0.1:5500"
    and h.get("Access-Control-Allow-Credentials") == "true")
_, _, h = k("OPTIONS", "/auth/masuk", header={"Origin": "http://situs-lain.example", "Access-Control-Request-Method": "POST"})
cek("32. CORS menolak situs lain", "Access-Control-Allow-Origin" not in h)
_, _, h = Klien()("POST", "/auth/masuk", {"email": ADMIN_EMAIL, "password": ADMIN_SANDI})
kuki = h.get("Set-Cookie", "")
cek("33. Cookie sesi HttpOnly dan SameSite=Lax", "HttpOnly" in kuki and "SameSite=Lax" in kuki)

# ---------------- fitur admin tambahan: grafik, CSV, hapus akun, tab Admin
def mentah(klien, path):
    """Ambil jawaban apa adanya (untuk CSV yang bukan JSON)."""
    try:
        with klien.op.open(urllib.request.Request(API + path)) as r:
            return r.status, r.read().decode("utf-8"), dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8"), dict(e.headers)


hari_ini = lambda g: g["harian"][-1]["tinggi"] + g["harian"][-1]["rendah"]
_, g0, _ = a("GET", "/admin/grafik")
u3 = Klien()
s, d, _ = u3("POST", "/auth/daftar", {"nama": "=2+3 Uji CSV", "email": "csv" + DOMAIN, "password": "sandiCsv123", "setuju": True})
u3("POST", "/predict", SEHAT)
s, g1, _ = a("GET", "/admin/grafik")
cek("34. Admin melihat grafik 14 hari (hari ini bertambah 1 setelah cek risiko)",
    s == 200 and len(g1["harian"]) == 14 and hari_ini(g1) == hari_ini(g0) + 1
    and g1["total"]["tinggi"] + g1["total"]["rendah"] == g0["total"]["tinggi"] + g0["total"]["rendah"] + 1,
    f"hari ini {hari_ini(g0)} -> {hari_ini(g1)}, tanggal terakhir {g1['harian'][-1]['tanggal']}")
s, d, _ = u3("GET", "/admin/grafik"); cek("35. User biasa tidak bisa membuka grafik admin", s == 403, d.get("error"))
s, teks, h = mentah(a, "/admin/ekspor.csv")
baris_csv = teks.lstrip("﻿").splitlines()
cek("36. Admin mengunduh CSV (header benar, berisi email pengguna, ada BOM untuk Excel)",
    s == 200 and h.get("Content-Type", "").startswith("text/csv") and teks.startswith("﻿")
    and baris_csv[0].startswith("waktu;nama;email;gender") and any(("csv" + DOMAIN) in b for b in baris_csv),
    f"{len(baris_csv) - 1} baris data")
cek("37. CSV aman dari rumus Excel (nama '=2+3' ditulis sebagai teks)", any(";'=2+3 Uji CSV;" in b for b in baris_csv))
s, teks, _ = mentah(u3, "/admin/ekspor.csv"); cek("38. User biasa tidak bisa mengunduh CSV", s == 403)
uid3 = db.ambil("SELECT id FROM users WHERE email=%s", ("csv" + DOMAIN,), satu=True)["id"]
s, d, _ = a("DELETE", f"/admin/pengguna/{uid3}", {"konfirmasi_email": "salah" + DOMAIN})
ada = db.ambil("SELECT COUNT(*) AS n FROM users WHERE id=%s", (uid3,), satu=True)["n"]
cek("39. Hapus akun dengan email konfirmasi salah ditolak (akun tetap ada)", s == 400 and ada == 1, d.get("error"))
s, d, _ = a("DELETE", f"/admin/pengguna/{uid3}", {"konfirmasi_email": "CSV" + DOMAIN.upper()})
sisa_u = db.ambil("SELECT COUNT(*) AS n FROM users WHERE id=%s", (uid3,), satu=True)["n"]
sisa_r = db.ambil("SELECT COUNT(*) AS n FROM riwayat WHERE user_id=%s", (uid3,), satu=True)["n"]
cek("40. Admin menghapus akun permanen (riwayatnya ikut terhapus)", s == 200 and sisa_u == 0 and sisa_r == 0, d.get("pesan"))
s, d, _ = u3("GET", "/auth/saya"); cek("41. Akun yang dihapus langsung keluar", d["masuk"] is False)
s, d, _ = a("DELETE", f"/admin/pengguna/{uid3}", {"konfirmasi_email": "csv" + DOMAIN}); cek("42. Hapus akun yang sudah tidak ada = 404", s == 404)
s, d, _ = a("DELETE", f"/admin/pengguna/{aid}", {"konfirmasi_email": ADMIN_EMAIL}); cek("43. Admin tidak bisa menghapus dirinya sendiri", s == 400, d.get("error"))
db.ubah("INSERT INTO users (nama, email, password_hash, peran) VALUES (%s, %s, %s, 'admin')",
        ("Admin Dua", "admin2" + DOMAIN, generate_password_hash(ADMIN_SANDI)))
aid2 = db.ambil("SELECT id FROM users WHERE email=%s", ("admin2" + DOMAIN,), satu=True)["id"]
s, d, _ = a("DELETE", f"/admin/pengguna/{aid2}", {"konfirmasi_email": "admin2" + DOMAIN}); cek("44. Admin lain tidak bisa dihapus dari website", s == 403, d.get("error"))
k2 = Klien()
s, d, _ = k2("POST", "/auth/masuk", {"email": USER["email"], "password": USER["password"], "sebagai": "admin"})
s2, d2, _ = k2("GET", "/auth/saya")
cek("45. Tab Admin menolak akun biasa (dan tidak membuat sesi)", s == 403 and d2["masuk"] is False, d.get("error"))
s, d, _ = Klien()("POST", "/auth/masuk", {"email": ADMIN_EMAIL, "password": ADMIN_SANDI, "sebagai": "admin"})
cek("46. Tab Admin menerima akun admin", s == 200 and d["pengguna"]["peran"] == "admin")

bersihkan()
sisa =db.ambil("SELECT COUNT(*) AS n FROM users WHERE email LIKE %s", ("%" + DOMAIN,), satu=True)["n"]
print(f"\nAkun uji dibersihkan (sisa: {sisa}).")
print(f"HASIL: {sum(hasil)} dari {len(hasil)} pengecekan lulus." + ("  SEMUA LULUS" if all(hasil) else "  ADA YANG GAGAL"))
