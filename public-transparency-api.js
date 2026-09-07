'use strict';

module.exports = function registerPublicTransparency({ app, auth, route, q, one, tx, today }) {
  const buildSnapshot = async () => {
    const year = today().slice(0, 4);
    const from = `${year}-01-01`;
    const to = today();
    const financialRows = await q(`SELECT transaction_type,amount,accounting_type,budget_request_id
      FROM transactions WHERE transaction_date BETWEEN ? AND ?`, [from, to]);
    const advances = new Set(financialRows.filter(x => x.accounting_type === 'internal_advance').map(x => x.budget_request_id));
    const income = financialRows.filter(x => x.transaction_type === 'pemasukan').reduce((n, x) => n + Number(x.amount), 0);
    const expense = financialRows.filter(x => x.transaction_type === 'pengeluaran' &&
      !(x.accounting_type === 'actual_expense' && advances.has(x.budget_request_id)))
      .reduce((n, x) => n + Number(x.amount), 0);
    const activity = await one(`SELECT COUNT(*) activities,COUNT(DISTINCT program) programs
      FROM realizations WHERE realization_date BETWEEN ? AND ?`, [from, to]);
    const donor = await one("SELECT COUNT(*) active_partners FROM donors WHERE status='aktif' AND joined_at<=?", [to]);
    const trendRows = await q(`SELECT DATE_FORMAT(transaction_date,'%Y-%m') month,
      SUM(CASE WHEN transaction_type='pemasukan' THEN amount ELSE 0 END) income
      FROM transactions WHERE transaction_date BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(transaction_date,'%Y-%m') ORDER BY month`, [from, to]);
    const trendMap = Object.fromEntries(trendRows.map(x => [x.month, Number(x.income)]));
    const trend = Array.from({ length: 12 }, (_, index) => {
      const month = `${year}-${String(index + 1).padStart(2, '0')}`;
      return { month, income: trendMap[month] || 0 };
    });
    const categories = (await q(`SELECT COALESCE(NULLIF(category,''),'Lainnya') category,SUM(amount) amount
      FROM transactions WHERE transaction_type='pemasukan' AND transaction_date BETWEEN ? AND ?
      GROUP BY category ORDER BY amount DESC LIMIT 6`, [from, to]))
      .map(x => ({ category: x.category, amount: Number(x.amount) }));
    return { period_start: from, period_end: to, data: {
      income, expense, activities: Number(activity.activities), programs: Number(activity.programs),
      active_partners: Number(donor.active_partners), trend, categories
    }};
  };

  app.get('/api/transparency/preview', auth({ roles: ['ketua'] }), route(async (req, res) => {
    res.json(await buildSnapshot());
  }));

  app.get('/api/public/transparency', route(async (req, res) => {
    const publication = await one(`SELECT period_start,period_end,public_data,approved_at
      FROM transparency_publications WHERE active=1 ORDER BY id DESC LIMIT 1`);
    if (!publication) return res.status(404).json({ error: 'Data transparansi belum dipublikasikan.' });
    let data;
    try { data = JSON.parse(publication.public_data); }
    catch { return res.status(500).json({ error: 'Snapshot transparansi tidak valid.' }); }
    const safeData = {
      income: Number(data.income || 0), expense: Number(data.expense || 0),
      activities: Number(data.activities || 0), programs: Number(data.programs || 0),
      active_partners: Number(data.active_partners || 0),
      trend: Array.isArray(data.trend) ? data.trend.map(x => ({ month: x.month, income: Number(x.income || 0) })) : [],
      categories: Array.isArray(data.categories) ? data.categories.map(x => ({ category: x.category, amount: Number(x.amount || 0) })) : []
    };
    res.json({ period_start: publication.period_start, period_end: publication.period_end,
      approved_at: publication.approved_at, data: safeData });
  }));

  app.post('/api/transparency/publish', auth({ csrf: true, roles: ['ketua'] }), route(async (req, res) => {
    const snapshot = await buildSnapshot();
    const approvedAt = new Date().toISOString();
    const id = await tx(async connection => {
      await q('UPDATE transparency_publications SET active=0 WHERE active=1', [], connection);
      const result = await q(`INSERT INTO transparency_publications
        (snapshot_date,period_start,period_end,public_data,approved_by,approved_at,active)
        VALUES(?,?,?,?,?,?,1)`, [today(), snapshot.period_start, snapshot.period_end,
        JSON.stringify(snapshot.data), req.user.id, approvedAt], connection);
      return result.insertId;
    });
    res.status(201).json({ ok: true, id, message: 'Data transparansi telah disetujui dan dipublikasikan.' });
  }));
};
