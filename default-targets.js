'use strict';

const targets = [
  ['Ketua','Silaturahmi donatur besar (Audiensi)','aktivitas','bulanan',1,'audiensi','Target 1 audiensi per bulan.'],
  ['Ketua','Evaluasi bulanan','aktivitas','bulanan',1,'evaluasi','Target 1 evaluasi per bulan.'],
  ['Ketua','Pengembangan jaringan lembaga','aktivitas','bulanan',1,'jaringan','Masjid, pesantren, majelis taklim, perusahaan, dan lembaga lainnya.'],
  ['Ketua','Penguatan legalitas lembaga','aktivitas','tahunan',1,'legalitas','Penguatan status UPZ, Nazhir, atau LAZ.'],
  ['Ketua','Pembinaan SDM (Kru & Penerima Manfaat)','aktivitas','bulanan',1,'kegiatan','Kajian dan motivasi tim.'],

  ['Administrasi','Update database donatur','aktivitas','mingguan',7,'pembaruan','Target dilakukan setiap hari; dikonversi menjadi 7 pembaruan per minggu.'],
  ['Administrasi','Update surat masuk & keluar','aktivitas','mingguan',1,'pembaruan','Target mingguan.'],
  ['Administrasi','Rekap donasi','aktivitas','mingguan',1,'rekap','Target mingguan.'],
  ['Administrasi','Laporan bulanan','aktivitas','bulanan',1,'laporan','Diselesaikan setiap awal bulan.'],
  ['Administrasi','Arsip digital','aktivitas','bulanan',1,'program','Arsip harus rapi untuk setiap program.'],
  ['Administrasi','Dokumentasi kegiatan','aktivitas','bulanan',1,'kegiatan','Dokumentasi dilengkapi pada setiap kegiatan.'],

  ['Bendahara','Laporan kas','aktivitas','mingguan',1,'laporan','Target mingguan.'],
  ['Bendahara','RAB Bulanan','aktivitas','bulanan',1,'RAB','Target bulanan.'],
  ['Bendahara','Laporan keuangan bulanan','aktivitas','bulanan',1,'laporan','Target bulanan.'],
  ['Bendahara','Rekap kotak amal','aktivitas','bulanan',1,'rekap','Target bulanan.'],
  ['Bendahara','Audit internal sederhana','aktivitas','tahunan',4,'audit','Target 1 audit setiap 3 bulan.'],
  ['Bendahara','Pengarsipan bukti transaksi','aktivitas','mingguan',7,'arsip','Target dilakukan setiap hari; dikonversi menjadi 7 arsip per minggu.'],

  ['Divisi 1','Monitoring kotak','aktivitas','mingguan',1,'monitoring','Target mingguan.'],
  ['Divisi 1','Distribusi Kotak','jumlah','mingguan',5,'kotak','Target 5 kotak per minggu.'],
  ['Divisi 1','Distribusi Tabung Mitra Eksternal','jumlah','bulanan',25,'tabung','Target 25 tabung per bulan.'],
  ['Divisi 1','Penghimpunan Kotak','uang','mingguan',2500000,'rupiah','Target Rp2,5 juta per minggu.'],
  ['Divisi 1','Penghimpunan Tabung','uang','bulanan',20000000,'rupiah','Target Rp20 juta atau 250 tabung per bulan.'],
  ['Divisi 1','Evaluasi titik / JD sepi','aktivitas','bulanan',1,'evaluasi','Target bulanan.'],
  ['Divisi 1','Mencatat pemasukan dan pengeluaran','aktivitas','mingguan',1,'pencatatan','Target mingguan.'],
  ['Divisi 1','Konten distribusi / penarikan kotak amal','jumlah','mingguan',1,'konten','Target minimum 1; rentang sasaran 1-2 konten per minggu.'],

  ['Divisi 2','Surat terkirim','jumlah','bulanan',300,'surat','Target 300 surat per bulan.'],
  ['Divisi 2','Proposal terkirim','jumlah','bulanan',50,'proposal','Target 50 proposal per bulan.'],
  ['Divisi 2','Follow up proposal','aktivitas','mingguan',1,'tindak lanjut','Target mingguan.'],
  ['Divisi 2','Menghimpun dana ZISWAF','uang','mingguan',7400000,'rupiah','Target Rp7,4 juta per minggu.'],
  ['Divisi 2','Mencatat pemasukan dan pengeluaran','aktivitas','mingguan',1,'pencatatan','Dilakukan mingguan dan direkap bulanan.'],
  ['Divisi 2','Kerja sama baru','jumlah','bulanan',1,'kerja sama','Target minimum 1; rentang sasaran 1-2 kerja sama per bulan.'],
  ['Divisi 2','Database mitra','jumlah','bulanan',20,'mitra','Target minimum 20; rentang sasaran 20-25 data mitra per bulan.'],

  ['Divisi 3','Posting konten','jumlah','mingguan',1,'konten','Target minimum 1; rentang sasaran 1-2 konten per minggu.'],
  ['Divisi 3','Broadcast WhatsApp','jumlah','mingguan',3,'broadcast','Target minimum 3; rentang sasaran 3-4 broadcast dan 800-1000 jangkauan per minggu.'],
  ['Divisi 3','Menghimpun dana ZISWAF','uang','mingguan',21000000,'rupiah','Target Rp21 juta per minggu.'],
  ['Divisi 3','Mencatat pemasukan dan pengeluaran','aktivitas','mingguan',1,'pencatatan','Target mingguan.'],
  ['Divisi 3','Campaign Ads Wakaf','aktivitas','bulanan',1,'campaign','Target bulanan.'],
  ['Divisi 3','Konten Program PHBI / Event Besar Tahunan','aktivitas','tahunan',1,'event','Target dibuat untuk setiap event besar tahunan.'],
  ['Divisi 3','Laporan penyaluran','aktivitas','bulanan',1,'laporan','Laporan wajib untuk setiap program penyaluran.'],
  ['Divisi 3','Penambahan Data Donatur / Calon','jumlah','bulanan',30,'donatur','Target 30 data per bulan.'],
  ['Divisi 3','Live Stream Daily Activity & Jumat Berkah','jumlah','mingguan',2,'live stream','Target minimum 2; rentang sasaran 2-3 live stream per minggu.'],
  ['Divisi 3','Khotm Al-Quran','aktivitas','bulanan',1,'kegiatan','Target 1 kali per bulan.']
];

async function seedDefaultTargets({ q, now }) {
  const timestamp = now();
  const targetYear = Number(timestamp.slice(0, 4));
  await q("UPDATE targets SET active=0 WHERE division='Divisi 2' AND program IN ('Proposal - Surat terkirim','Proposal & Surat terkirim')");
  await mergeDuplicateLiveStreamTargets(q);
  let inserted = 0;
  for (const [division, program, targetType, period, value, unit, note] of targets) {
    const users = await q('SELECT id FROM users WHERE division=? AND active=1 ORDER BY id LIMIT 1', [division]);
    if (!users[0]) continue;
    const existing = await q('SELECT id FROM targets WHERE division=? AND program=? AND target_year=? LIMIT 1', [division, program, targetYear]);
    if (existing[0]) continue;
    await q(`INSERT INTO targets(user_id,division,program,target_type,period,target_year,target_value,unit,note,active,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,1,?)`, [users[0].id, division, program, targetType, period, targetYear, value, unit, note, timestamp]);
    inserted++;
  }
  return inserted;
}

async function mergeDuplicateLiveStreamTargets(q) {
  const preferred = 'Live Stream Daily Activity & Jumat Berkah';
  const duplicate = 'Live Stream (Daily Activity & Jumat Berkah)';
  const duplicates = await q("SELECT id,target_year FROM targets WHERE division='Divisi 3' AND program=? AND active=1 ORDER BY target_year,id", [duplicate]);
  for (const item of duplicates) {
    const existing = await q("SELECT id FROM targets WHERE division='Divisi 3' AND program=? AND target_year=? AND active=1 ORDER BY id LIMIT 1", [preferred, item.target_year]);
    if (!existing[0]) {
      await q('UPDATE targets SET program=? WHERE id=?', [preferred, item.id]);
      continue;
    }
    const keepId = existing[0].id;
    await q(`DELETE duplicate_report FROM weekly_reports duplicate_report
      JOIN weekly_reports kept_report ON kept_report.target_id=? AND kept_report.week_start=duplicate_report.week_start
      WHERE duplicate_report.target_id=?`, [keepId, item.id]);
    await q('UPDATE weekly_reports SET target_id=? WHERE target_id=?', [keepId, item.id]);
    await q('UPDATE targets SET active=0 WHERE id=?', [item.id]);
  }
  await q("UPDATE realizations SET program=? WHERE division='Divisi 3' AND program=?", [preferred, duplicate]);
}

module.exports = { targets, seedDefaultTargets };
