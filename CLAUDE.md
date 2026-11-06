# Proyek Akhir III: Website Cek Risiko Diabetes "HealthCheck"

## Ringkasan
Tugas kelompok kuliah: website kesehatan berbasis machine learning yang memperkirakan risiko diabetes dari isian form.
Pemilik: Tresure (mahasiswa Rekayasa Perangkat Lunak, masih pemula Python, memakai Windows + VS Code + PowerShell).
Website BUKAN alat diagnosis. Disclaimer medis wajib tampil di form, hasil, dan footer.
Riwayat keputusan, metrik, desain Figma, dan daftar tugas: @docs/KONTEKS.md

## Cara bekerja dengan Tresure
- Jawab dalam bahasa Indonesia, sederhana, langkah demi langkah, sesuaikan untuk Windows (PowerShell).
- Sebelum mengubah banyak file, tulis rencana singkat dan tunggu persetujuan.
- Sebutkan file mana yang berubah dan kenapa. Jangan mengubah file yang tidak diminta.
- Jalankan pengujian setelah perubahan dan laporkan hasil sebenarnya. Jangan mengklaim "sudah jalan" tanpa menjalankannya.
- Jangan menghapus file pengguna tanpa bertanya. Jangan menaruh kata sandi atau kunci di kode atau di Git.
- Angka evaluasi harus berasal dari hasil menjalankan skrip, bukan dari ingatan.

## Aturan proyek (jangan dilanggar)
1. **Fitur di form harus sesuai kolom dataset** (aturan dosen). Setiap pertanyaan di form dipetakan ke satu kolom dataset. Kolom yang tidak dipakai harus punya alasan tertulis (saat ini: `HbA1c_level`, karena butuh tes lab khusus; BELUM dikonfirmasi dosen).
2. **Mengubah tampilan tidak boleh mengubah algoritma.** `app.py`, `auth.py`, `train_model_dpd.py`, model, dan dataset jangan disentuh saat mengerjakan HTML/CSS. Jangan ubah `id` elemen di `index.html` yang dipakai `js/app.js`.
3. **Jangan ubah atribut `name` di form `index.html` (dan `id` di `js/questions.js`).** Nilainya = nama kolom dataset yang dikirim ke API. Form yang dipakai sekarang ditulis langsung di `index.html`; `js/app.js` membaca `name` itu.
4. Bila daftar fitur berubah: ubah `FITUR` di skrip pelatihan, latih ulang, lalu uji ulang API dan form. `app.py` membaca `fitur.json`.
5. Skor model bukan peluang pasti (`class_weight="balanced"`). Di UI pakai istilah "skor risiko model".
6. Tamu: riwayat hanya di browser. Login: riwayat disimpan ke MySQL dengan persetujuan saat daftar (`setuju_simpan`). Teks di halaman Riwayat/Hasil/Daftar harus selalu jujur soal tempat penyimpanan.
7. Keamanan login: kata sandi hanya disimpan sebagai hash; query MySQL selalu berparameter (`%s`); kredensial hanya di `.env` (tidak di-commit); admin dibuat lewat `python buat_admin.py`, tidak lewat website.

## Teknologi
- Frontend: HTML, CSS, JavaScript biasa (tanpa framework). Nama website: "HealthCheck" (sudah diputuskan). Tampilan: dasbor dengan menu samping, warna hijau, font DM Sans dan Manrope (Google Fonts).
- Backend: Flask + flask-cors, port 8000. Endpoint `GET /health`, `POST /predict`; login/riwayat/admin di `auth.py` (`/auth/*`, `/riwayat`, `/admin/*`). Sesi cookie HttpOnly SameSite=Lax; CORS hanya untuk `CORS_ORIGINS` di `.env` (default 127.0.0.1:5500 dan localhost:5500).
- Database: MySQL/MariaDB 10.4 dari XAMPP (`C:\xampp`), database `healthcheck` (tabel `users`, `riwayat`, lihat `schema.sql`), user MySQL `healthcheck` (bukan root). Cek risiko tetap jalan bila MySQL mati.
- Model: scikit-learn Pipeline (OneHotEncoder + StandardScaler + LogisticRegression) disimpan sebagai `model_diabetes.pkl`; daftar fitur di `fitur.json`.
- Live Server VS Code di port 5500.
- Lingkungan Tresure: Python 3.13, pandas 3.x, scikit-learn 1.9.x.

## Struktur proyek
```
index.html                 halaman utama (Beranda, Cek Risiko, Riwayat, Edukasi, Profil, Akun, Dasbor Admin); form ditulis langsung di sini
css/style.css              warna dan font di :root
js/config.js               API_URL (tidak dipakai; app.js memakai http://<host halaman>:8000)
js/questions.js            daftar pertanyaan; dimuat tetapi SAAT INI TIDAK DIPAKAI oleh app.js
js/app.js                  validasi, BMI, panggil API, hasil, login, riwayat (localStorage atau database), dasbor admin
app.py                     API Flask (prediksi) + mendaftarkan auth.py
auth.py                    endpoint login, riwayat database, admin
db.py                      koneksi MySQL, membaca .env
schema.sql                 membuat database healthcheck (aman dijalankan ulang)
buat_admin.py              membuat akun admin (kata sandi diketik tersembunyi)
.env.example               contoh pengaturan; .env asli TIDAK di-commit
train_model_dpd.py         pelatihan model
test_api.py                uji API prediksi
test_auth.py               uji login/riwayat/admin/keamanan (33 pengecekan, butuh MySQL; akun uji @uji.healthcheck.local dihapus otomatis)
requirements.txt           daftar library dengan versi terkunci
README.md                  cara memasang dan menjalankan (untuk anggota kelompok)
.gitignore                 __pycache__, .env, venv tidak di-upload
model_diabetes.pkl, fitur.json    hasil train_model_dpd.py, IKUT di-commit (keputusan 2026-11-06)
dataset/diabetes_prediction_dataset.csv   dari Kaggle, IKUT di-commit (keputusan 2026-11-06)
```

## GitHub
Repo: https://github.com/adityaprwatama-dotcom/Diabetes-Mechine-Learning (public, cabang `main`).
Folder ini tersambung ke repo itu. Perubahan baru masuk GitHub hanya setelah commit + push.
Sebelum mulai bekerja: `git pull`. Setelah selesai: `git add`, `git commit`, `git push` (tanya Tresure dulu).

## Dataset aktif
Diabetes Prediction Dataset (Kaggle, iammustafatz), 100.000 baris. Kolom: gender, age, hypertension, heart_disease, smoking_history, bmi, HbA1c_level, blood_glucose_level, diabetes (target). Dipakai 7 fitur (tanpa HbA1c_level). Gender "Other" dan baris duplikat dibuang saat pelatihan.
Keterbatasan: asal data dan cara pengumpulan tidak dijelaskan rinci; tidak jelas apakah glukosa puasa atau sewaktu.

## Perintah
```
python -m pip install -r requirements.txt
python train_model_dpd.py     # membuat model_diabetes.pkl dan fitur.json
python app.py                 # API http://127.0.0.1:8000 (biarkan terbuka)
python test_api.py            # di terminal lain
python test_auth.py           # butuh MySQL XAMPP menyala
python buat_admin.py          # membuat akun admin
C:\xampp\mysql\bin\mysql.exe -u root -e "source schema.sql"   # membuat tabel (PowerShell tidak mendukung "<")
```
Website: klik kanan `index.html` > Open with Live Server, lalu Ctrl+F5.

## Jebakan yang pernah terjadi
- Ctrl+V di PowerShell bisa memicu error PSReadLine: tempel dengan klik kanan.
- `python` tidak dikenali: pasang Python dari python.org, centang "Add python.exe to PATH", gunakan `python -m pip`.
- Dua API menyala bersamaan di port 8000 akan bentrok.
- Latih ulang model setelah daftar fitur berubah. File `.pkl` bisa gagal dimuat bila versi library berbeda.
- Jangan buka lalu simpan CSV dari Excel.
- Folder `css` dan `js` harus huruf kecil dan sejajar dengan `index.html`.
- Desimal di form ditulis dengan titik (5.7).
- Tabel sistem `mysql.db` XAMPP pernah rusak ("Index for table 'db' is corrupt"); diperbaiki 2026-11-06 dengan `REPAIR TABLE mysql.db` (backup di `D:\donwload\_backup-mysql\2026-11-06\`).
- Aturan CSS `display` mengalahkan atribut `hidden`; sudah ada `[hidden]{display:none!important}` di akhir style.css. Uji tampilan harus cek yang benar-benar terlihat, bukan hanya atribut.
- Batas login gagal (5x / 15 menit) disimpan di memori API; uji ulang tanpa restart API memakai email berbeda.

## Status dan rencana
Lihat @docs/KONTEKS.md. Di awal sesi, periksa kondisi nyata folder (file ada atau tidak, model sudah dilatih atau belum) sebelum menyimpulkan apa pun.
