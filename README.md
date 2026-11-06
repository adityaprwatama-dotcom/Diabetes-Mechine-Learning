# HealthCheck: Cek Risiko Diabetes

Website skrining awal risiko diabetes berbasis machine learning (Projek Akhir III).
Pengguna mengisi form (usia, jenis kelamin, berat dan tinggi badan, gula darah, hipertensi,
penyakit jantung, riwayat merokok), lalu model memberi **skor risiko model**, faktor yang paling
menaikkan skor, dan rekomendasi umum.

> **Bukan alat diagnosis.** Hasil hanya untuk edukasi dan skrining awal. Konsultasikan dengan dokter.

## Teknologi
- Frontend: HTML, CSS, JavaScript biasa (tanpa framework)
- Backend: Python Flask (`app.py`), port 8000
- Model: scikit-learn Logistic Regression (`model_diabetes.pkl`)
- Dataset: [Diabetes Prediction Dataset](https://www.kaggle.com/datasets/iammustafatz/diabetes-prediction-dataset) (Kaggle), 100.000 baris

## Cara menjalankan (Windows)

### 1. Persiapan (sekali saja)
1. Pasang [Python 3.13](https://www.python.org/downloads/). Saat memasang, **centang "Add python.exe to PATH"**.
2. Pasang [VS Code](https://code.visualstudio.com/) dan ekstensi **Live Server**.
3. Unduh proyek:
   ```
   git clone https://github.com/adityaprwatama-dotcom/Diabetes-Mechine-Learning.git
   cd Diabetes-Mechine-Learning
   ```
4. Pasang library:
   ```
   python -m pip install -r requirements.txt
   ```

### 2. Menjalankan
1. Buka PowerShell di folder proyek, jalankan API dan **biarkan jendelanya terbuka**:
   ```
   python app.py
   ```
2. Di VS Code, klik kanan `index.html` > **Open with Live Server**, lalu tekan **Ctrl+F5**.
3. Buka menu **Cek Risiko**, isi form, klik **Proses pemeriksaan**.

### 3. Menguji API (opsional)
Di jendela PowerShell **kedua** (API tetap menyala di jendela pertama):
```
python test_api.py
```
Hasil yang benar diakhiri tulisan `SEMUA PENGECEKAN FAKTOR/REKOMENDASI LULUS`.

### 4. Melatih ulang model (hanya bila perlu)
Model sudah tersedia di repo. Latih ulang hanya bila daftar fitur diubah atau model gagal dimuat:
```
python train_model_dpd.py
```

## Struktur folder
```
index.html                 halaman utama (Beranda, Cek Risiko, Riwayat, Edukasi, Profil)
css/style.css              tampilan
js/config.js               alamat API
js/app.js                  validasi form, hitung BMI, panggil API, tampilkan hasil
js/questions.js            daftar pertanyaan (saat ini belum dipakai oleh app.js)
app.py                     API Flask: GET /health, POST /predict
train_model_dpd.py         pelatihan model
test_api.py                uji API
model_diabetes.pkl         model hasil pelatihan
fitur.json                 daftar 7 fitur yang dipakai model
dataset/                   Diabetes Prediction Dataset (CSV)
docs/KONTEKS.md            riwayat keputusan, metrik, status proyek
```

## Hasil model (data uji 19.226 baris)
| Metrik | Logistic Regression |
|---|---|
| Akurasi | 0,813 |
| Presisi | 0,294 |
| Recall | 0,802 |
| ROC AUC | 0,901 |

Kolom `HbA1c_level` sengaja tidak dipakai karena membutuhkan tes laboratorium. Rincian dan
keterbatasan ada di `docs/KONTEKS.md`.

## Masalah yang sering terjadi
- **`python` tidak dikenali**: pasang ulang Python dan centang "Add python.exe to PATH".
- **"Tidak dapat terhubung ke API"** di website: pastikan `python app.py` sedang berjalan.
- **Port 8000 sudah dipakai**: tutup jendela `python app.py` lain yang masih terbuka.
- **Model gagal dimuat**: jalankan `python -m pip install -r requirements.txt`, lalu bila masih gagal `python train_model_dpd.py`.
- Jangan membuka lalu menyimpan file CSV dataset dengan Excel.
