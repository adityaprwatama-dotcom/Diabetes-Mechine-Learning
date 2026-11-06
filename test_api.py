"""
Menguji API tanpa tampilan website. Jalankan SETELAH `python app.py` aktif (di terminal lain)
dan MySQL di XAMPP menyala (cek risiko wajib login):
    python test_api.py
Memakai akun uji sementara @uji.healthcheck.local yang dihapus lagi di akhir.
"""
import http.cookiejar
import json
import urllib.request
import urllib.error
import db

API = "http://127.0.0.1:8000"
URL = API + "/predict"
AKUN = {"nama": "Uji API", "email": "api@uji.healthcheck.local", "password": "sandiUjiApi123", "setuju": True}
SEHAT = dict(gender="Female", age=25, hypertension=0, heart_disease=0, smoking_history="never",
             bmi=22, blood_glucose_level=90)
RISIKO = dict(gender="Male", age=62, hypertension=1, heart_disease=1, smoking_history="former",
              bmi=33, blood_glucose_level=220)
KASUS = {
    "Perempuan sehat": SEHAT,
    "Laki-laki berisiko": RISIKO,
    "Perempuan berisiko": {**RISIKO, "gender": "Female"},
    "Gula darah kosong": {k: v for k, v in SEHAT.items() if k != "blood_glucose_level"},
    "Gender tidak valid (Other)": {**SEHAT, "gender": "Other"},
    "Gula darah bukan angka": {**SEHAT, "blood_glucose_level": "abc"},
    "Usia tidak masuk akal": {**SEHAT, "age": 0},
}
gagal = []


def kirim(buka, url, data):
    return buka(urllib.request.Request(url, json.dumps(data).encode(), {"Content-Type": "application/json"}))


try:
    db.ambil("SELECT 1")
except db.DatabaseMati:
    raise SystemExit("MySQL belum menyala. Nyalakan MySQL di XAMPP, lalu jalankan lagi.")
hapus_akun = lambda: db.ubah("DELETE FROM users WHERE email=%s", (AKUN["email"],))
hapus_akun()

# 1) tanpa login harus ditolak
try:
    kirim(urllib.request.urlopen, URL, SEHAT)
    print("[200] Tanpa login: seharusnya ditolak")
    gagal.append("tanpa login tidak ditolak")
except urllib.error.HTTPError as e:
    print(f"[{e.code}] Tanpa login: {json.load(e)['error']}")
    if e.code != 401:
        gagal.append(f"tanpa login seharusnya 401, didapat {e.code}")
except urllib.error.URLError:
    raise SystemExit("Server belum berjalan. Jalankan dulu: python app.py")

# 2) masuk dengan akun uji (cookie sesi disimpan seperti browser)
buka = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())).open
kirim(buka, API + "/auth/daftar", AKUN).close()
print("Akun uji dibuat dan masuk.\n")

for nama, data in KASUS.items():
    try:
        with kirim(buka, URL, data) as r:
            h = json.load(r)
            print(f"[{r.status}] {nama}: {h['label']} (skor {h['probability']:.0%})")
            for f in h.get("faktor", []):
                print(f"        faktor: {f['teks']}")
            print(f"        rekomendasi: {len(h.get('rekomendasi', []))} saran")
            if not h.get("rekomendasi"):
                gagal.append(f"{nama}: rekomendasi kosong")
            if nama != "Perempuan sehat":
                fitur_faktor = [f["fitur"] for f in h.get("faktor", [])]
                if "blood_glucose_level" not in fitur_faktor or "hypertension" not in fitur_faktor:
                    gagal.append(f"{nama}: gula darah dan hipertensi seharusnya muncul sebagai faktor")
            elif h.get("faktor"):
                gagal.append(f"{nama}: orang sehat seharusnya tidak punya faktor yang menonjol")
    except urllib.error.HTTPError as e:
        print(f"[{e.code}] {nama}: {json.load(e)['error']}")
    except urllib.error.URLError:
        print("Server belum berjalan. Jalankan dulu: python app.py")
        gagal.append("server tidak berjalan")
        break

hapus_akun()
print("\nAkun uji dihapus (riwayatnya ikut terhapus).")
print("\nSEMUA PENGECEKAN FAKTOR/REKOMENDASI LULUS" if not gagal else "\nGAGAL:\n- " + "\n- ".join(gagal))
