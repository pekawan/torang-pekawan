# Torang Pekawan — GitHub Pages + Supabase

Versi statis HTML/CSS/JavaScript dari project PHP yang dikirim. Cocok untuk GitHub Pages; PHP dan SQLite tidak dijalankan oleh GitHub Pages. Jadwal, dokumentasi, dan login admin memakai Supabase.

## 1. Siapkan Supabase
1. Buat project di https://supabase.com.
2. Buka **SQL Editor**, jalankan seluruh isi `supabase.sql`.
3. Buka **Project Settings > API** dan salin Project URL serta `anon/public` key.
4. Isi `js/supabase-config.js` dengan URL dan anon key tersebut. Jangan pernah memasukkan `service_role` key ke file frontend.
5. Di **Authentication > Users**, buat user admin dengan email dan password yang kuat. Halaman login admin menggunakan akun ini.

## 2. Hosting GitHub Pages
1. Ekstrak ZIP ini.
2. Unggah seluruh isi folder project ke repository GitHub (pastikan `index.html` ada di root repository).
3. Masuk **Settings > Pages**, pilih **Deploy from a branch**, branch `main`, folder `/(root)`, lalu Save.
4. Tunggu deployment selesai dan buka URL GitHub Pages yang diberikan.

## 3. URL halaman
- `index.html` — Beranda, jadwal, dokumentasi
- `tentang.html` — Tentang
- `kegiatan.html` — Kegiatan
- `dokumentasi.html` — Dokumentasi
- `lainnya.html` — Media sosial dan kontak
- `admin/login.html` — Login admin
- `admin/index.html` — Dashboard admin

## Catatan
- File gambar `assets/foto/pekawan.jpg` dan `assets/foto/pemuda-gmim.png` tidak ada di ZIP sumber yang dikirim. Tambahkan sendiri jika ingin menampilkan foto/logo.
- Admin ini menyediakan login, tambah/hapus jadwal, unggah/hapus dokumentasi. Fitur edit jadwal dan ganti password khusus aplikasi PHP lama belum dibuat pada versi statis.
- Pengunjung dapat membaca jadwal dan dokumentasi; hanya user terautentikasi yang bisa mengubah data. Review kebijakan RLS sebelum dipakai produksi.
- Untuk memperbarui konfigurasi, ubah `js/supabase-config.js`, lalu commit/push lagi ke GitHub.
