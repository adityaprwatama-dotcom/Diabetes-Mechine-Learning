-- Database HealthCheck: akun pengguna dan riwayat cek risiko.
-- Jalankan sekali (XAMPP: MySQL harus Start):
--   C:\xampp\mysql\bin\mysql.exe -u root < schema.sql
-- Aman dijalankan ulang: tabel yang sudah ada tidak dihapus.

CREATE DATABASE IF NOT EXISTS healthcheck CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE healthcheck;

CREATE TABLE IF NOT EXISTS users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  nama           VARCHAR(100) NOT NULL,
  email          VARCHAR(190) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,              -- hash werkzeug, BUKAN kata sandi asli
  peran          ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  aktif          TINYINT(1) NOT NULL DEFAULT 1,       -- 0 = dinonaktifkan admin, tidak bisa login
  setuju_simpan  DATETIME NULL,                       -- waktu pengguna menyetujui penyimpanan data
  dibuat         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS riwayat (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  user_id  INT NOT NULL,
  input    TEXT NOT NULL,                             -- 7 fitur dalam format JSON
  skor     DECIMAL(6,4) NOT NULL,                     -- skor risiko model 0..1
  label    VARCHAR(20) NOT NULL,                      -- Risiko tinggi / Risiko rendah
  waktu    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_riwayat_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_riwayat_user_waktu (user_id, waktu)
) ENGINE=InnoDB;
