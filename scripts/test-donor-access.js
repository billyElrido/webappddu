'use strict';

const crypto = require('crypto');
const mysql = require('mysql2/promise');

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
  const hashes = [];
  try {
    const [users] = await db.execute("SELECT id,role,division FROM users WHERE active=1 AND (role IN ('ketua','sekretaris') OR division IN ('Administrasi','Bendahara')) ORDER BY id");
    const required = ['Ketua', 'Sekretaris', 'Administrasi', 'Bendahara'];
    if (!required.every(division => users.some(user => user.division === division))) throw Error('Akun pengujian akses donatur belum lengkap.');
    const snapshots = {};
    for (const user of users.filter(item => required.includes(item.division))) {
      const token = crypto.randomBytes(32).toString('base64url');
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      hashes.push(hash);
      const timestamp = new Date().toISOString();
      await db.execute('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)', [hash, user.id, crypto.randomBytes(20).toString('hex'), new Date(Date.now() + 600000).toISOString(), timestamp]);
      const response = await fetch((process.env.DDU_TEST_URL || 'http://127.0.0.1:8000') + '/api/donors?date_from=1900-01-01&date_to=2100-12-31', { headers: { Cookie: `ddu_session=${token}` } });
      const data = await response.json();
      if (!response.ok) throw Error(`${user.division}: ${data.error || response.status}`);
      snapshots[user.division] = data.items.map(item => Number(item.id));
    }
    const expected = JSON.stringify(snapshots.Ketua);
    for (const division of required.slice(1)) if (JSON.stringify(snapshots[division]) !== expected) throw Error(`Data donatur ${division} belum sama dengan Ketua.`);
    process.stdout.write(`Akses donatur OK: ${snapshots.Ketua.length} data sama pada Ketua, Sekretaris, Administrasi, dan Bendahara.\n`);
  } finally {
    if (hashes.length) await db.query('DELETE FROM sessions WHERE token_hash IN (?)', [hashes]);
    await db.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
