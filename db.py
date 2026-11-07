"""
Koneksi ke database MySQL (XAMPP) untuk akun dan riwayat.
Pengaturan dibaca dari file .env (lihat .env.example). File .env tidak di-upload ke GitHub.
"""
import os
import pymysql
from dotenv import load_dotenv

BASE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE, ".env"))


class DatabaseMati(Exception):
    """MySQL belum menyala atau pengaturan .env salah."""


def koneksi():
    try:
        return pymysql.connect(
            host=os.getenv("DB_HOST", "127.0.0.1"),
            port=int(os.getenv("DB_PORT", "3306")),
            user=os.getenv("DB_USER", "healthcheck"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "healthcheck"),
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,
            autocommit=True,
            connect_timeout=3,
        )
    except pymysql.err.OperationalError as e:
        raise DatabaseMati(str(e)) from e


def ambil(sql, param=(), satu=False):
    """Jalankan SELECT. Selalu memakai query berparameter (%s), jangan menyambung teks."""
    with koneksi() as k, k.cursor() as c:
        c.execute(sql, param)
        return c.fetchone() if satu else c.fetchall()


def ubah(sql, param=()):
    """Jalankan INSERT/UPDATE/DELETE. Mengembalikan (id baris baru, jumlah baris terpengaruh)."""
    with koneksi() as k, k.cursor() as c:
        n = c.execute(sql, param)
        return c.lastrowid, n
