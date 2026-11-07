"""
Membuat akun ADMIN HealthCheck. Admin tidak bisa mendaftar lewat website.

Cara pakai (MySQL di XAMPP harus menyala, .env sudah ada):
    python buat_admin.py
Lalu ketik nama, email, dan kata sandi. Kata sandi tidak terlihat saat diketik (normal).
Bila email sudah terdaftar sebagai user biasa, akun itu bisa dinaikkan menjadi admin.
"""
import getpass
import sys
from werkzeug.security import generate_password_hash
import db
from auth import POLA_EMAIL


def main():
    print("=== Membuat akun admin HealthCheck ===")
    try:
        db.ambil("SELECT 1")
    except db.DatabaseMati:
        sys.exit("Database belum menyala. Nyalakan MySQL di XAMPP Control Panel, lalu jalankan lagi.")

    nama = input("Nama admin  : ").strip()
    email = input("Email admin : ").strip().lower()
    if not 2 <= len(nama) <= 100 or not POLA_EMAIL.match(email):
        sys.exit("Nama (2-100 karakter) dan email yang valid wajib diisi.")

    ada = db.ambil("SELECT id, peran FROM users WHERE email=%s", (email,), satu=True)
    if ada and ada["peran"] == "admin":
        sys.exit("Email ini sudah menjadi admin. Tidak ada yang diubah.")
    if ada and input("Email sudah terdaftar sebagai user. Jadikan admin? (y/n): ").strip().lower() != "y":
        sys.exit("Dibatalkan.")

    sandi = getpass.getpass("Kata sandi (min. 8 karakter): ")
    if len(sandi) < 8:
        sys.exit("Kata sandi minimal 8 karakter.")
    if getpass.getpass("Ulangi kata sandi          : ") != sandi:
        sys.exit("Kata sandi tidak sama.")

    hash_ = generate_password_hash(sandi)
    if ada:
        db.ubah("UPDATE users SET nama=%s, password_hash=%s, peran='admin', aktif=1 WHERE id=%s", (nama, hash_, ada["id"]))
    else:
        db.ubah("INSERT INTO users (nama, email, password_hash, peran) VALUES (%s, %s, %s, 'admin')", (nama, email, hash_))
    print(f"Akun admin {email} siap dipakai. Masuk lewat halaman Masuk di website.")


if __name__ == "__main__":
    main()
