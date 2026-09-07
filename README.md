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
- Pencatatan pemasukan, pengeluaran, dan saldo bulanan per divisi.
- Daftar transaksi dapat diunduh sebagai Excel untuk rentang waktu terpilih atau seluruh data sesuai hak akses akun.
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
- pemasukan;
- pengeluaran;
- program dan target;
- capaian target; dan
- laporan realisasi beserta SWOT.

Setiap workbook mempunyai sheet **Data** yang dapat langsung diedit di Microsoft Excel atau Google Sheets, contoh pengisian, format tanggal/angka, daftar pilihan, dan sheet **Petunjuk**. Dari Google Sheets, unduh kembali sebagai Microsoft Excel (`.xlsx`) sebelum diunggah. Berkas CSV dengan pemisah koma, titik koma, atau tab tetap diterima untuk kompatibilitas.

Impor maksimal 200 baris dan ukuran workbook maksimal 2 MB diproses dalam satu transaksi database. Jika satu baris tidak valid, seluruh berkas dibatalkan sehingga tidak meninggalkan hasil impor parsial. Akun unit hanya dapat mengimpor ke unitnya sendiri. Ketua dan Sekretaris dapat mengimpor lintas unit, sedangkan Administrasi tidak dapat menulis data untuk Ketua, Sekretaris, atau Dewan Pengawas.

Nama program pada template capaian dan realisasi harus sama dengan nama aktif pada menu **Program & Target**. Impor target dengan nama program yang sudah ada akan memperbarui target tersebut, bukan membuat duplikat baru.

Template target memiliki kolom `target_year`. Target dengan nama yang sama dapat memiliki nilai berbeda pada setiap tahun tanpa mengubah arsip tahun sebelumnya.

Target berbentuk uang menggunakan transaksi **Pemasukan** sebagai satu-satunya sumber realisasi agar nominal tidak dihitung dua kali. Template **Capaian Target** digunakan untuk target jumlah dan aktivitas; laporan realisasi uang tetap dapat disimpan sebagai laporan naratif tanpa menambah nominal dashboard.

## Pergantian tahun buku

1. Ketua memilih **Salin & siapkan target** pada menu Program & Target. Target tahun lama disalin sebagai rancangan tahun berikutnya.
2. Saat statusnya **Perencanaan**, setiap divisi dapat merevisi target miliknya atau menambahkan program baru.
3. Ketua menyelesaikan seluruh pengajuan anggaran/pengeluaran tertunda lalu menutup tahun berjalan. Tahun yang ditutup tetap dapat dibuka sebagai laporan, tetapi seluruh perubahan datanya ditolak server.
4. Setelah tahun lama ditutup, Ketua membuka tahun baru. Transaksi, capaian, realisasi, evaluasi, dan pengajuan baru kemudian dapat dicatat pada tahun tersebut.

Kolom `targets.target_year` dan tabel `fiscal_years` dibuat atau dimigrasikan otomatis ketika `server.js` pertama kali dijalankan setelah pembaruan.

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

Pengeluaran sebesar Rp5.000.000 atau lebih otomatis menunggu persetujuan Ketua. Batas ini dapat diubah sebelum server dijalankan melalui environment variable `DDU_LARGE_DISBURSEMENT_LIMIT` (isi dengan nominal rupiah tanpa tanda baca).

## Rekomendasi AI laporan Sekretaris

Analisis otomatis lokal selalu tersedia. Agar tombol AI menggunakan OpenAI Responses API, tetapkan environment variable di komputer server sebelum menjalankan aplikasi:

```powershell
$env:OPENAI_API_KEY="kunci-api-Anda"
$env:OPENAI_MODEL="gpt-5"
npm start
```

Jangan menulis kunci API di `index.html`, JavaScript, database, atau repository Git. Integrasi hanya mengirim statistik kinerja agregat dan ringkasan laporan/SWOT unit tanpa nama maupun kontak donatur, serta menggunakan `store: false`.
