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
├── server.py                # API, autentikasi, dan SQLite
└── start-ddu.bat            # Peluncur aplikasi Windows
```

## Menjalankan

Klik dua kali `start-ddu.bat`, atau jalankan:

```powershell
python server.py
```

Buka `http://127.0.0.1:8000`. Database SQLite dan akun awal dibuat otomatis.

## Modul kerja

- Target uang, jumlah, atau aktivitas per periode mingguan, bulanan, dan tahunan.
- Input capaian mingguan dengan akumulasi otomatis ke ringkasan bulanan dan tahunan.
- Database muzaki/donatur dan status keaktifannya.
- Pencatatan pemasukan, pengeluaran, dan saldo bulanan per divisi.
- Delapan program awal Divisi 1 telah diisi berdasarkan proker Penggalangan Kotak & Tabung Infak.

## Akun pengurus

Pada instalasi baru, aplikasi membuat kata sandi awal acak dan menampilkannya satu kali di terminal. Anda juga dapat menentukan kata sandi awal melalui environment variable `DDU_INITIAL_PASSWORD` sebelum pertama kali menjalankan aplikasi. Jangan menyimpan kata sandi tersebut di repository.

| Nama | Peran | Email | Cakupan akses |
|---|---|---|---|
| Eva Margareta | Ketua | `ketuaddu@gmail.com` | Seluruh data, target, evaluasi, laporan, dan pengguna |
| Sabili Ridho | Sekretaris | `sekretarisddu@gmail.com` | Seluruh data, target, realisasi, evaluasi, dan laporan |
| Epiyani | Bendahara | `ddubendahara@gmail.com` | Data dan realisasi Bendahara |
| Romipan | Administrasi | `administrasiddu@gmail.com` | Melihat serta menginput realisasi semua unit |
| Inen Karyadi | Divisi 1 | `divisi1@gmail.com` | Data dan realisasi Divisi 1 |
| Romipan 2 | Divisi 2 | `divisi2@gmail.com` | Data dan realisasi Divisi 2 |
| Ejang AR | Divisi 3 | `divisi3@gmail.com` | Data dan realisasi Divisi 3 |

Untuk produksi, gunakan HTTPS (`DDU_HTTPS=1`), reverse proxy, kata sandi unik, backup database, dan jangan mengekspos server Python bawaan langsung ke internet.
