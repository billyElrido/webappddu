'use strict';

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = process.env.DDU_SQLITE_PATH || path.join(root, 'ddu_control.db');
const outputDir = path.join(root, 'backups');
const destination = process.env.DDU_SQL_FILE || path.join(outputDir, 'dduapp-mysql-import.sql');
const tables = ['users','targets','weekly_reports','realizations','evaluations','donors','budget_requests','transactions','executive_reports','user_deletion_requests','approval_requests','budget_usages'];

if (!fs.existsSync(source)) throw new Error(`Database SQLite tidak ditemukan: ${source}`);
if (fs.existsSync(destination)) throw new Error(`File tujuan sudah ada dan tidak akan ditimpa: ${destination}`);
fs.mkdirSync(outputDir, { recursive: true });

const literal = value => {
  if (value === null || value === undefined || value === '') return value === '' ? "''" : 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (Buffer.isBuffer(value)) return `0x${value.toString('hex')}`;
  return `CONVERT(0x${Buffer.from(String(value), 'utf8').toString('hex')} USING utf8mb4)`;
};

const sqlite = new Database(source, { readonly: true, fileMustExist: true });
const schema = fs.readFileSync(path.join(root, 'database', 'mysql-schema.sql'), 'utf8');
const lines = [
  '-- DDU App - migrasi SQLite ke MySQL',
  `-- Dibuat: ${new Date().toISOString()}`,
  '-- Sesi login sengaja tidak diekspor.',
  'SET NAMES utf8mb4;',
  'SET FOREIGN_KEY_CHECKS=0;',
  schema,
  ''
];

for (const table of tables) {
  const exists = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
  const rows = exists ? sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all() : [];
  if (!rows.length) { lines.push(`-- ${table}: 0 baris`); continue; }
  const columns = Object.keys(rows[0]);
  for (let start = 0; start < rows.length; start += 100) {
    const batch = rows.slice(start, start + 100);
    lines.push(`INSERT INTO \`${table}\` (${columns.map(c=>`\`${c}\``).join(',')}) VALUES`);
    lines.push(batch.map(row => `(${columns.map(c=>literal(row[c])).join(',')})`).join(',\n') + ';');
  }
  lines.push(`-- ${table}: ${rows.length} baris`, '');
}
lines.push('SET FOREIGN_KEY_CHECKS=1;', 'COMMIT;', '');
sqlite.close();
fs.writeFileSync(destination, lines.join('\n'), { encoding: 'utf8', flag: 'wx' });
console.log(`SQL MySQL siap diimpor: ${destination}`);
