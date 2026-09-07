'use strict';
const mysql = require('mysql2/promise');
const { seedDefaultTargets } = require('../default-targets');

(async () => {
  const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === '1' ? { rejectUnauthorized: true } : undefined,
    decimalNumbers: true,
    dateStrings: true
  });
  const q = async (sql, params = []) => (await db.execute(sql, params))[0];
  const inserted = await seedDefaultTargets({ q, now: () => new Date().toISOString() });
  console.log(`${inserted} target baru ditambahkan; target yang sudah ada tidak diduplikasi.`);
  await db.end();
})().catch(error => { console.error(error); process.exit(1); });
