"""
Melatih model Logistic Regression dari Diabetes Prediction Dataset (Kaggle, iammustafatz).

Persiapan:
  1. Unduh diabetes_prediction_dataset.csv dari Kaggle (lihat README.md).
  2. Taruh file itu di folder yang sama dengan file ini.
  3. python train_model_dpd.py
Hasil: model_diabetes.pkl dan fitur.json (dipakai oleh app.py).
"""
import json
import os
import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, classification_report, confusion_matrix, f1_score,
                             precision_score, recall_score, roc_auc_score)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

NAMA_FILE = "dataset/diabetes_prediction_dataset.csv"
TARGET = "diabetes"
# 7 fitur dipakai. Kolom HbA1c_level di dataset TIDAK dipakai karena butuh pemeriksaan laboratorium khusus.
FITUR = ["gender", "age", "hypertension", "heart_disease", "smoking_history", "bmi", "blood_glucose_level"]
GENDER = ["Female", "Male"]
MEROKOK = ["No Info", "current", "ever", "former", "never", "not current"]

# ---------- 1. Baca data ----------
if not os.path.exists(NAMA_FILE):
    raise SystemExit(f"File {NAMA_FILE} tidak ditemukan di folder ini. Unduh dari Kaggle dan taruh di sini.")
df = pd.read_csv(NAMA_FILE)
kurang = [c for c in FITUR + [TARGET] if c not in df.columns]   # HbA1c_level boleh tetap ada di file, hanya tidak dipakai
if kurang:
    raise SystemExit(f"Kolom ini tidak ada di file: {kurang}. Pastikan memakai file yang benar.")
print("Ukuran data awal:", df.shape)
print("Jumlah kelas:\n", df[TARGET].value_counts(), "\n")
print("Jenis kelamin:\n", df["gender"].value_counts(), "\n")

# ---------- 2. Bersihkan data ----------
n_other = int((df["gender"] == "Other").sum())
df = df[df["gender"].isin(GENDER)]                      # kategori "Other" terlalu sedikit untuk dipelajari model
n_dup = int(df.duplicated().sum())
df = df.drop_duplicates()                               # duplikat bisa membuat data uji "bocor" ke data latih
print(f"Dibuang: {n_other} baris gender 'Other' dan {n_dup} baris duplikat. Sisa data: {df.shape[0]}\n")

# ---------- 3. Bagi data ----------
X, y = df[FITUR], df[TARGET]
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

# ---------- 4. Susun model ----------
praproses = ColumnTransformer([
    ("kategori", OneHotEncoder(categories=[GENDER, MEROKOK]), ["gender", "smoking_history"]),
    ("angka", StandardScaler(), ["age", "bmi", "blood_glucose_level"]),
], remainder="passthrough")                              # hypertension dan heart_disease sudah 0/1
model = Pipeline([("praproses", praproses), ("clf", LogisticRegression(class_weight="balanced", max_iter=1000))])
model.fit(X_train, y_train)

def nilai(m):
    pred, prob = m.predict(X_test), m.predict_proba(X_test)[:, 1]
    return dict(Akurasi=accuracy_score(y_test, pred), Precision=precision_score(y_test, pred),
                Recall=recall_score(y_test, pred), F1=f1_score(y_test, pred), ROC_AUC=roc_auc_score(y_test, prob))

# ---------- 5. Evaluasi ----------
hasil = nilai(model)
print("=== HASIL EVALUASI Logistic Regression (data uji) ===")
for k, v in hasil.items():
    print(f"{k:9}: {v:.3f}")
print("\nConfusion matrix (baris = asli, kolom = prediksi):")
print(confusion_matrix(y_test, model.predict(X_test)))
print("\n", classification_report(y_test, model.predict(X_test), target_names=["Tidak diabetes", "Diabetes"]))
print("=== Recall per jenis kelamin ===")
for nama in GENDER:
    m = X_test["gender"] == nama
    print(f"{nama:8}: recall {recall_score(y_test[m], model.predict(X_test[m])):.3f}  (n={int(m.sum())})")

# ---------- 6. Pembanding (tidak disimpan) ----------
print("\n=== Perbandingan model ===")
pembanding = Pipeline([("praproses", praproses), ("clf", HistGradientBoostingClassifier(class_weight="balanced", random_state=42))]).fit(X_train, y_train)
print(pd.DataFrame({"Logistic Regression": hasil, "Gradient Boosting": nilai(pembanding)}).T.round(3))

# ---------- 7. Faktor paling berpengaruh ----------
nama_fitur = [n.split("__")[-1] for n in model.named_steps["praproses"].get_feature_names_out()]
koef = pd.Series(model.named_steps["clf"].coef_[0], index=nama_fitur).sort_values(ascending=False)
print("\nKoefisien (makin positif = makin menaikkan skor risiko):")
print(koef.round(3))

# ---------- 8. Simpan ----------
joblib.dump(model, "model_diabetes.pkl")
with open("fitur.json", "w") as f:
    json.dump(FITUR, f)
print("\nModel disimpan ke model_diabetes.pkl dan fitur.json")
