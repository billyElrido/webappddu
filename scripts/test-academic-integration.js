'use strict';

const crypto = require('crypto');
const mysql = require('mysql2/promise');

const baseUrl = process.env.DDU_TEST_URL || `http://127.0.0.1:${process.env.DDU_PORT || 8000}`;

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
  const marker = `UJI-AKADEMIK-${Date.now()}`;
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const csrf = crypto.randomBytes(24).toString('base64url');
  const cookieName = process.env.DDU_HTTPS === '1' ? '__Host-ddu_session' : 'ddu_session';
  const sessionHashes = [tokenHash];
  let donorId = 0, targetAcademicYearId = 0;
  try {
    const [[chair]] = await db.execute("SELECT id FROM users WHERE role='ketua' AND active=1 ORDER BY id LIMIT 1");
    if (!chair) throw Error('Akun Ketua tidak tersedia.');
    const timestamp = new Date().toISOString();
    await db.execute('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)', [tokenHash, chair.id, csrf, new Date(Date.now() + 600000).toISOString(), timestamp]);
    const headers = { Cookie: `${cookieName}=${token}`, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf };

    const referenceResponse = await fetch(baseUrl + '/api/reference-options', { headers });
    const references = await referenceResponse.json();
    const academicResponse = await fetch(baseUrl + '/api/academic-years', { headers });
    const academics = await academicResponse.json();
    const templateResponse = await fetch(baseUrl + '/api/import/template/donors', { headers });
    if (!referenceResponse.ok || !academicResponse.ok || !templateResponse.ok) throw Error(`Endpoint akademik belum siap (referensi ${referenceResponse.status}, tahun ${academicResponse.status}: ${academics.error || '-'}, template ${templateResponse.status}).`);
    const levels = references.groups?.education_level || [], classes = references.groups?.school_class || [];
    if (!['MTs', 'SMP', 'MA', 'SMA'].every(value => levels.includes(value))) throw Error('Referensi jenjang belum lengkap.');
    if (classes.length < 48) throw Error('Referensi 48 kelas A–D belum lengkap.');
    if (!academics.current?.year_label || !academics.target_year) throw Error('Tahun ajaran aktif atau tahun tujuan belum tersedia.');
    if (!academics.fiscal_cycle_independent) throw Error('Siklus tahun ajaran belum dipisahkan dari tahun buku.');
    if ((academics.promotion_plan || []).length < 48) throw Error('Rencana kenaikan per kelas belum lengkap.');

    const [accounts] = await db.execute('SELECT id,role,division FROM users WHERE active=1 ORDER BY id');
    for (const account of accounts) {
      if (Number(account.id) === Number(chair.id)) {
        if (!academics.can_rollover) throw Error('Hak pengelolaan tahun ajaran akun Ketua tidak aktif.');
        continue;
      }
      const accountToken = crypto.randomBytes(32).toString('base64url');
      const accountHash = crypto.createHash('sha256').update(accountToken).digest('hex');
      const accountCsrf = crypto.randomBytes(24).toString('base64url');
      sessionHashes.push(accountHash);
      await db.execute('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)', [accountHash, account.id, accountCsrf, new Date(Date.now() + 600000).toISOString(), timestamp]);
      const response = await fetch(baseUrl + '/api/academic-years', { headers: { Cookie: `${cookieName}=${accountToken}` } });
      const view = await response.json();
      if (!response.ok) throw Error(`Data tahun ajaran tidak dapat dibuka akun ${account.division}: ${view.error || response.status}`);
      if (view.current?.year_label !== academics.current.year_label || view.target_year !== academics.target_year || Number(view.pending_total?? -1) !== Number(academics.pending_total)) throw Error(`Data tahun ajaran akun ${account.division} tidak bersumber dari Satu Data.`);
      const shouldManage = ['ketua', 'sekretaris'].includes(account.role);
      if (Boolean(view.can_rollover) !== shouldManage) throw Error(`Hak akses tahun ajaran akun ${account.division} tidak sesuai.`);
    }

    const source = academics.promotion_plan.find(item => !item.terminal && Number(item.pending_count) === 0 && item.suggested_target);
    if (!source) {
      process.stdout.write(`Integrasi akademik ${accounts.length} akun OK; uji mutasi dilewati karena seluruh kelas memiliki data aktif.\n`);
      return;
    }
    const [[existingTarget]] = await db.execute('SELECT id FROM academic_years WHERE year_label=?', [academics.target_year]);
    if (!existingTarget) {
      const [createdYear] = await db.execute("INSERT INTO academic_years(year_label,start_year,status,created_by,created_at) VALUES(?,?,'planning',?,?)", [academics.target_year, Number(academics.target_year.slice(0, 4)), chair.id, timestamp]);
      targetAcademicYearId = Number(createdYear.insertId);
    }
    const joinedAt = `${academics.current.start_year}-07-01`;
    const [donor] = await db.execute('INSERT INTO donors(user_id,division,name,phone,address,donor_type,status,joined_at,note,placement_type,distribution_route,maps_url,photo_data,donation_frequency,education_level,current_class,academic_year,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [chair.id, 'Ketua', marker, '', '', 'Donatur', 'aktif', joinedAt, '', '', '', '', '', 'Belum rutin', source.education_level, source.source_class, academics.current.year_label, timestamp]);
    donorId = Number(donor.insertId);
    await db.execute('INSERT INTO donor_class_assignments(donor_id,academic_year,education_level,class_name,created_by,created_at) VALUES(?,?,?,?,?,?)', [donorId, academics.current.year_label, source.education_level, source.source_class, chair.id, timestamp]);

    const promoteResponse = await fetch(baseUrl + '/api/academic-years/promote-class', {
      method: 'POST', headers,
      body: JSON.stringify({ source_year: academics.current.year_label, target_year: academics.target_year, source_class: source.source_class, target_class: source.suggested_target })
    });
    const promoted = await promoteResponse.json();
    if (!promoteResponse.ok || !promoted.ok || Number(promoted.total) !== 1) throw Error(`Kenaikan per kelas gagal: ${promoted.error || promoteResponse.status}`);
    const [[donorAfter]] = await db.execute('SELECT education_level,current_class,academic_year FROM donors WHERE id=?', [donorId]);
    const [[sourceAfter]] = await db.execute('SELECT assignment_status FROM donor_class_assignments WHERE donor_id=? AND academic_year=?', [donorId, academics.current.year_label]);
    const [[targetAfter]] = await db.execute('SELECT class_name,assignment_status FROM donor_class_assignments WHERE donor_id=? AND academic_year=?', [donorId, academics.target_year]);
    if (donorAfter.current_class !== source.suggested_target || donorAfter.academic_year !== academics.target_year || sourceAfter.assignment_status !== 'promoted' || targetAfter.class_name !== source.suggested_target || targetAfter.assignment_status !== 'active') throw Error('Hasil kenaikan kelas belum konsisten pada Satu Data.');
    process.stdout.write(`Integrasi akademik ${accounts.length} akun OK: ${source.source_class} naik ke ${source.suggested_target}; seluruh akun memakai Satu Data dan tahun buku tetap independen.\n`);
  } finally {
    if (donorId) await db.execute('DELETE FROM donors WHERE id=?', [donorId]).catch(() => {});
    if (targetAcademicYearId) {
      const [[usage]] = await db.execute('SELECT COUNT(*) total FROM donor_class_assignments WHERE academic_year=(SELECT year_label FROM academic_years WHERE id=?)', [targetAcademicYearId]).catch(() => [[{ total: 1 }]]);
      if (!Number(usage?.total)) await db.execute("DELETE FROM academic_years WHERE id=? AND status='planning'", [targetAcademicYearId]).catch(() => {});
    }
    for (const sessionHash of sessionHashes) await db.execute('DELETE FROM sessions WHERE token_hash=?', [sessionHash]).catch(() => {});
    await db.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
