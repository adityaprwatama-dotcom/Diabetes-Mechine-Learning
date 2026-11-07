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

### 2. Menyiapkan database (wajib, sekali saja)
Website **wajib login**, jadi langkah ini harus dilakukan. Tanpa MySQL, website tidak bisa dipakai.
1. Pasang [XAMPP](https://www.apachefriends.org/), buka **XAMPP Control Panel**, klik **Start** pada **MySQL**.
2. Buat database dan tabel:
   ```
   C:\xampp\mysql\bin\mysql.exe -u root -e "source schema.sql"
   ```
3. Buat user MySQL khusus proyek (ganti `SANDI_ANDA` dengan kata sandi buatan sendiri):
   ```
   C:\xampp\mysql\bin\mysql.exe -u root -e "CREATE USER 'healthcheck'@'localhost' IDENTIFIED BY 'SANDI_ANDA'; GRANT SELECT, INSERT, UPDATE, DELETE ON healthcheck.* TO 'healthcheck'@'localhost'; FLUSH PRIVILEGES;"
   ```
4. Salin `.env.example` menjadi `.env`, lalu isi `DB_PASSWORD` (sama dengan `SANDI_ANDA`) dan `FLASK_SECRET_KEY` (teks acak panjang). **Jangan upload `.env` ke GitHub.**
   ```
   copy .env.example .env
   notepad .env
   ```
5. Buat akun admin (admin tidak bisa mendaftar lewat website):
   ```
   python buat_admin.py
   ```

### 3. Menjalankan
1. Buka PowerShell di folder proyek, jalankan API dan **biarkan jendelanya terbuka**:
   ```
   python app.py
   ```
2. Di VS Code, klik kanan `index.html` > **Open with Live Server**, lalu tekan **Ctrl+F5**.
3. Website langsung menampilkan layar **Masuk / Daftar / Admin**. Pengguna membuat akun (tab **Daftar**) atau masuk (tab **Masuk**). Admin memakai tab **Admin** dan langsung dibawa ke **Dasbor Admin** (statistik, grafik 14 hari, cari pengguna, unduh CSV, lihat/hapus riwayat, nonaktifkan atau hapus akun).
4. Buka menu **Cek Risiko**, isi form, klik **Proses pemeriksaan**. Hasil otomatis tersimpan di database pada akun Anda.

### 4. Menguji (opsional)
Di jendela PowerShell **kedua** (API tetap menyala di jendela pertama):
```
python test_api.py
python test_auth.py
```
Hasil yang benar: `SEMUA PENGECEKAN FAKTOR/REKOMENDASI LULUS` dan `46 dari 46 pengecekan lulus`. Keduanya butuh MySQL menyala; akun uji dihapus otomatis.

### 5. Melatih ulang model (hanya bila perlu)
Model sudah tersedia di repo. Latih ulang hanya bila daftar fitur diubah atau model gagal dimuat:
```
python train_model_dpd.py
```

## Struktur folder
```
index.html                 halaman utama (Beranda, Cek Risiko, Riwayat, Edukasi, Profil, Akun, Dasbor Admin)
css/style.css              tampilan
js/config.js               alamat API
js/app.js                  validasi form, hitung BMI, panggil API, hasil, login, riwayat, admin
js/questions.js            daftar pertanyaan (saat ini belum dipakai oleh app.js)
app.py                     API Flask: GET /health, POST /predict (+ mendaftarkan auth.py)
auth.py                    endpoint login, riwayat database, dan admin
db.py                      koneksi MySQL (membaca .env)
schema.sql                 tabel users dan riwayat
buat_admin.py              membuat akun admin
.env.example               contoh pengaturan (salin menjadi .env, jangan upload .env)
train_model_dpd.py         pelatihan model
test_api.py                uji API prediksi
test_auth.py               uji login, riwayat, admin, dan keamanan
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
- **"Database belum menyala"** saat masuk/daftar: Start MySQL di XAMPP Control Panel. Website wajib login, jadi MySQL harus menyala.
- **Sudah masuk tapi langsung keluar lagi**: buka website di `http://127.0.0.1:5500` (bukan file:// langsung) agar cookie login terkirim.
- **Port 8000 sudah dipakai** atau fitur baru tidak muncul (misalnya grafik admin kosong): kemungkinan ada dua `python app.py` menyala. Tutup semua jendela `python app.py`, lalu jalankan satu saja.
- **File CSV terbuka berantakan di Excel**: file memakai pemisah titik koma (;). Bila Excel Anda berbahasa Inggris, buka lewat Data > From Text/CSV dan pilih pemisah Semicolon. File CSV berisi data kesehatan, jangan disebarkan.
- **Model gagal dimuat**: jalankan `python -m pip install -r requirements.txt`, lalu bila masih gagal `python train_model_dpd.py`.
- Jangan membuka lalu menyimpan file CSV dataset dengan Excel.
