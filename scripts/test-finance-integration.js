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
  const marker = `UJI-KEUANGAN-${Date.now()}`;
  const sessionHashes = [];
  let donorId = 0, autoDonorId = 0, importDonorId = 0, donationId = 0, autoDonationId = 0, repeatDonationId = 0, importDonationId = 0, budgetId = 0, coreExpenseId = 0;
  try {
    const [accounts] = await db.execute("SELECT id,role,division FROM users WHERE active=1 ORDER BY id");
    const account = division => accounts.find(item => item.division === division);
    const chair = accounts.find(item => item.role === 'ketua');
    const secretary = accounts.find(item => item.role === 'sekretaris');
    const treasurer = account('Bendahara');
    const administration = account('Administrasi');
    const supervisor = accounts.find(item => item.role === 'pengawas');
    const owner = accounts.find(item => item.role === 'divisi' && !['Bendahara','Administrasi','Dewan Pengawas'].includes(item.division));
    const unrelated = accounts.find(item => item.role === 'divisi' && item.id !== owner?.id && !['Bendahara','Administrasi','Dewan Pengawas'].includes(item.division));
    if (!chair || !secretary || !treasurer || !administration || !supervisor || !owner || !unrelated) throw Error('Akun pengujian laporan keuangan belum lengkap.');
    const [[fiscal]] = await db.execute("SELECT fiscal_year FROM fiscal_years WHERE status='open' ORDER BY fiscal_year DESC LIMIT 1");
    if (!fiscal) throw Error('Tahun buku berjalan tidak tersedia.');
    const date = `${fiscal.fiscal_year}-01-18`, timestamp = new Date().toISOString();
    const sessions = new Map();
    for (const user of [chair, secretary, treasurer, administration, supervisor, owner, unrelated]) {
      const token = crypto.randomBytes(32).toString('base64url'), tokenHash = crypto.createHash('sha256').update(token).digest('hex'), csrf = crypto.randomBytes(24).toString('base64url');
      sessionHashes.push(tokenHash);
      await db.execute('INSERT INTO sessions(token_hash,user_id,csrf_token,expires_at,created_at) VALUES(?,?,?,?,?)', [tokenHash, user.id, csrf, new Date(Date.now() + 600000).toISOString(), timestamp]);
      sessions.set(user.id, { Cookie: `ddu_session=${token}`, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf });
    }
    const [donor] = await db.execute(
      'INSERT INTO donors(user_id,division,name,phone,address,donor_type,status,joined_at,note,placement_type,distribution_route,maps_url,photo_data,donation_frequency,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [owner.id, owner.division, marker, '', '', 'Donatur', 'aktif', date, '', '', '', '', '', 'Belum rutin', timestamp]
    );
    donorId = Number(donor.insertId);
    const ownerHeaders = sessions.get(owner.id);
    const donationResponse = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST', headers: ownerHeaders,
      body: JSON.stringify({ division: owner.division, date, transaction_type: 'pemasukan', category: 'Sedekah', amount: 123456, description: marker, donor_id: donorId, source_name: marker, source_class: '', source_education_level: '', academic_year: '', source_origin: '', distribution_route: '' })
    });
    const donationPayload = await donationResponse.json();
    if (donationResponse.status !== 201 || !donationPayload.id) throw Error(`Pemasukan donasi gagal: ${donationPayload.error || donationResponse.status}`);
    donationId = Number(donationPayload.id);
    const [[storedDonation]] = await db.execute('SELECT donor_id,accounting_type FROM transactions WHERE id=?', [donationId]);
    if (Number(storedDonation?.donor_id) !== donorId || storedDonation.accounting_type !== 'donation_income') throw Error(`Pemasukan belum terhubung ke Satu Data donatur (donor ${storedDonation?.donor_id || '-'}, tipe ${storedDonation?.accounting_type || '-'}).`);

    const autoDonorName = `${marker}-DONATUR-BARU`;
    const autoDonationResponse = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST', headers: ownerHeaders,
      body: JSON.stringify({ division: owner.division, date, transaction_type: 'pemasukan', category: 'Infak', amount: 234567, description: `${marker}-BARU-1`, source_name: autoDonorName, donor_phone: '081290000001', donor_type: 'Donatur', donation_frequency: 'Belum rutin', placement_type: '', source_class: '', source_education_level: '', academic_year: '', source_origin: '', distribution_route: '' })
    });
    const autoDonationPayload = await autoDonationResponse.json();
    if (autoDonationResponse.status !== 201 || !autoDonationPayload.donor_created || !autoDonationPayload.donor_id) throw Error(`Profil donatur baru tidak dibuat otomatis: ${autoDonationPayload.error || autoDonationResponse.status}`);
    autoDonationId = Number(autoDonationPayload.id);
    autoDonorId = Number(autoDonationPayload.donor_id);
    const [[autoDonor]] = await db.execute('SELECT id,division,name,phone,donor_type,donation_frequency,status FROM donors WHERE id=?', [autoDonorId]);
    if (!autoDonor || autoDonor.name !== autoDonorName || autoDonor.division !== owner.division || autoDonor.phone !== '081290000001' || autoDonor.status !== 'aktif') throw Error('Profil otomatis belum tersimpan lengkap pada Data Donatur pusat.');

    const repeatDonationResponse = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST', headers: ownerHeaders,
      body: JSON.stringify({ division: owner.division, date, transaction_type: 'pemasukan', category: 'Sedekah', amount: 234568, description: `${marker}-BARU-2`, source_name: autoDonorName, donor_phone: '', donor_type: 'Donatur', donation_frequency: 'Belum rutin', placement_type: '', source_class: '', source_education_level: '', academic_year: '', source_origin: '', distribution_route: '' })
    });
    const repeatDonationPayload = await repeatDonationResponse.json();
    if (repeatDonationResponse.status !== 201 || repeatDonationPayload.donor_created || Number(repeatDonationPayload.donor_id) !== autoDonorId) throw Error(`Donasi berulang tidak memakai profil donor pusat yang sama: ${repeatDonationPayload.error || repeatDonationResponse.status}`);
    repeatDonationId = Number(repeatDonationPayload.id);
    const [[donorCopies]] = await db.execute('SELECT COUNT(*) total FROM donors WHERE division=? AND name=?', [owner.division, autoDonorName]);
    if (Number(donorCopies.total) !== 1) throw Error('Donasi berulang membuat profil donatur ganda.');

    const importDonorName = `${marker}-IMPORT-BARU`, importDescription = `${marker}-IMPORT-DONASI`;
    const importResponse = await fetch(`${baseUrl}/api/import`, {
      method: 'POST', headers: ownerHeaders,
      body: JSON.stringify({ type: 'incomes', rows: [{ division: owner.division, date, category: 'Sedekah', amount: 345678, description: importDescription, source_name: importDonorName, donor_phone: '081290000002', donor_type: 'Donatur', donation_frequency: 'Belum rutin', placement_type: '', education_level: '', source_class: '', academic_year: '', source_origin: '', distribution_route: '' }] })
    });
    const importPayload = await importResponse.json();
    if (importResponse.status !== 201 || Number(importPayload.imported) !== 1 || Number(importPayload.created_donors) !== 1) throw Error(`Impor pemasukan belum membuat profil donor terpusat: ${importPayload.error || importResponse.status}`);
    const [[importDonor]] = await db.execute('SELECT id FROM donors WHERE division=? AND name=?', [owner.division, importDonorName]);
    const [[importDonation]] = await db.execute('SELECT id,donor_id FROM transactions WHERE division=? AND description=?', [owner.division, importDescription]);
    importDonorId = Number(importDonor?.id || 0); importDonationId = Number(importDonation?.id || 0);
    if (!importDonorId || !importDonationId || Number(importDonation.donor_id) !== importDonorId) throw Error('Hasil impor pemasukan belum tertaut ke profil donor yang otomatis dibuat.');

    const requestCode = `ANG-${marker}`;
    const [budget] = await db.execute(
      "INSERT INTO budget_requests(request_code,requester_id,division,amount,purpose,status,chair_approval_required,chair_approval_limit,rejection_note,treasurer_by,treasurer_at,disbursed_by,disbursed_at,disbursed_amount,created_at,updated_at) VALUES(?,?,?,?,?,'accountability',0,500000,'',?,?,?,?,?,?,?)",
      [requestCode, owner.id, owner.division, 1000000, marker, treasurer.id, timestamp, treasurer.id, timestamp, 1000000, timestamp, timestamp]
    );
    budgetId = Number(budget.insertId);
    await db.execute('INSERT INTO budget_usages(budget_request_id,user_id,usage_date,category,amount,description,proof_note,created_at) VALUES(?,?,?,?,?,?,?,?)', [budgetId, owner.id, date, 'Operasional', 400000, marker, 'KWT-UJI', timestamp]);
    await db.execute("INSERT INTO transactions(user_id,division,transaction_date,transaction_type,category,amount,description,accounting_type,budget_request_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)", [owner.id, owner.division, date, 'pengeluaran', 'Operasional', 400000, `${requestCode}: ${marker}`, 'actual_expense', budgetId, timestamp]);
    const directUsageResponse = await fetch(`${baseUrl}/api/budget-requests`, {
      method: 'PUT', headers: ownerHeaders,
      body: JSON.stringify({ id: budgetId, action: 'add_usage', date, category: 'Transportasi', amount: 1000, description: `${marker}-INPUT-LANGSUNG`, proof_note: 'KWT-LANGSUNG' })
    });
    const directUsagePayload = await directUsageResponse.json();
    if (!directUsageResponse.ok) throw Error(`Input LPJ langsung gagal tersimpan: ${directUsagePayload.error || directUsageResponse.status}`);
    const forbiddenUsageResponse = await fetch(`${baseUrl}/api/budget-requests`, {
      method: 'PUT', headers: sessions.get(unrelated.id),
      body: JSON.stringify({ id: budgetId, action: 'add_usage', date, category: 'Operasional', amount: 1, description: `${marker}-UNIT-LAIN`, proof_note: '' })
    });
    if (forbiddenUsageResponse.status !== 403) throw Error('Akun unit lain dapat mengisi LPJ pengajuan yang bukan miliknya.');
    const [[directUsageStored]] = await db.execute('SELECT COUNT(*) total FROM budget_usages WHERE budget_request_id=? AND description=?', [budgetId, `${marker}-INPUT-LANGSUNG`]);
    if (Number(directUsageStored.total) !== 1) throw Error('Input LPJ langsung belum masuk ke tabel penggunaan anggaran pusat.');
    const [coreExpense] = await db.execute("INSERT INTO transactions(user_id,division,transaction_date,transaction_type,category,amount,description,accounting_type,created_at) VALUES(?,?,?,?,?,?,?,?,?)", [secretary.id, secretary.division, date, 'pengeluaran', 'Operasional', 222222, `${marker}-BIAYA-LEMBAGA`, 'actual_expense', timestamp]);
    coreExpenseId = Number(coreExpense.insertId);

    const range = `date_from=${fiscal.fiscal_year}-01-01&date_to=${fiscal.fiscal_year}-12-31`;
    async function read(user, path) {
      const response = await fetch(`${baseUrl}${path}`, { headers: sessions.get(user.id) });
      const payload = await response.json();
      if (!response.ok) throw Error(`${user.division} ${path}: ${payload.error || response.status}`);
      return payload;
    }
    for (const user of [chair, secretary, treasurer, administration, owner]) {
      const transactions = await read(user, `/api/transactions?${range}`);
      const budgets = await read(user, `/api/finance/budget-report?${range}`);
      const donors = await read(user, '/api/donors/options');
      if (!transactions.items.some(item => Number(item.id) === donationId)) throw Error(`Pemasukan donasi tidak terlihat oleh ${user.division}.`);
      if (!budgets.items.some(item => Number(item.id) === budgetId)) throw Error(`Pembukuan anggaran tidak terlihat oleh ${user.division}.`);
      if (!donors.items.some(item => Number(item.id) === donorId)) throw Error(`Referensi donatur tidak terlihat oleh ${user.division}.`);
    }
    const unrelatedTransactions = await read(unrelated, `/api/transactions?${range}`);
    const unrelatedBudgets = await read(unrelated, `/api/finance/budget-report?${range}`);
    const unrelatedDonors = await read(unrelated, '/api/donors/options');
    if (unrelatedTransactions.items.some(item => Number(item.id) === donationId) || unrelatedBudgets.items.some(item => Number(item.id) === budgetId) || unrelatedDonors.items.some(item => Number(item.id) === donorId)) throw Error('Akun unit lain dapat melihat data di luar ruang unitnya.');

    async function totalsFor(unit = '') {
      const incomeSql = `SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE transaction_type='pemasukan' AND transaction_date BETWEEN ? AND ?${unit ? ' AND division=?' : ''}`;
      const expenseSql = `SELECT COALESCE(SUM(amount),0) total FROM transactions WHERE transaction_type='pengeluaran' AND accounting_type<>'internal_advance' AND transaction_date BETWEEN ? AND ?${unit ? ' AND division=?' : " AND division IN ('Ketua','Sekretaris','Bendahara','Administrasi')"}`;
      const params = [`${fiscal.fiscal_year}-01-01`, `${fiscal.fiscal_year}-12-31`, ...(unit ? [unit] : [])];
      const [incomeResult, expenseResult] = await Promise.all([db.execute(incomeSql, params), db.execute(expenseSql, params)]);
      return { income: Number(incomeResult[0][0].total), expense: Number(expenseResult[0][0].total) };
    }
    function assertEfficiency(label, payload, expected) {
      const ratio = expected.income ? Math.round(expected.expense / expected.income * 1000) / 10 : 0;
      if (Number(payload.income) !== expected.income || Number(payload.expense) !== expected.expense || Number(payload.ratio) !== ratio || Number(payload.net) !== expected.income - expected.expense) throw Error(`Rasio biaya ${label} tidak sesuai akumulasi database pusat.`);
    }
    const ownerTotals = await totalsFor(owner.division), institutionTotals = await totalsFor(), unrelatedTotals = await totalsFor(unrelated.division);
    assertEfficiency('unit', await read(owner, `/api/dashboard/financial-efficiency?${range}`), ownerTotals);
    assertEfficiency('unit pilihan Ketua', await read(chair, `/api/dashboard/financial-efficiency?division=${encodeURIComponent(owner.division)}&${range}`), ownerTotals);
    for (const user of [chair, secretary, treasurer, administration, supervisor]) assertEfficiency(`lembaga untuk ${user.division}`, await read(user, `/api/dashboard/financial-efficiency?${range}`), institutionTotals);
    assertEfficiency('isolasi unit lain', await read(unrelated, `/api/dashboard/financial-efficiency?division=${encodeURIComponent(owner.division)}&${range}`), unrelatedTotals);

    const directExpense = await fetch(`${baseUrl}/api/transactions`, {
      method: 'POST', headers: ownerHeaders,
      body: JSON.stringify({ division: owner.division, date, transaction_type: 'pengeluaran', category: 'Operasional', amount: 1, description: marker, source_name: '' })
    });
    if (directExpense.status !== 409) throw Error('Jalur pengeluaran langsung belum ditutup.');
    const donationExport = await fetch(`${baseUrl}/api/transactions/export?scope=period&report=donations&${range}`, { headers: sessions.get(chair.id) });
    const budgetExport = await fetch(`${baseUrl}/api/finance/budget-report/export?${range}`, { headers: sessions.get(chair.id) });
    if (!donationExport.ok || !budgetExport.ok || !String(donationExport.headers.get('content-type')).includes('spreadsheetml') || !String(budgetExport.headers.get('content-type')).includes('spreadsheetml')) throw Error('Ekspor dua laporan keuangan belum tersedia.');
    await donationExport.arrayBuffer();
    await budgetExport.arrayBuffer();
    process.stdout.write('Integrasi laporan keuangan OK: donor baru otomatis dibuat, donasi berulang terhubung, rasio biaya akurat, anggaran terpusat, hak akses terjaga, dan kedua laporan dapat diekspor.\n');
  } finally {
    if (coreExpenseId) await db.execute('DELETE FROM transactions WHERE id=?', [coreExpenseId]).catch(() => {});
    if (importDonationId) await db.execute('DELETE FROM transactions WHERE id=?', [importDonationId]).catch(() => {});
    if (repeatDonationId) await db.execute('DELETE FROM transactions WHERE id=?', [repeatDonationId]).catch(() => {});
    if (autoDonationId) await db.execute('DELETE FROM transactions WHERE id=?', [autoDonationId]).catch(() => {});
    if (donationId) await db.execute('DELETE FROM transactions WHERE id=?', [donationId]).catch(() => {});
    if (budgetId) await db.execute('DELETE FROM transactions WHERE budget_request_id=?', [budgetId]).catch(() => {});
    if (budgetId) await db.execute('DELETE FROM budget_requests WHERE id=?', [budgetId]).catch(() => {});
    if (donorId) await db.execute('DELETE FROM donors WHERE id=?', [donorId]).catch(() => {});
    if (autoDonorId) await db.execute('DELETE FROM donors WHERE id=?', [autoDonorId]).catch(() => {});
    if (importDonorId) await db.execute('DELETE FROM donors WHERE id=?', [importDonorId]).catch(() => {});
    if (sessionHashes.length) await db.query('DELETE FROM sessions WHERE token_hash IN (?)', [sessionHashes]).catch(() => {});
    await db.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
