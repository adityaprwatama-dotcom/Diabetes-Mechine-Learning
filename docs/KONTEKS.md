# KONTEKS PROYEK: Cek Risiko Diabetes ("Seimbang")

Dokumen ini adalah memori jangka panjang proyek. Perbarui bagian "Status" setiap selesai mengerjakan sesuatu.

## 1. Siapa dan apa
- Pemilik: Tresure, mahasiswa Rekayasa Perangkat Lunak, pemula Python. Proyek kelompok "Projek Akhir III".
- Produk: website skrining risiko diabetes berbasis machine learning (bukan diagnosis).
- Pemangku kepentingan: pengguna dan dokter.
- Fitur utama: form cek risiko, hasil prediksi, faktor risiko utama, rekomendasi.
- Ada template SRS (Software_Requirements_Specification_Template.docx) yang harus diisi.
- Ruang lingkup harus realistis untuk proyek mahasiswa.

## 2. Riwayat keputusan
1. Awalnya memilih antara diabetes dan katarak. Katarak (gambar, CNN) ditinggalkan; dipilih **diabetes** (data tabel, lebih mudah untuk pemula).
2. Algoritma: **Logistic Regression** (utama, mudah dijelaskan) dan Gradient Boosting (pembanding).
3. Dataset berpindah tiga kali:
   - **Pima** (768 baris): hanya perempuan, jadi tidak cocok untuk situs umum.
   - **BRFSS 2015** (253.680 baris): laki-laki dan perempuan, tetapi tanpa kolom kadar gula darah.
   - **Diabetes Prediction Dataset** (100.000 baris, aktif sekarang): ada gender dan blood_glucose_level.
4. Aturan dosen: fitur di form harus sesuai kolom dataset. Belum dipastikan apakah semua kolom wajib dipakai.
5. Kolom hasil laboratorium (HbA1c) dibuang dari form karena pengguna awam jarang tahu nilainya. Kadar gula darah dipindah ke bagian "Data diri".
6. Istilah di UI: "skor risiko model", bukan peluang pasti.

## 3. Pemetaan form ke dataset
| Pertanyaan di form | Kolom dataset |
|---|---|
| Jenis kelamin (Female/Male) | gender |
| Usia | age |
| Berat + tinggi (dihitung di browser) | bmi |
| Kadar gula darah | blood_glucose_level |
| Hipertensi | hypertension |
| Penyakit jantung | heart_disease |
| Riwayat merokok (6 pilihan) | smoking_history |
| (tidak dipakai) | HbA1c_level |

## 4. Metrik
- Pima: akurasi 0,734, recall 0,704, AUC 0,813.
- BRFSS: Logistic Regression akurasi 0,730, presisi 0,309, recall 0,759, AUC 0,817; Gradient Boosting recall 0,792, AUC 0,824.
- **Diabetes Prediction Dataset (data asli, dilatih 2026-11-05)** dengan `python train_model_dpd.py`. File ada di `dataset/diabetes_prediction_dataset.csv`, bentuknya (100000, 9).
  - Pembersihan: 18 baris gender "Other" dan 3.854 duplikat dibuang, sisa 96.128 baris. Data uji 20% = 19.226 baris (1.696 positif).
  - Logistic Regression (model yang dipakai): akurasi 0,813, presisi 0,294, recall 0,802, F1 0,431, AUC 0,901.
  - Confusion matrix: TN 14.268, FP 3.262, FN 336, TP 1.360.
  - Recall per gender: Female 0,780 (n=11.178), Male 0,828 (n=8.048).
  - Pembanding Gradient Boosting: akurasi 0,827, presisi 0,320, recall 0,858, F1 0,466, AUC 0,930.
  - Koefisien terbesar: blood_glucose_level 1,273; age 1,128; hypertension 0,808; heart_disease 0,785; bmi 0,621.
  - **Perbandingan dengan HbA1c** (dijalankan sekali 2026-11-05 dengan skrip sementara yang sudah dihapus atas permintaan Tresure; data uji yang sama, model tidak disimpan). Tanpa → dengan HbA1c: akurasi 0,813 → 0,885; presisi 0,294 → 0,427; recall 0,802 → 0,876; F1 0,431 → 0,574; AUC 0,901 → 0,960; recall Female 0,780 → 0,857; recall Male 0,828 → 0,898; salah alarm 3.262 → 1.997; kasus terlewat 336 → 210. Artinya HbA1c jelas membantu model; tidak memakainya adalah pertukaran demi kemudahan pengguna awam.
- Catatan: dataset ini sangat tidak seimbang (sekitar 8,5% positif), jadi akurasi saja menyesatkan; laporkan recall dan presisi.

## 5. Desain (Figma "RuangGula")
- **Nama website diputuskan: "HealthCheck"** (2026-11-05, keputusan Tresure). Nama lama "Seimbang" dan "RuangGula" tidak dipakai lagi.
- Kelompok punya prototipe Figma bernama "RuangGula" (palet hijau tua). Tampilan situs sekarang: dasbor hijau dengan menu samping, font DM Sans dan Manrope.
- Permintaan: perindah tampilan dengan ilustrasi keluarga dan darah TANPA mengubah struktur halaman Figma dan tanpa mengubah algoritma.
- Aset ilustrasi SVG sudah pernah dibuat (7 file, folder `ilustrasi-ruanggula/`). Pakai ulang bila ada.

## 6. Login + MySQL (diputuskan Tresure 2026-11-06, dikerjakan di cabang `fitur-login`)
- Keputusan awal: cek risiko TIDAK wajib login (diganti, lihat "Perubahan" di bawah). Saat login, hasil cek risiko disimpan ke MySQL. Yang disimpan: akun + riwayat (input 7 fitur, skor, label, waktu).
- Admin bisa: lihat daftar pengguna, statistik (jumlah pengguna, pemeriksaan, % risiko tinggi, 7 hari), lihat/hapus riwayat pengguna, nonaktifkan/aktifkan akun. Admin tidak bisa daftar lewat website; dibuat dengan `python buat_admin.py`.
- Tabel (`schema.sql`): `users(id, nama, email unik, password_hash, peran user/admin, aktif, setuju_simpan, dibuat)` dan `riwayat(id, user_id FK ON DELETE CASCADE, input JSON, skor, label, waktu)`.
- Keamanan: hash werkzeug (scrypt), query berparameter, sesi cookie HttpOnly SameSite=Lax, CORS hanya 127.0.0.1:5500/localhost:5500 dengan credentials, batas 5 login gagal per 15 menit (memori), persetujuan wajib saat daftar, user MySQL khusus `healthcheck` (hanya SELECT/INSERT/UPDATE/DELETE di database healthcheck), kredensial di `.env`.
- Lingkungan: XAMPP di `C:\xampp`, MariaDB 10.4.32. `mysql.db` sempat rusak dan diperbaiki (lihat CLAUDE.md).
- Pengujian 2026-11-06: `test_api.py` tetap sama (skor 1%/99%/98%); `test_auth.py` 33/33 lulus (dua kali berturut-turut); uji tampilan Edge (tamu, daftar, cek tersimpan, user ditolak dari admin, keluar, masuk admin, statistik, riwayat, nonaktif/aktif, hapus) semua sesuai; MySQL mati: cek risiko tamu tetap jalan, login 503 dengan pesan jelas.
- **Perubahan 2026-11-06 (keputusan Tresure): login WAJIB.** Website dibuka langsung tampil layar Masuk/Daftar; menu dan halaman lain baru muncul setelah login. `/predict` juga menolak (401) bila belum login, jadi bukan hanya disembunyikan di tampilan. Mode tamu dan riwayat localStorage dihapus. Konsekuensi: MySQL harus menyala agar website bisa dipakai. Algoritma/model tidak berubah.
- Pengujian setelah perubahan (2026-11-06): `test_api.py` lulus (tanpa login 401; skor tetap 1%/99%/98%); `test_auth.py` 33/33 lulus (no. 1 kini "tamu ditolak 401"); uji tampilan Edge 13 langkah sesuai (layar login tampil pertama, menu tersembunyi, sandi salah ditolak, daftar, cek tersimpan, riwayat, user ditolak dari admin, muat ulang tetap masuk, keluar membersihkan layar, masuk admin, admin keluar); API mati: layar login menampilkan pesan "Tidak dapat terhubung ke API".
- **Fitur admin tambahan (2026-11-06, disetujui Tresure, 5 fitur):** (1) grafik batang pemeriksaan 14 hari (rendah/tinggi bertumpuk) + perbandingan total, tanpa library; (2) cari pengguna (nama/email, di browser); (3) unduh CSV semua riwayat (`GET /admin/ekspor.csv`, pemisah titik koma, BOM UTF-8, pengaman rumus Excel); (4) hapus akun user permanen (`DELETE /admin/pengguna/<id>`, wajib ketik ulang email; admin tidak bisa menghapus diri sendiri atau admin lain; riwayat ikut terhapus); (5) tab **Admin** di layar login (`/auth/masuk` dengan `sebagai: "admin"` menolak akun biasa, 403, tanpa sesi).
- Pengujian fitur admin (2026-11-06): `test_auth.py` 46/46 lulus (13 pengecekan baru no. 34-46); `test_api.py` lulus (skor tetap 1%/99%/98%); uji tampilan Edge 16 langkah sesuai (tab Admin, akun biasa ditolak, grafik 14 kolom, cari, unduh CSV, hapus akun salah email/batal/benar, keluar membersihkan dasbor).
- SRS versi 1.1 sudah memuat login, admin, ERD, dan kasus uji baru (lihat Status).

## 7. Kolaborasi GitHub
- Satu repo, cabang per anggota/fitur, pull request untuk digabung.
- Repo: https://github.com/adityaprwatama-dotcom/Diabetes-Mechine-Learning (public, cabang `main`). Awalnya diunggah lewat web GitHub 2026-11-03 (2 commit).
- `.gitignore`: `__pycache__/`, `*.pyc`, `venv/`, `.venv/`, `.env`.
- **Keputusan 2026-11-06 (pilihan A):** dataset CSV dan `model_diabetes.pkl` TETAP di-commit, supaya anggota bisa langsung menjalankan tanpa unduh Kaggle atau melatih ulang. Latih ulang hanya bila fitur berubah atau `.pkl` gagal dimuat.

## 8. Pertanyaan terbuka
1. Apakah dosen mengizinkan tidak memakai kolom HbA1c?
2. Hasil metrik asli pada Diabetes Prediction Dataset?
3. ~~Scope login/MySQL?~~ Terjawab 2026-11-06: login + MySQL + admin; awalnya opsional, lalu diubah menjadi WAJIB di hari yang sama (lihat Bagian 6).
4. ~~Nama akhir?~~ Terjawab: "HealthCheck" (2026-11-05).
5. Apakah akan di-deploy (opsional) atau cukup berjalan lokal?

## 9. Peta jalan (urut prioritas)
1. Periksa kondisi folder proyek nyata; pastikan dataset ada; latih model; catat metrik (Bagian 4).
2. Jalankan `test_api.py` dan uji form end-to-end.
3. Konfirmasi ke dosen (pertanyaan 1).
4. Terapkan desain Figma/ilustrasi ke HTML/CSS tanpa menyentuh algoritma.
5. Tambah "faktor risiko utama" dan rekomendasi di hasil (sesuai fitur utama SRS).
6. Login + MySQL bila disetujui.
7. Isi SRS, tabel pengujian, laporan; siapkan GitHub.

## 10. Batasan
- Bukan diagnosis; disclaimer wajib.
- Jangan menyimpan kredensial di Git.
- Data kesehatan: simpan seminimal mungkin dan dengan persetujuan.
- Tulis hanya hasil yang benar-benar dijalankan.

## 11. Status (perbarui terus)
- [x] Situs, API, dan skrip pelatihan versi Diabetes Prediction Dataset dibuat dan lulus uji kode (data sintetis).
- [x] Dataset asli diunduh dan model dilatih (2026-11-05, metrik di Bagian 4)
- [x] Uji API dan form (2026-11-05): `test_api.py` 7/7 sesuai harapan; form di browser (Live Server) menampilkan "Risiko rendah" 7,1% untuk data uji (P, 45 th, 70 kg, 170 cm, gula 110); tinggi kosong ditolak browser. Catatan kecil "hasil lama tetap terlihat saat form diubah" sudah diperbaiki di `js/app.js` (2026-11-05), diuji otomatis di Edge.
- [x] Faktor risiko utama + rekomendasi di hasil (2026-11-05). `/predict` kini juga mengirim `faktor` (maks. 3, dihitung dari koefisien Logistic Regression dibanding acuan: rata-rata data latih untuk usia/BMI/gula, "tidak" untuk hipertensi/jantung, "never" untuk merokok; gender tidak ditampilkan; batas 0,1) dan `rekomendasi` (saran umum berbasis aturan). Skor/label tidak berubah. Diuji: `test_api.py` lulus, tampilan diuji di Edge.
- [ ] Konfirmasi dosen
- [ ] Desain Figma diterapkan
- [x] Login + MySQL + Dasbor Admin (2026-11-06, cabang `fitur-login`; semua uji lulus, lihat Bagian 6). Belum digabung ke `main`.
- [x] Login wajib di awal website (2026-11-06, cabang `fitur-login`; uji lulus, lihat Bagian 6).
- [x] Fitur admin tambahan: grafik, cari, CSV, hapus akun, tab Admin (2026-11-06, cabang `fitur-login`; 46/46 lulus).
- [x] Perbarui SRS untuk fitur login/admin (versi 1.1, 2026-11-06)
- [ ] Perindah tampilan (efek dan animasi)
- [x] GitHub: folder tersambung ke repo, commit `cf546e9` di-push 2026-11-06 (push memakai akun Adityaputt, kolaborator).
- [~] SRS: `docs/SRS_HealthCheck.docx` **versi 1.1** (2026-11-06, 32 halaman): fitur F-01 s.d. F-30 (pengguna, akun/login, admin), 3 jenis pengguna (Pengguna, Admin, Pengembang), ERD + tabel users/riwayat, Use Case/Class/6 Sequence Diagram baru, 12 screenshot baru dengan akun contoh @uji (sudah dihapus), Tabel 4.1 semua endpoint, keamanan login, Lampiran A 37 kasus uji semuanya lulus (no. 1-18 diuji ulang setelah login wajib; MySQL mati diuji dengan DB_PORT salah lewat test client, MySQL asli tidak dimatikan). Waktu /predict kini rata-rata 370,2 ms (versi 1.0: 23,4 ms) karena tiap permintaan membuka sekitar 4 koneksi MySQL @ 82,9 ms; masih < 2 detik, perbaikan (pakai ulang koneksi) belum dikerjakan. Cadangan skrip versi 1.0: `D:\donwload\_alat-srs\buat_srs_v1_0.py`. Riwayat versi 1.0 (22 halaman; struktur dari contoh di `docs/referensi/`, tidak di-upload). Uji no. 16 (hapus riwayat) dan 17 (API mati) sudah dijalankan otomatis di Edge dan lulus; 17/17 kasus lulus. Masih perlu diisi manual oleh kelompok: NIM, dosen pengampu, logo kampus. Diagram dan dokumen dibuat dengan skrip di `D:\donwload\_alat-srs\` (di luar repo).
- [ ] ADR (Architecture Decision Record, template di `docs/referensi/`): dikerjakan oleh anggota kelompok lain; ditunda di sini.
- [ ] Laporan
