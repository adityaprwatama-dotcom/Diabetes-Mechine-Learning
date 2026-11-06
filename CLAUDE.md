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
2. **Mengubah tampilan tidak boleh mengubah algoritma.** `app.py`, `train_model_dpd.py`, model, dan dataset jangan disentuh saat mengerjakan HTML/CSS.
3. **Jangan ubah atribut `name` di form `index.html` (dan `id` di `js/questions.js`).** Nilainya = nama kolom dataset yang dikirim ke API. Form yang dipakai sekarang ditulis langsung di `index.html`; `js/app.js` membaca `name` itu.
4. Bila daftar fitur berubah: ubah `FITUR` di skrip pelatihan, latih ulang, lalu uji ulang API dan form. `app.py` membaca `fitur.json`.
5. Skor model bukan peluang pasti (`class_weight="balanced"`). Di UI pakai istilah "skor risiko model".
6. Teks "data tidak disimpan" di form harus diganti bila riwayat nanti disimpan ke database.

## Teknologi
- Frontend: HTML, CSS, JavaScript biasa (tanpa framework). Nama website: "HealthCheck" (sudah diputuskan). Tampilan: dasbor dengan menu samping, warna hijau, font DM Sans dan Manrope (Google Fonts).
- Backend: Flask + flask-cors, port 8000. Endpoint `GET /health`, `POST /predict`.
- Model: scikit-learn Pipeline (OneHotEncoder + StandardScaler + LogisticRegression) disimpan sebagai `model_diabetes.pkl`; daftar fitur di `fitur.json`.
- Live Server VS Code di port 5500.
- Lingkungan Tresure: Python 3.13, pandas 3.x, scikit-learn 1.9.x.

## Struktur proyek
```
index.html                 halaman utama (Beranda, Cek Risiko, Riwayat, Edukasi, Profil); form ditulis langsung di sini
css/style.css              warna dan font di :root
js/config.js               API_URL
js/questions.js            daftar pertanyaan; dimuat tetapi SAAT INI TIDAK DIPAKAI oleh app.js
js/app.js                  validasi, hitung BMI, panggil API, tampilkan hasil, riwayat di localStorage browser
app.py                     API Flask
train_model_dpd.py         pelatihan model
test_api.py                uji API tanpa tampilan
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

## Status dan rencana
Lihat @docs/KONTEKS.md. Di awal sesi, periksa kondisi nyata folder (file ada atau tidak, model sudah dilatih atau belum) sebelum menyimpulkan apa pun.
