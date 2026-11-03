"""
API Flask untuk prediksi risiko diabetes (model dari Diabetes Prediction Dataset).

Cara pakai:
  1. Taruh file ini di folder yang SAMA dengan model_diabetes.pkl dan fitur.json
  2. pip install flask flask-cors pandas scikit-learn joblib
  3. python app.py   (server di http://127.0.0.1:8000)
"""
import json
import os
import joblib
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

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

app = Flask(__name__)
CORS(app)


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
    return jsonify({
        "label": "Risiko tinggi" if tinggi else "Risiko rendah",
        "probability": round(skor, 4),     # skor risiko model (bukan peluang pasti)
        "confidence": round(skor if tinggi else 1 - skor, 4),
        "disclaimer": DISCLAIMER,
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=False)
