'use strict';

module.exports = function registerSupervisorDashboard({ app, auth, route, q, range }) {
  const goalForRange = (item, from, to) => {
    const value = Number(item.target_value || 0);
    const year = Number(item.target_year), clippedFrom = from < `${year}-01-01` ? `${year}-01-01` : from;
    const clippedTo = to > `${year}-12-31` ? `${year}-12-31` : to;
    if (clippedFrom > clippedTo) return 0;
    const start = new Date(`${clippedFrom}T00:00:00`), end = new Date(`${clippedTo}T00:00:00`);
    const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const isMonth = clippedFrom.endsWith('-01') && start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() && end.getDate() === monthEnd.getDate();
    const isYear = clippedFrom.endsWith('-01-01') && clippedTo.endsWith('-12-31');
    if (days === 7) return item.period === 'mingguan' ? value : item.period === 'bulanan' ? value / 4 : value / 48;
    if (isMonth) return item.period === 'mingguan' ? value * 4 : item.period === 'bulanan' ? value : value / 12;
    if (isYear) return item.period === 'mingguan' ? value * 48 : item.period === 'bulanan' ? value * 12 : value;
    const weeks = days / 7;
    return item.period === 'mingguan' ? value * weeks : item.period === 'bulanan' ? value * (weeks / 4) : value * (weeks / 48);
  };

  app.get('/api/supervisor-dashboard-range', auth({ roles: ['pengawas'] }), route(async (req, res) => {
    const selected = range(req.query);
    const mode = ['week', 'month', 'year', 'previous-year', 'next-year', 'years', 'custom'].includes(req.query.mode) ? req.query.mode : 'month';
    const fromDate = new Date(`${selected.from}T00:00:00`);
    const toDate = new Date(`${selected.to}T00:00:00`);
    const days = Math.max(1, Math.round((toDate - fromDate) / 86400000) + 1);
    const rows = await q(`WITH activity AS (
      SELECT w.target_id,w.week_start activity_date,w.actual_value FROM weekly_reports w
        JOIN targets wt ON wt.id=w.target_id WHERE wt.target_type<>'uang' AND w.note NOT LIKE 'Keuangan:%'
      UNION ALL
      SELECT t.id,x.transaction_date,x.amount FROM transactions x JOIN targets t
        ON t.division=x.division AND t.active=1 AND t.target_year=YEAR(x.transaction_date) AND t.program=CASE
          WHEN x.division IN ('Divisi 2','Divisi 3') THEN 'Menghimpun dana ZISWAF'
          ELSE CASE WHEN x.category='Kotak Amal' THEN 'Penghimpunan Kotak'
            WHEN x.category='Tabung Infak' THEN 'Penghimpunan Tabung'
            WHEN x.category='Transfer Bank / TF' THEN 'Penghimpunan Transfer / TF'
            WHEN x.category='QRIS' THEN 'Penghimpunan QRIS'
            ELSE 'Penghimpunan Donasi / Sedekah' END END
        WHERE x.transaction_type='pemasukan'
      ), actuals AS (
        SELECT target_id,SUM(CASE WHEN activity_date BETWEEN ? AND ? THEN actual_value ELSE 0 END) actual
        FROM activity GROUP BY target_id
      )
      SELECT t.division,t.program,t.target_type,t.period,t.target_year,t.target_value,COALESCE(a.actual,0) actual
      FROM targets t LEFT JOIN actuals a ON a.target_id=t.id
      WHERE t.active=1 AND t.target_year BETWEEN ? AND ? AND t.division<>'Dewan Pengawas' ORDER BY t.target_year,t.division,t.id`, [selected.from, selected.to, Number(selected.from.slice(0,4)), Number(selected.to.slice(0,4))]);

    const groups = {};
    let achieved = 0, near = 0, attention = 0, totalScore = 0;
    for (const item of rows) {
      const goal = goalForRange(item, selected.from, selected.to);
      const percentage = goal ? Math.round(Number(item.actual || 0) / goal * 100) : 0;
      const score = Math.min(100, Math.max(0, percentage));
      const group = groups[item.division] || (groups[item.division] = {
        division: item.division, programs: 0, score: 0, money_target: 0, money_actual: 0
      });
      group.programs += 1;
      group.score += score;
      totalScore += score;
      if (item.target_type === 'uang') {
        group.money_target += goal;
        group.money_actual += Number(item.actual || 0);
      }
      if (percentage >= 85) achieved += 1;
      else if (percentage >= 70) near += 1;
      else attention += 1;
    }
    const units = Object.values(groups).map(item => ({
      ...item, achievement: item.programs ? Math.round(item.score / item.programs) : 0
    }));

    const transactions = await q(`SELECT transaction_type,amount,accounting_type,budget_request_id
      FROM transactions WHERE transaction_date BETWEEN ? AND ?`, [selected.from, selected.to]);
    const advances = new Set(transactions.filter(item => item.accounting_type === 'internal_advance').map(item => item.budget_request_id));
    const income = transactions.filter(item => item.transaction_type === 'pemasukan').reduce((sum, item) => sum + Number(item.amount), 0);
    const cashOut = transactions.filter(item => item.transaction_type === 'pengeluaran' &&
      !(item.accounting_type === 'actual_expense' && advances.has(item.budget_request_id)))
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const groupFormat = days <= 62 ? '%Y-%m-%d' : '%Y-%m';
    const trendRows = await q(`SELECT DATE_FORMAT(transaction_date,'${groupFormat}') period,
      SUM(CASE WHEN transaction_type='pemasukan' THEN amount ELSE 0 END) income,
      SUM(CASE WHEN transaction_type='pengeluaran' AND accounting_type<>'actual_expense' THEN amount ELSE 0 END) expense
      FROM transactions WHERE transaction_date BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(transaction_date,'${groupFormat}') ORDER BY period`, [selected.from, selected.to]);
    const financeTrend = trendRows.map(item => ({
      month: item.period, income: Number(item.income || 0), expense: Number(item.expense || 0)
    }));

    res.json({
      period_label: `${selected.from} s.d. ${selected.to}`,
      summary: {
        programs: rows.length,
        achievement: rows.length ? Math.round(totalScore / rows.length) : 0,
        achieved, near, attention, income, cash_out: cashOut, balance: income - cashOut
      },
      units,
      finance_trend: financeTrend
    });
  }));
};
