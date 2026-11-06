"""
API Flask untuk prediksi risiko diabetes (model dari Diabetes Prediction Dataset).

Cara pakai:
  1. Taruh file ini di folder yang SAMA dengan model_diabetes.pkl dan fitur.json
  2. python -m pip install -r requirements.txt
  3. (untuk login) nyalakan MySQL di XAMPP dan siapkan .env (lihat README.md)
  4. python app.py   (server di http://127.0.0.1:8000)
Cek risiko tetap bisa dipakai tanpa login dan tanpa MySQL. Endpoint login/admin ada di auth.py.
"""
import json
import os
import secrets
import joblib
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS
import auth

BASE = os.path.dirname(os.path.abspath(__file__))
model = joblib.load(os.path.join(BASE, "model_diabetes.pkl"))
with open(os.path.join(BASE, "fitur.json")) as f:
    FITUR = json.load(f)   # urutan kolom harus sama dengan saat training

GENDER = {"Female", "Male"}
MEROKOK = {"No Info", "current", "ever", "former", "never", "not current"}
BINER = {"hypertension", "heart_disease"}
RENTANG = {"age": (1, 120), "bmi": (10, 70), "HbA1c_level": (3, 15), "blood_glucose_level": (40, 600)}
NAMA = {"gender": "Jenis kelamin", "age": "Usia", "hypertension": "Hipertensi", "heart_disease": "Penyakit jantung",
        "smoking_history": "Riwayat merokok", "bmi": "BMI", "HbA1c_level": "HbA1c", "blood_glucose_level": "Gula darah"}
DISCLAIMER = "Hasil ini adalah skrining awal berbasis AI, bukan diagnosis medis. Konsultasikan dengan dokter."
NAMA_MEROKOK = {"never": "tidak pernah merokok", "current": "perokok aktif", "former": "mantan perokok",
                "not current": "saat ini tidak merokok", "ever": "pernah merokok", "No Info": "tidak ada informasi"}
BATAS_FAKTOR = 0.1   # faktor dengan kontribusi lebih kecil dari ini dianggap tidak menonjol


def hitung_faktor(nilai):
    """Faktor yang paling MENAIKKAN skor dibanding titik acuan.

    Acuan: usia, BMI, gula darah = rata-rata data latih; hipertensi dan penyakit jantung = tidak;
    merokok = tidak pernah; jenis kelamin = sama dengan pengguna (jadi tidak pernah menjadi faktor).
    Kontribusi = koefisien Logistic Regression x selisih nilai (setelah praproses) terhadap acuan.
    Hanya membaca model; skor dan label tidak berubah.
    """
    praproses, clf = model.named_steps["praproses"], model.named_steps["clf"]
    if not hasattr(clf, "coef_"):
        return []
    skaler = praproses.named_transformers_["angka"]
    rata = dict(zip(skaler.feature_names_in_, skaler.mean_))
    acuan = {**nilai, "hypertension": 0, "heart_disease": 0, "smoking_history": "never", **rata}
    selisih = (praproses.transform(pd.DataFrame([nilai], columns=FITUR))
               - praproses.transform(pd.DataFrame([acuan], columns=FITUR)))[0] * clf.coef_[0]
    kontribusi = dict.fromkeys(FITUR, 0.0)
    for nama_kolom, s in zip(praproses.get_feature_names_out(), selisih):
        asal = nama_kolom.split("__", 1)[1]
        kontribusi[next(k for k in FITUR if asal == k or asal.startswith(k + "_"))] += s

    def teks(k):
        v = nilai[k]
        if k == "blood_glucose_level":
            return f"Gula darah {v:g} mg/dL (rata-rata data: {rata[k]:.0f} mg/dL)"
        if k == "age":
            return f"Usia {v:g} tahun (rata-rata data: {rata[k]:.0f} tahun)"
        if k == "bmi":
            return f"BMI {v:.1f} (rata-rata data: {rata[k]:.1f})"
        if k == "hypertension":
            return "Pernah didiagnosis hipertensi"
        if k == "heart_disease":
            return "Pernah didiagnosis penyakit jantung"
        return f"Riwayat merokok: {NAMA_MEROKOK.get(v, v)}"

    urut = sorted((k for k in FITUR if k != "gender" and kontribusi[k] > BATAS_FAKTOR),
                  key=lambda k: kontribusi[k], reverse=True)
    return [{"fitur": k, "teks": teks(k), "kontribusi": round(float(kontribusi[k]), 3)} for k in urut[:3]]


def buat_rekomendasi(nilai, tinggi):
    """Saran umum (bukan resep medis) berdasarkan hasil dan isian."""
    saran = []
    if tinggi:
        saran.append("Skor Anda tergolong tinggi. Periksakan diri ke dokter atau puskesmas untuk tes lanjutan, "
                     "misalnya gula darah puasa atau HbA1c.")
    g = nilai["blood_glucose_level"]
    if g >= 200:
        saran.append("Kadar gula darah Anda 200 mg/dL atau lebih. Angka ini sangat tinggi; segera konsultasikan ke dokter.")
    elif g >= 126:
        saran.append("Bila gula darah ini diukur saat puasa, angka 126 mg/dL atau lebih perlu diperiksakan ke dokter. "
                     "Kurangi minuman manis dan pantau gula darah secara berkala.")
    b = nilai["bmi"]
    if b >= 30:
        saran.append("BMI Anda termasuk obesitas. Turunkan berat badan secara bertahap dengan pola makan teratur dan aktif bergerak.")
    elif b >= 25:
        saran.append("BMI Anda termasuk berat badan berlebih. Jaga porsi makan dan tambah aktivitas fisik.")
    if nilai["smoking_history"] == "current":
        saran.append("Berhenti merokok dapat menurunkan risiko diabetes dan penyakit jantung. Puskesmas dapat membantu program berhenti merokok.")
    if nilai["hypertension"] == 1 or nilai["heart_disease"] == 1:
        saran.append("Lanjutkan kontrol rutin tekanan darah dan jantung sesuai anjuran dokter.")
    saran.append("Jaga pola makan seimbang (perbanyak sayur, batasi gula dan gorengan) dan aktif bergerak "
                 "sekitar 150 menit per minggu.")
    return saran

app = Flask(__name__)
# Kunci sesi login dari .env. Bila kosong, dibuat acak (semua orang otomatis keluar saat API dinyalakan ulang).
app.secret_key = os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(32)
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")
# Hanya halaman web proyek yang boleh memanggil API dengan cookie login.
ASAL_WEB = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://127.0.0.1:5500,http://localhost:5500").split(",") if x.strip()]
CORS(app, origins=ASAL_WEB, supports_credentials=True)
app.register_blueprint(auth.bp)


@app.get("/health")
def health():
    return jsonify({"status": "ok", "fitur": FITUR})


@app.post("/predict")
def predict():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Kirim data dalam format JSON."}), 400

    nilai, galat = {}, []
    for k in FITUR:
        v = data.get(k)
        if v is None or (isinstance(v, str) and v.strip() == ""):
            galat.append(f"{NAMA[k]} wajib diisi.")
        elif k == "gender":
            nilai[k] = v if v in GENDER else galat.append(f"{NAMA[k]} harus Female atau Male.")
        elif k == "smoking_history":
            nilai[k] = v if v in MEROKOK else galat.append(f"{NAMA[k]} tidak dikenali.")
        else:
            try:
                x = float(v)
            except (TypeError, ValueError):
                galat.append(f"{NAMA[k]} harus berupa angka.")
                continue
            if k in BINER and x not in (0, 1):
                galat.append(f"{NAMA[k]} harus bernilai 0 atau 1.")
            elif k in RENTANG and not (RENTANG[k][0] <= x <= RENTANG[k][1]):
                galat.append(f"{NAMA[k]} harus antara {RENTANG[k][0]} dan {RENTANG[k][1]}.")
            else:
                nilai[k] = x
    if galat or len(nilai) != len(FITUR):
        pesan = [g for g in galat if g] or ["Data tidak valid."]
        return jsonify({"error": " ".join(pesan), "detail": pesan}), 400

    X = pd.DataFrame([nilai], columns=FITUR)
    skor = float(model.predict_proba(X)[0][1])
    tinggi = skor >= 0.5
    label = "Risiko tinggi" if tinggi else "Risiko rendah"
    return jsonify({
        "label": label,
        "probability": round(skor, 4),     # skor risiko model (bukan peluang pasti)
        "confidence": round(skor if tinggi else 1 - skor, 4),
        "faktor": hitung_faktor(nilai),            # maksimal 3 faktor yang paling menaikkan skor
        "rekomendasi": buat_rekomendasi(nilai, tinggi),
        "disclaimer": DISCLAIMER,
        "tersimpan": auth.simpan_riwayat(nilai, skor, label),   # True bila pengguna sedang login
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=False)
