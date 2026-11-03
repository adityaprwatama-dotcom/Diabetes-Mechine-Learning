/* Daftar pertanyaan form. id = nama kolom dataset (Diabetes Prediction Dataset) yang dikirim ke API.
   lokal:true = hanya dipakai di browser (untuk menghitung BMI). nilai:"teks" = dikirim sebagai teks, bukan angka. */
const YA_TIDAK = [["1", "Ya"], ["0", "Tidak"]];

const QUESTIONS = [
  { judul: "Data diri", item: [
    { id: "age", label: "Usia (tahun)", tipe: "angka", min: 1, max: 120 },
    { id: "gender", label: "Jenis kelamin", tipe: "pilih", nilai: "teks", opsi: [["Female", "Perempuan"], ["Male", "Laki-laki"]] },
    { id: "berat", label: "Berat badan (kg)", tipe: "angka", min: 20, max: 300, lokal: true },
    { id: "tinggi", label: "Tinggi badan (cm)", tipe: "angka", min: 100, max: 230, lokal: true },
    { id: "blood_glucose_level", label: "Kadar gula darah (mg/dL)", tipe: "angka", min: 40, max: 600, bantuan: "Hasil cek terakhir (glukometer atau lab), contoh: 110" }
  ]},
  { judul: "Riwayat kesehatan", item: [
    { id: "hypertension", label: "Pernah didiagnosis hipertensi (tekanan darah tinggi)?", tipe: "pilih", opsi: YA_TIDAK },
    { id: "heart_disease", label: "Pernah didiagnosis penyakit jantung?", tipe: "pilih", opsi: YA_TIDAK },
    { id: "smoking_history", label: "Riwayat merokok", tipe: "pilih", nilai: "teks", opsi: [
      ["never", "Tidak pernah merokok"], ["current", "Perokok aktif"], ["former", "Mantan perokok (sudah berhenti)"],
      ["not current", "Saat ini tidak merokok"], ["ever", "Pernah merokok (status sekarang tidak jelas)"], ["No Info", "Tidak ada informasi"]] }
  ]}
];
