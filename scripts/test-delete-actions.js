'use strict';

const crypto = require('crypto');
const mysql = require('mysql2/promise');

const baseUrl = process.env.DDU_TEST_URL || 'http://127.0.0.1:8000';

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === '1' ? { rejectUnauthorized: true } : undefined,
    charset: 'utf8mb4_unicode_ci'
  });
  const marker = `UJI-HAPUS-${Date.now()}`;
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const csrf = crypto.randomBytes(24).toString('base64url');
  let donorId = 0, transactionId = 0, referenceId = 0;
  try {
    const [[chair]] = await db.execute("SELECT id FROM users WHERE role='ketua' AND active=1 ORDER BY id LIMIT 1");
    const [[fiscal]] = await db.execute("SELECT fiscal_year FROM fiscal_years WHERE status='open' ORDER BY fiscal_year DESC LIMIT 1");
    if (!chair || !fiscal) throw Error('Akun Ketua atau tahun buku berjalan tidak tersedia.');
    const date = `${fiscal.fiscal_year}-01-15`, timestamp = new Date().toISOString();
    await db.execute('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)', [tokenHash, chair.id, csrf, new Date(Date.now() + 600000).toISOString(), timestamp]);
    const [reference] = await db.execute("INSERT INTO reference_options(option_type,option_value,sort_order,active,created_by,created_at) VALUES('source_origin',?,9999,1,?,?)", [marker, chair.id, timestamp]);
    referenceId = Number(reference.insertId);
    const [donor] = await db.execute("INSERT INTO donors(user_id,division,name,phone,address,donor_type,status,joined_at,note,placement_type,distribution_route,maps_url,photo_data,donation_frequency,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [chair.id, 'Ketua', marker, '', '', 'Donatur', 'aktif', date, '', '', '', '', '', 'Belum rutin', timestamp]);
    donorId = Number(donor.insertId);
    const [transaction] = await db.execute("INSERT INTO transactions(user_id,division,transaction_date,transaction_type,category,amount,description,created_at) VALUES(?,?,?,?,?,?,?,?)", [chair.id, 'Ketua', date, 'pemasukan', 'Penerimaan Lainnya', 1, marker, timestamp]);
    transactionId = Number(transaction.insertId);
    const headers = { Cookie: `ddu_session=${token}`, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };
    for (const [label, path] of [['donatur', `/api/donors?id=${donorId}`], ['transaksi', `/api/transactions?id=${transactionId}`], ['referensi', `/api/reference-options?id=${referenceId}`]]) {
      const response = await fetch(baseUrl + path, { method: 'DELETE', headers });
      const payload = await response.json();
      if (response.status !== 200 || !payload.ok) throw Error(`Penghapusan ${label} gagal: ${payload.error || response.status}`);
    }
    const [[protectedReference]] = await db.execute("SELECT id FROM reference_options WHERE option_type='donor_status' AND option_value='aktif' AND active=1 LIMIT 1");
    if (protectedReference) {
      const response = await fetch(`${baseUrl}/api/reference-options?id=${protectedReference.id}`, { method: 'DELETE', headers });
      if (response.status !== 409) throw Error('Pilihan inti Data Referensi tidak terlindungi.');
    }
    const [[donorLeft]] = await db.execute('SELECT COUNT(*) total FROM donors WHERE id=?', [donorId]);
    const [[transactionLeft]] = await db.execute('SELECT COUNT(*) total FROM transactions WHERE id=?', [transactionId]);
    const [[referenceState]] = await db.execute('SELECT active FROM reference_options WHERE id=?', [referenceId]);
    if (Number(donorLeft.total) || Number(transactionLeft.total) || Number(referenceState?.active) !== 0) throw Error('Hasil penghapusan belum konsisten pada database pusat.');
    process.stdout.write('Aksi hapus OK: donatur dan transaksi terhapus, referensi nonaktif, pilihan inti terlindungi.\n');
  } finally {
    if (donorId) await db.execute('DELETE FROM donors WHERE id=?', [donorId]).catch(() => {});
    if (transactionId) await db.execute('DELETE FROM transactions WHERE id=?', [transactionId]).catch(() => {});
    if (referenceId) await db.execute('DELETE FROM reference_options WHERE id=?', [referenceId]).catch(() => {});
    await db.execute('DELETE FROM sessions WHERE token_hash=?', [tokenHash]).catch(() => {});
    await db.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
