# DDU Control

Webapp kontrol kinerja Yayasan Dompet Dana Umat Daarul Uluum.

## Struktur proyek

```text
webappddu/
├── assets/
│   ├── css/styles.css       # Tampilan dan responsive design
│   ├── images/logo-ddu.png  # Identitas visual yayasan
│   └── js/
│       ├── app.js           # Logika dashboard dan integrasi API
│       └── redirect.js      # Pengalihan Live Server ke port 8000
├── index.html               # Struktur semantik halaman
├── server.js                # Backend Node.js, autentikasi, dan SQLite
├── package.json             # Dependency dan perintah deploy
└── start-ddu.bat            # Peluncur aplikasi Windows
```

## Menjalankan

Backend aktif menggunakan MySQL. Untuk menjalankan secara lokal, salin `.env.example` menjadi `.env`, isi koneksi MySQL, lalu klik dua kali `start-ddu.bat`. Alternatif terminal:

```powershell
npm install
node --env-file=.env server.js
```

Buka `http://127.0.0.1:8000`. Skema MySQL dan akun utama dibuat otomatis. `server-sqlite.js` hanya dipertahankan sementara sebagai backend lama untuk proses pemulihan/migrasi dan bukan entry point aplikasi.

## Modul kerja

- Target uang, jumlah, atau aktivitas per periode mingguan, bulanan, dan tahunan.
- Input capaian mingguan dengan akumulasi otomatis ke ringkasan bulanan dan tahunan.
- Filter periode mendukung minggu/bulan/tahun berjalan, tahun lalu, tahun depan, rentang tanggal, serta satu atau beberapa tahun sekaligus.
- Siklus tahun buku memisahkan target dan program setiap tahun dengan status Perencanaan, Berjalan, dan Ditutup.
- Database muzaki/donatur dan status keaktifannya.
- Daftar donatur dapat diunduh sebagai Excel untuk rentang waktu terpilih atau seluruh data sesuai hak akses akun.
- Laporan Keuangan dipisahkan menjadi **Pemasukan Donasi** per donatur/mitra dan **Penggunaan Anggaran** yang berasal dari pengajuan, pencairan, serta LPJ terpusat.
- Donatur/mitra baru pada input atau impor pemasukan otomatis dibuat satu kali di Data Donatur pusat; donasi berikutnya ditautkan ke profil yang sudah ada.
- Dashboard unit menampilkan rasio biaya kerja terhadap pemasukan donasi unit. Untuk Ketua, Sekretaris, Bendahara, dan Administrasi, biaya operasional lembaga dibandingkan dengan total pemasukan donasi seluruh unit.
- Pemasukan donasi dan penggunaan anggaran dapat diunduh sebagai Excel sesuai periode dan hak akses akun.
- Sesi pengguna otomatis berakhir setelah 30 menit tanpa aktivitas dan selalu berakhir setelah maksimum 8 jam. Atur melalui `DDU_SESSION_IDLE_MINUTES` (5–480 menit) dan `DDU_SESSION_ABSOLUTE_HOURS` (1–24 jam).
- Cookie autentikasi bersifat nonpersisten, `HttpOnly`, `SameSite=Strict`, dan memakai prefiks `__Host-` pada HTTPS. Menutup browser menghapus cookie sesi.
- Percobaan login dibatasi berdasarkan akun dan alamat jaringan, tetap berlaku setelah server dimulai ulang, serta kata sandi baru disimpan dengan PBKDF2-HMAC-SHA256 600.000 iterasi.
- Header keamanan Helmet/CSP dan HSTS produksi diaktifkan; unggahan foto dan tautan lokasi divalidasi kembali di server.
- Delapan program awal Divisi 1 telah diisi berdasarkan proker Penggalangan Kotak & Tabung Infak.
- Enam program awal Divisi 2 telah diisi berdasarkan proker Penggalangan Proposal & Surat.
- Sepuluh program awal Divisi 3 telah diisi berdasarkan proker Penggalangan Media Sosial.
- Enam program awal Bendahara telah diisi; laporan keuangannya mengonsolidasikan transaksi Divisi 1, 2, 3, dan Bendahara.
- Enam program awal Administrasi telah diisi; dashboardnya mengonsolidasikan target donasi, donatur, dan keuangan lintas unit.
- Tujuh tugas pokok Sekretaris telah diisi; Sekretaris dapat memantau seluruh unit dan membuat akun divisi/bagian baru yang langsung terintegrasi.
- Sekretaris dapat mengedit identitas dan kata sandi akun bawahannya; penghapusan baru dijalankan setelah disetujui Ketua.
- Seluruh akun membaca satu database MySQL yang sama. Tampilan difilter menurut peran dan unit, bukan disalin ke database terpisah.
- Perubahan data disegarkan saat tab kembali aktif dan secara berkala setiap 60 detik.

## Impor Satu Data DDU

Pusat impor menyediakan template Excel (`.xlsx`) terpisah untuk:

- donatur dan mitra;
- pemasukan donasi beserta identitas profil donor baru;
- penggunaan anggaran berdasarkan kode pengajuan;
- program dan target;
- capaian target; dan
- laporan realisasi beserta SWOT.

Setiap workbook mempunyai sheet **Data** yang dapat langsung diedit di Microsoft Excel atau Google Sheets, contoh pengisian, format tanggal/angka, daftar pilihan, dan sheet **Petunjuk**. Dari Google Sheets, unduh kembali sebagai Microsoft Excel (`.xlsx`) sebelum diunggah. Berkas CSV dengan pemisah koma, titik koma, atau tab tetap diterima untuk kompatibilitas.

Impor maksimal 200 baris dan ukuran workbook maksimal 2 MB diproses dalam satu transaksi database. Jika satu baris tidak valid, seluruh berkas dibatalkan sehingga tidak meninggalkan hasil impor parsial. Akun unit hanya dapat mengimpor ke unitnya sendiri. Ketua dan Sekretaris dapat mengimpor lintas unit, sedangkan Administrasi tidak dapat menulis data untuk Ketua, Sekretaris, atau Dewan Pengawas.

Nama program pada template capaian dan realisasi harus sama dengan nama aktif pada menu **Program & Target**. Impor target dengan nama program yang sudah ada akan memperbarui target tersebut, bukan membuat duplikat baru.

Template target memiliki kolom `target_year`. Target dengan nama yang sama dapat memiliki nilai berbeda pada setiap tahun tanpa mengubah arsip tahun sebelumnya.

Target berbentuk uang menggunakan transaksi **Pemasukan** sebagai satu-satunya sumber realisasi agar nominal tidak dihitung dua kali. Target jumlah dan aktivitas menggunakan template **Realisasi & Capaian** sebagai satu pintu laporan sekaligus pembaruan dashboard terpusat. Template **Capaian Target** lama tetap diterima untuk kompatibilitas, tetapi tidak lagi ditampilkan sebagai pilihan impor data baru.

Pada template **Pemasukan Donasi**, nama yang sama pada unit yang sama ditautkan sebagai donasi berulang. Nama yang belum tersedia otomatis menjadi profil baru menggunakan kolom telepon, jenis donatur/mitra, frekuensi donasi, dan jenis penitipan. Template **Penggunaan Anggaran** hanya menerima kode pengajuan yang telah dicairkan agar LPJ dan laporan keuangan tidak tercatat ganda.

## Pergantian tahun buku

1. Ketua memilih **Salin & siapkan target** pada menu Program & Target. Target tahun lama disalin sebagai rancangan tahun berikutnya.
2. Saat statusnya **Perencanaan**, setiap divisi dapat merevisi target miliknya atau menambahkan program baru.
3. Ketua menyelesaikan seluruh pengajuan anggaran/pengeluaran tertunda lalu menutup tahun berjalan. Tahun yang ditutup tetap dapat dibuka sebagai laporan, tetapi seluruh perubahan datanya ditolak server.
4. Setelah tahun lama ditutup, Ketua membuka tahun baru. Transaksi, capaian, realisasi, evaluasi, dan pengajuan baru kemudian dapat dicatat pada tahun tersebut.

Kolom `targets.target_year`, relasi `transactions.donor_id`, serta tabel pendukung tahun buku dibuat atau dimigrasikan otomatis ketika `server.js` pertama kali dijalankan setelah pembaruan.

## Tahun ajaran dan kenaikan kelas

Menu **Data Referensi** menyediakan pilihan Jenjang Pendidikan dan Kelas/Rombel terpusat: MTs/SMP kelas 7–9 serta MA/SMA kelas 10–12, masing-masing rombel A–D. Data kelas bersifat opsional untuk donatur/mitra yang bukan siswa.

Ketua atau Sekretaris dapat memakai panel **Pengaturan Tahun Ajaran** untuk membuka tahun berikutnya. Sistem membuat riwayat baru tanpa mengubah transaksi atau laporan lama, menaikkan siswa satu tingkat dengan rombel yang sama, serta menandai kelas 9 MTs/SMP dan kelas 12 MA/SMA sebagai lulus. Tabel `academic_years`, `donor_class_assignments`, dan kolom akademik lama dibuat atau dimigrasikan otomatis saat server terbaru dijalankan.

Penyimpanan ganda pada Data Referensi, donatur/mitra, transaksi, realisasi, evaluasi, target, dan pengajuan anggaran ditolak dengan pemberitahuan konflik. Impor Excel diproses secara atomik: jika satu baris tidak valid atau duplikat, seluruh berkas dibatalkan agar Satu Data tetap konsisten.

## Akun pengurus

Pada instalasi baru, tentukan kata sandi awal melalui environment variable `DDU_INITIAL_PASSWORD` sebelum menjalankan aplikasi. Jangan menyimpan kata sandi tersebut di repository.

| Nama | Peran | Email | Cakupan akses |
|---|---|---|---|
| Eva Margareta | Ketua | `ketuaddu@gmail.com` | Seluruh data, target, evaluasi, laporan, dan pengguna |
| Sabili Ridho | Sekretaris | `sekretarisddu@gmail.com` | Seluruh data, target, realisasi, evaluasi, dan laporan |
| Epiyani | Bendahara | `ddubendahara@gmail.com` | Data dan realisasi Bendahara |
| Romipan | Administrasi | `administrasiddu@gmail.com` | Melihat serta menginput realisasi semua unit |
| Inen Karyadi | Divisi 1 | `divisi1@gmail.com` | Data dan realisasi Divisi 1 |
| Romipan 2 | Divisi 2 | `divisi2@gmail.com` | Data dan realisasi Divisi 2 |
| Ejang AR | Divisi 3 | `divisi3@gmail.com` | Data dan realisasi Divisi 3 |

Backend produksi menggunakan Node.js 20+ dan membaca port dari environment variable `PORT`. Gunakan HTTPS (`DDU_HTTPS=1`), `DDU_TRUST_PROXY=1` saat berada tepat di belakang proxy Hostinger, kata sandi unik minimal 12 karakter, dan backup database secara berkala.

## Migrasi SQLite ke MySQL Hostinger

Gunakan `.env.example` sebagai panduan, lalu atur `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, dan `DB_PASSWORD` melalui environment variable. Jangan commit `.env`.

Nama dasar yang digunakan adalah `dduapp`: database `dduapp` dan pengguna `dduapp_user`. Jika Hostinger otomatis menambahkan awalan akun (misalnya `u123456789_`), gunakan nama lengkap yang ditampilkan hPanel pada environment variable.

Ekspor database lokal hanya satu kali. File tujuan sengaja ditolak bila sudah ada agar backup sebelumnya tidak tertimpa:

```powershell
npm run db:export
```

Setelah membuat database MySQL kosong di Hostinger, uji koneksi dan impor:

```powershell
npm run db:check
npm run db:import
```

`migration-data.json`, database SQLite, `.env`, dan direktori backup tidak dilacak Git. Impor menolak database tujuan yang sudah berisi akun untuk mencegah duplikasi atau penimpaan data.

Pada alur **Pengajuan Anggaran**, batas persetujuan Ketua tersimpan terpusat di database dengan nilai awal Rp500.000. Pengajuan di bawah batas cukup diverifikasi Bendahara, sedangkan pengajuan senilai atau di atas batas diteruskan kepada Ketua. Ketua dapat mengubah batas tersebut langsung dari halaman Pengajuan Anggaran; perubahan berlaku untuk pengajuan baru dan nilai kebijakan yang berlaku disimpan pada setiap pengajuan sebagai jejak audit.

## Rekomendasi AI laporan Sekretaris

Analisis otomatis lokal selalu tersedia. Agar tombol AI menggunakan OpenAI Responses API, tetapkan environment variable di komputer server sebelum menjalankan aplikasi:

```powershell
$env:OPENAI_API_KEY="kunci-api-Anda"
$env:OPENAI_MODEL="gpt-5"
npm start
```

Jangan menulis kunci API di `index.html`, JavaScript, database, atau repository Git. Integrasi hanya mengirim statistik kinerja agregat dan ringkasan laporan/SWOT unit tanpa nama maupun kontak donatur, serta menggunakan `store: false`.
