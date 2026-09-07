'use strict';

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = process.env.DDU_SQLITE_PATH || path.join(root, 'ddu_control.db');
const destination = process.env.DDU_MIGRATION_FILE || path.join(root, 'migration-data.json');
const tables = ['users', 'sessions', 'targets', 'weekly_reports', 'realizations', 'evaluations', 'donors', 'transactions', 'executive_reports', 'user_deletion_requests', 'approval_requests', 'budget_requests', 'budget_usages'];

if (!fs.existsSync(source)) {
  console.error(`Database SQLite tidak ditemukan: ${source}`);
  process.exit(1);
}

const db = new Database(source, { readonly: true, fileMustExist: true });
const data = { exported_at: new Date().toISOString(), source: path.basename(source), tables: {} };
for (const table of tables) {
  const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
  data.tables[table] = exists ? db.prepare(`SELECT * FROM ${table}${table === 'sessions' ? '' : ' ORDER BY id'}`).all() : [];
}
db.close();
fs.writeFileSync(destination, JSON.stringify(data, null, 2), { encoding: 'utf8', flag: 'wx' });
console.log(`Ekspor selesai: ${destination}`);
for (const table of tables) console.log(`${table}: ${data.tables[table].length} baris`);
