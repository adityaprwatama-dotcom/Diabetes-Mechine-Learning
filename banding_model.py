"""
Perbandingan Logistic Regression (model yang dipakai website) dengan algoritma machine learning lain.

Data, pembersihan, 7 fitur, dan pembagian data SAMA PERSIS dengan train_model_dpd.py
(gender "Other" dan duplikat dibuang, data uji 20%, random_state=42, stratify), jadi hasilnya adil.
Skrip ini TIDAK menyimpan model apa pun dan tidak mengubah model_diabetes.pkl.

Cara pakai (dari folder proyek):
    python banding_model.py
Lama: sekitar 15-30 detik.
"""
import os
import time
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score, precision_score, recall_score,
                             roc_auc_score)
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier

BASE = os.path.dirname(os.path.abspath(__file__))
NAMA_FILE = os.path.join(BASE, "dataset", "diabetes_prediction_dataset.csv")
FITUR = ["gender", "age", "hypertension", "heart_disease", "smoking_history", "bmi", "blood_glucose_level"]
GENDER = ["Female", "Male"]
MEROKOK = ["No Info", "current", "ever", "former", "never", "not current"]

# ---------- 1. Data (sama dengan train_model_dpd.py) ----------
if not os.path.exists(NAMA_FILE):
    raise SystemExit(f"File {NAMA_FILE} tidak ditemukan.")
df = pd.read_csv(NAMA_FILE)
df = df[df["gender"].isin(GENDER)].drop_duplicates()
X, y = df[FITUR], df["diabetes"]
X_latih, X_uji, y_latih, y_uji = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
print(f"Data bersih: {len(df)} baris. Latih: {len(X_latih)}, uji: {len(X_uji)} "
      f"({int(y_uji.sum())} diabetes, {100 * y_uji.mean():.1f}%).")
print(f"Pembanding: menebak 'tidak diabetes' untuk semua orang sudah mendapat akurasi "
      f"{100 * (1 - y_uji.mean()):.1f}%, padahal tidak mendeteksi satu pun. Jadi lihat juga recall.\n")


def praproses():
    return ColumnTransformer([
        ("kategori", OneHotEncoder(categories=[GENDER, MEROKOK], sparse_output=False), ["gender", "smoking_history"]),
        ("angka", StandardScaler(), ["age", "bmi", "blood_glucose_level"]),
    ], remainder="passthrough")   # hypertension dan heart_disease sudah 0/1


# ---------- 2. Algoritma yang dibandingkan ----------
# class_weight="balanced" dipakai bila algoritmanya mendukung, karena data diabetes hanya sekitar 8,8%.
MODEL = {
    "Logistic Regression (dipakai)": LogisticRegression(class_weight="balanced", max_iter=1000),
    "Decision Tree": DecisionTreeClassifier(class_weight="balanced", max_depth=8, random_state=42),
    "Random Forest": RandomForestClassifier(n_estimators=200, class_weight="balanced", min_samples_leaf=5,
                                            n_jobs=-1, random_state=42),
    "Gradient Boosting": HistGradientBoostingClassifier(class_weight="balanced", random_state=42),
    "K-Nearest Neighbors (k=15)": KNeighborsClassifier(n_neighbors=15, n_jobs=-1),
    "Naive Bayes (Gaussian)": GaussianNB(),
}

# ---------- 3. Latih dan nilai tiap algoritma dengan data uji yang sama ----------
baris = []
for nama, clf in MODEL.items():
    model = Pipeline([("praproses", praproses()), ("clf", clf)])
    mulai = time.time()
    model.fit(X_latih, y_latih)
    lama = time.time() - mulai
    pred, prob = model.predict(X_uji), model.predict_proba(X_uji)[:, 1]
    tn, fp, fn, tp = confusion_matrix(y_uji, pred).ravel()
    baris.append({"Model": nama, "Akurasi": accuracy_score(y_uji, pred), "Presisi": precision_score(y_uji, pred),
                  "Recall": recall_score(y_uji, pred), "F1": f1_score(y_uji, pred),
                  "ROC AUC": roc_auc_score(y_uji, prob), "Terlewat (FN)": fn, "Salah alarm (FP)": fp,
                  "Detik latih": lama})
    if nama.startswith("Logistic"):
        nama_fitur = [n.split("__")[-1] for n in model.named_steps["praproses"].get_feature_names_out()]
        koef = pd.Series(model.named_steps["clf"].coef_[0], index=nama_fitur).sort_values(ascending=False)

# ---------- 4. Tampilkan dalam persen ----------
hasil = pd.DataFrame(baris).set_index("Model")
pd.set_option("display.width", 200)
tampil = hasil.copy()
for k in ["Akurasi", "Presisi", "Recall", "F1", "ROC AUC"]:
    tampil[k] = (tampil[k] * 100).map(lambda v: f"{v:.1f}%")
tampil["Detik latih"] = tampil["Detik latih"].map(lambda v: f"{v:.1f}")
print("=== PERBANDINGAN ALGORITMA (data uji yang sama) ===")
print(tampil.to_string())
print("\nRecall = persen penderita diabetes yang berhasil terdeteksi (paling penting untuk skrining).")
print("Terlewat (FN) = penderita yang tidak terdeteksi. Salah alarm (FP) = orang sehat yang ditebak berisiko.")
print("\nKoefisien Logistic Regression (makin positif = makin menaikkan skor risiko):")
print(koef.round(3).to_string())
