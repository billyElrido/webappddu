'use strict';

const crypto = require('crypto');
const mysql = require('mysql2/promise');

const baseUrl = process.env.DDU_TEST_URL || 'http://127.0.0.1:8011';

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === '1' ? { rejectUnauthorized: true } : undefined,
    charset: 'utf8mb4_unicode_ci'
  });
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const csrf = crypto.randomBytes(24).toString('base64url');
  const currentYear = new Date().getFullYear(), currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  let supervisorTokenHash = '', expiredTokenHash = '', absoluteTokenHash = '', temporaryFiscalYear = 0, securityUserId = 0;
  try {
    const [[user]] = await connection.execute("SELECT id FROM users WHERE role='ketua' AND active=1 ORDER BY id LIMIT 1");
    const [[target]] = await connection.execute("SELECT id,division,program,target_type,period,target_year,target_value,unit,note FROM targets WHERE division='Divisi 1' AND target_year=YEAR(CURDATE()) AND active=1 ORDER BY id LIMIT 1");
    if (!user || !target) throw Error('Akun Ketua atau target pengujian tidak tersedia.');
    const securityPassword = `Uji-DDU-${crypto.randomBytes(12).toString('base64url')}`, securityEmail = `uji-keamanan-${Date.now()}@example.invalid`, legacySalt = crypto.randomBytes(16), legacyHash = `${legacySalt.toString('hex')}:${crypto.pbkdf2Sync(securityPassword, legacySalt, 310000, 32, 'sha256').toString('hex')}`;
    const [securityUser] = await connection.execute("INSERT INTO users(name,email,password_hash,role,division,active,created_at) VALUES(?,?,?,?,?,1,?)", ['Pengujian Keamanan', securityEmail, legacyHash, 'divisi', 'Unit Uji Keamanan', new Date().toISOString()]);
    securityUserId = securityUser.insertId;
    const loginResponse = await fetch(`${baseUrl}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: securityEmail, password: securityPassword }) });
    const loginPayload = await loginResponse.json(), setCookies = loginResponse.headers.getSetCookie?.() || [loginResponse.headers.get('set-cookie') || ''], setCookie = setCookies.find(value => /^ddu_session=[^;]/i.test(value) && !/^ddu_session=;/i.test(value)) || '';
    if (loginResponse.status !== 200 || !setCookie || !/HttpOnly/i.test(setCookie) || !/SameSite=Strict/i.test(setCookie) || /Max-Age=|Expires=/i.test(setCookie)) throw Error('Cookie sesi aman/nonpersisten tidak diterapkan.');
    const [[upgradedUser]] = await connection.execute('SELECT password_hash FROM users WHERE id=?', [securityUserId]);
    if (!upgradedUser.password_hash.startsWith('pbkdf2-sha256$600000$')) throw Error('Hash kata sandi lama tidak ditingkatkan saat login.');
    const loginCookie = setCookie.split(';')[0];
    const invalidPhoto = await fetch(`${baseUrl}/api/donors`, { method: 'POST', headers: { Cookie: loginCookie, 'Content-Type': 'application/json', 'X-CSRF-Token': loginPayload.csrf }, body: JSON.stringify({ division: 'Unit Uji Keamanan', name: 'Uji', joined_at: `${currentYear}-01-01`, status: 'aktif', photo_data: 'data:text/html;base64,PHNjcmlwdD4=' }) });
    if (invalidPhoto.status !== 400) throw Error('Validasi tipe foto di server tidak diterapkan.');
    const logoutResponse = await fetch(`${baseUrl}/api/logout`, { method: 'POST', headers: { Cookie: loginCookie, 'Content-Type': 'application/json', 'X-CSRF-Token': loginPayload.csrf }, body: '{}' });
    if (logoutResponse.status !== 200) throw Error('Logout sesi pengujian keamanan gagal.');
    const timestamp = new Date().toISOString();
    const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await connection.execute('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)', [tokenHash, user.id, csrf, expires, timestamp]);
    const headers = { Cookie: `ddu_session=${token}` };
    const activityResponse = await fetch(`${baseUrl}/api/session/activity`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: '{}'
    });
    if (activityResponse.status !== 200) throw Error(`Pembaruan aktivitas sesi mengembalikan ${activityResponse.status}.`);
    const activityPayload = await activityResponse.json();
    if (!activityPayload.ok || Number(activityPayload.session_idle_minutes) < 5) throw Error('Respons batas sesi tidak valid.');
    const expiredToken = crypto.randomBytes(32).toString('base64url');
    expiredTokenHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
    await connection.execute('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)', [expiredTokenHash, user.id, crypto.randomBytes(24).toString('base64url'), new Date(Date.now() - 60000).toISOString(), timestamp]);
    const expiredResponse = await fetch(`${baseUrl}/api/targets?date_from=${currentYear}-01-01&date_to=${currentYear}-12-31`, { headers: { Cookie: `ddu_session=${expiredToken}` } });
    if (expiredResponse.status !== 401) throw Error(`Sesi kedaluwarsa seharusnya ditolak 401, diterima ${expiredResponse.status}.`);
    const absoluteToken = crypto.randomBytes(32).toString('base64url');
    absoluteTokenHash = crypto.createHash('sha256').update(absoluteToken).digest('hex');
    await connection.execute('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)', [absoluteTokenHash, user.id, crypto.randomBytes(24).toString('base64url'), new Date(Date.now() + 60000).toISOString(), new Date(Date.now() - 25 * 3600000).toISOString()]);
    const absoluteResponse = await fetch(`${baseUrl}/api/me`, { headers: { Cookie: `ddu_session=${absoluteToken}` } });
    const absolutePayload = await absoluteResponse.json();
    if (absoluteResponse.status !== 200 || absolutePayload.user) throw Error('Batas waktu absolut sesi tidak diterapkan.');
    const pageResponse = await fetch(`${baseUrl}/`);
    if (!pageResponse.headers.get('content-security-policy') || pageResponse.headers.get('x-frame-options') !== 'DENY' || pageResponse.headers.get('x-content-type-options') !== 'nosniff') throw Error('Header keamanan HTTP belum lengkap.');
    const evaluationResponse = await fetch(`${baseUrl}/api/evaluations?date_from=${currentYear}-01-01&date_to=${currentYear}-12-31`, { headers });
    if (evaluationResponse.status !== 200) throw Error(`Endpoint evaluasi mengembalikan ${evaluationResponse.status}.`);
    const targetsResponse = await fetch(`${baseUrl}/api/targets?consolidated=1&month=${currentMonth}&year=${currentYear}&date_from=${currentYear}-01-01&date_to=${currentYear}-12-31`, { headers });
    if (targetsResponse.status !== 200) throw Error(`Endpoint target terpusat mengembalikan ${targetsResponse.status}.`);
    const targetsPayload = await targetsResponse.json();
    if (!Array.isArray(targetsPayload.items)) throw Error('Respons target terpusat tidak valid.');
    if (!targetsPayload.items.every(item => Number(item.target_year) === currentYear)) throw Error('Target tidak terpisah sesuai tahun buku.');
    const fiscalResponse = await fetch(`${baseUrl}/api/fiscal-years`, { headers });
    if (fiscalResponse.status !== 200) throw Error(`Endpoint tahun buku mengembalikan ${fiscalResponse.status}.`);
    const fiscalPayload = await fiscalResponse.json();
    if (!fiscalPayload.items.some(item => Number(item.fiscal_year) === currentYear)) throw Error('Tahun buku berjalan tidak tersedia.');
    for (let year = 2100; year > currentYear; year--) {
      const [[used]] = await connection.execute('SELECT (SELECT COUNT(*) FROM fiscal_years WHERE fiscal_year=?) + (SELECT COUNT(*) FROM targets WHERE target_year=?) total', [year, year]);
      if (!Number(used.total)) { temporaryFiscalYear = year; break; }
    }
    if (!temporaryFiscalYear) throw Error('Tidak tersedia tahun sementara untuk menguji perencanaan.');
    const prepareResponse = await fetch(`${baseUrl}/api/fiscal-years/prepare`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ source_year: currentYear, target_year: temporaryFiscalYear })
    });
    if (prepareResponse.status !== 201) throw Error(`Persiapan tahun buku mengembalikan ${prepareResponse.status}.`);
    const planningTargetsResponse = await fetch(`${baseUrl}/api/targets?consolidated=1&month=${temporaryFiscalYear}-01&year=${temporaryFiscalYear}&date_from=${temporaryFiscalYear}-01-01&date_to=${temporaryFiscalYear}-12-31`, { headers });
    const planningTargets = await planningTargetsResponse.json();
    if (planningTargetsResponse.status !== 200 || !planningTargets.items?.length) throw Error('Target tahun perencanaan tidak berhasil disalin.');
    const planningActivity = planningTargets.items.find(item => item.target_type !== 'uang');
    const reviseResponse = await fetch(`${baseUrl}/api/targets`, {
      method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ id: planningActivity.id, program: planningActivity.program, target_type: planningActivity.target_type,
        period: planningActivity.period, target_value: Number(planningActivity.target_value), unit: planningActivity.unit, note: 'Revisi target tahun perencanaan' })
    });
    if (reviseResponse.status !== 200) throw Error(`Revisi target tahun perencanaan mengembalikan ${reviseResponse.status}.`);
    const blockedActivity = await fetch(`${baseUrl}/api/weekly-reports`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ target_id: planningActivity.id, week_start: `${temporaryFiscalYear}-01-05`, actual_value: 1, note: 'Harus ditolak saat perencanaan' })
    });
    if (blockedActivity.status !== 409) throw Error(`Capaian pada tahun perencanaan seharusnya ditolak 409, diterima ${blockedActivity.status}.`);
    const prematureOpen = await fetch(`${baseUrl}/api/fiscal-years/status`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ year: temporaryFiscalYear, action: 'open', confirmation: String(temporaryFiscalYear) })
    });
    if (prematureOpen.status !== 409) throw Error(`Dua tahun buku berjalan seharusnya ditolak 409, diterima ${prematureOpen.status}.`);
    const [[supervisor]] = await connection.execute("SELECT id FROM users WHERE role='pengawas' AND active=1 ORDER BY id LIMIT 1");
    if (supervisor) {
      const supervisorToken = crypto.randomBytes(32).toString('base64url');
      supervisorTokenHash = crypto.createHash('sha256').update(supervisorToken).digest('hex');
      await connection.execute('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)', [supervisorTokenHash, supervisor.id, crypto.randomBytes(24).toString('base64url'), expires, timestamp]);
      const supervisorResponse = await fetch(`${baseUrl}/api/supervisor-dashboard-range?date_from=${currentYear}-01-01&date_to=${currentYear}-01-31&mode=month`, { headers: { Cookie: `ddu_session=${supervisorToken}` } });
      if (supervisorResponse.status !== 200) throw Error(`Dashboard pengawas mengembalikan ${supervisorResponse.status}.`);
      const multiYearResponse = await fetch(`${baseUrl}/api/supervisor-dashboard-range?date_from=${currentYear-1}-01-01&date_to=${currentYear+1}-12-31&mode=years`, { headers: { Cookie: `ddu_session=${supervisorToken}` } });
      if (multiYearResponse.status !== 200) throw Error(`Dashboard pengawas rentang tahun mengembalikan ${multiYearResponse.status}.`);
    }
    const marker = `ROLLBACK-TEST-${Date.now()}`;
    const importResponse = await fetch(`${baseUrl}/api/import`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ type: 'targets', rows: [
        { division: target.division, target_year: target.target_year, program: target.program, target_type: target.target_type, period: target.period, target_value: Number(target.target_value), unit: target.unit, note: marker },
        { division: 'Unit Pengujian Tidak Ada', target_year: target.target_year, program: 'Baris tidak valid', target_type: 'aktivitas', period: 'bulanan', target_value: 1, unit: 'kegiatan', note: '' }
      ] })
    });
    if (importResponse.status !== 400) throw Error(`Impor invalid seharusnya 400, diterima ${importResponse.status}.`);
    const [[after]] = await connection.execute('SELECT note FROM targets WHERE id=?', [target.id]);
    if (after.note === marker || after.note !== target.note) throw Error('Transaksi impor tidak berhasil di-rollback.');
    console.log('Integrasi pusat OK: sesi idle/absolut, header keamanan, pemisahan tahun, perencanaan, penguncian input, dashboard pengawas, dan rollback atomik.');
  } finally {
    await connection.execute('DELETE FROM sessions WHERE token_hash=?', [tokenHash]).catch(() => {});
    if (expiredTokenHash) await connection.execute('DELETE FROM sessions WHERE token_hash=?', [expiredTokenHash]).catch(() => {});
    if (absoluteTokenHash) await connection.execute('DELETE FROM sessions WHERE token_hash=?', [absoluteTokenHash]).catch(() => {});
    if (securityUserId) await connection.execute('DELETE FROM users WHERE id=?', [securityUserId]).catch(() => {});
    if (supervisorTokenHash) await connection.execute('DELETE FROM sessions WHERE token_hash=?', [supervisorTokenHash]).catch(() => {});
    if (temporaryFiscalYear) {
      await connection.execute('DELETE FROM targets WHERE target_year=?', [temporaryFiscalYear]).catch(() => {});
      await connection.execute('DELETE FROM fiscal_years WHERE fiscal_year=?', [temporaryFiscalYear]).catch(() => {});
    }
    await connection.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
