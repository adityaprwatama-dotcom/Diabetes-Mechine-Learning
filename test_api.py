"""
Menguji API tanpa tampilan website. Jalankan SETELAH `python app.py` aktif (di terminal lain):
    python test_api.py
"""
import json
import urllib.request
import urllib.error

URL = "http://127.0.0.1:8000/predict"
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
for nama, data in KASUS.items():
    req = urllib.request.Request(URL, json.dumps(data).encode(), {"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            h = json.load(r)
            print(f"[{r.status}] {nama}: {h['label']} (skor {h['probability']:.0%})")
    except urllib.error.HTTPError as e:
        print(f"[{e.code}] {nama}: {json.load(e)['error']}")
    except urllib.error.URLError:
        print("Server belum berjalan. Jalankan dulu: python app.py")
        break
