'use strict';

const mysql = require('mysql2/promise');

const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) {
  console.error(`Environment variable belum lengkap: ${missing.join(', ')}`);
  process.exit(1);
}

(async () => {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === '1' ? { rejectUnauthorized: true } : undefined,
    charset: 'utf8mb4'
  });
  const [[row]] = await connection.query('SELECT DATABASE() AS db, VERSION() AS version');
  console.log(`Koneksi MySQL berhasil: ${row.db} (MySQL ${row.version})`);
  await connection.end();
})().catch(error => {
  console.error(`Koneksi MySQL gagal: ${error.message}`);
  process.exit(1);
});
