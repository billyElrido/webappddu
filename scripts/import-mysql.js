'use strict';

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = process.env.DDU_MIGRATION_FILE || path.join(root, 'migration-data.json');
const schemaFile = path.join(root, 'database', 'mysql-schema.sql');
const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) throw new Error(`Environment variable belum lengkap: ${missing.join(', ')}`);
if (!fs.existsSync(source)) throw new Error(`File ekspor tidak ditemukan: ${source}`);

const payload = JSON.parse(fs.readFileSync(source, 'utf8'));
const order = ['users', 'targets', 'weekly_reports', 'realizations', 'evaluations', 'donors', 'transactions', 'executive_reports', 'user_deletion_requests', 'approval_requests', 'budget_requests', 'budget_usages'];

(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === '1' ? { rejectUnauthorized: true } : undefined,
    charset: 'utf8mb4',
    multipleStatements: true
  });
  try {
    await db.query(fs.readFileSync(schemaFile, 'utf8'));
    const [[count]] = await db.query('SELECT COUNT(*) AS total FROM users');
    if (Number(count.total) && process.env.DDU_IMPORT_FORCE !== '1') {
      throw new Error('Database tujuan sudah berisi pengguna. Impor dibatalkan agar data tidak tertimpa. Gunakan database kosong.');
    }
    await db.beginTransaction();
    await db.query('SET FOREIGN_KEY_CHECKS=0');
    for (const table of order) {
      const rows = payload.tables?.[table] || [];
      for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => '?').join(',');
        await db.execute(`INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(',')}) VALUES (${placeholders})`, columns.map(c => row[c]));
      }
      console.log(`${table}: ${rows.length} baris diimpor`);
    }
    await db.query('SET FOREIGN_KEY_CHECKS=1');
    await db.commit();
    console.log('Migrasi SQLite ke MySQL berhasil.');
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
})().catch(error => {
  console.error(`Migrasi gagal: ${error.message}`);
  process.exit(1);
});
