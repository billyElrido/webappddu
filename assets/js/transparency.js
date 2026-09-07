'use strict';
(() => {
  const money = value => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
  }).format(value || 0);
  const compactMoney = value => {
    const amount = Number(value || 0);
    if (amount >= 1e9) return `Rp ${(amount / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} M`;
    if (amount >= 1e6) return `Rp ${(amount / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} jt`;
    if (amount >= 1e3) return `Rp ${(amount / 1e3).toLocaleString('id-ID', { maximumFractionDigits: 0 })} rb`;
    return `Rp ${amount.toLocaleString('id-ID')}`;
  };
  const byId = id => document.getElementById(id);
  const setText = (id, value) => { const element = byId(id); if (element) element.textContent = value; };
  const currentYear = new Date().getFullYear();
  const demoValues = [8500000, 11200000, 9800000, 13700000, 12100000, 15400000, 14800000, 17600000, 16300000, 18900000, 19500000, 21400000];
  const demoData = {
    income: demoValues.reduce((sum, value) => sum + value, 0), expense: 132500000,
    activities: 68, programs: 12, active_partners: 184,
    trend: demoValues.map((income, index) => ({ month: `${currentYear}-${String(index + 1).padStart(2, '0')}`, income })),
    categories: [
      { category: 'Zakat', amount: 48500000 }, { category: 'Infak', amount: 46600000 },
      { category: 'Sedekah', amount: 33700000 }, { category: 'Kemitraan', amount: 26800000 },
      { category: 'Program/Event', amount: 23600000 }
    ]
  };
  const demoPayload = {
    data: demoData, period_start: `${currentYear}-01-01`,
    period_end: new Date().toISOString().slice(0, 10), approved_at: null
  };

  const chartOptions = (showLegend = false) => ({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: showLegend, position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } } },
      tooltip: { callbacks: { label: context => `${context.dataset.label || context.label}: ${money(context.raw)}` } }
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, font: { size: 10 } } },
      y: { beginAtZero: true, ticks: { callback: compactMoney, font: { size: 10 } } }
    }
  });

  const render = (payload, demonstration = false) => {
    const item = payload.data;
    const trend = Array.isArray(item.trend) ? item.trend : [];
    const categories = Array.isArray(item.categories) && item.categories.some(row => Number(row.amount) > 0)
      ? item.categories : [{ category: 'Penerimaan umum', amount: Number(item.income || 0) }];
    const monthLabels = trend.map(row => {
      const date = new Date(`${row.month}-01T00:00:00`);
      return Number.isNaN(date.getTime()) ? row.month : date.toLocaleDateString('id-ID', { month: 'short' });
    });
    let runningTotal = 0;
    const cumulative = trend.map(row => (runningTotal += Number(row.income || 0)));
    const percentage = item.income > 0 ? Math.min(100, Math.round((Number(item.expense || 0) / Number(item.income)) * 100)) : 0;

    setText('publicActivities', item.activities || 0);
    setText('publicPrograms', item.programs || 0);
    setText('publicPartners', item.active_partners || 0);
    setText('publicIncome', money(item.income));
    setText('publicExpense', money(item.expense));
    setText('publicPercentage', `${percentage}%`);
    setText('publicPercentageKpi', `${percentage}%`);
    setText('publicPeriodBadge', demonstration ? 'Pratinjau data demonstrasi' : `${payload.period_start} — ${payload.period_end}`);
    const ring = byId('publicPercentageRing');
    if (ring) ring.style.setProperty('--percentage', `${percentage}%`);
    const badge = byId('publicDataBadge');
    if (badge) {
      badge.textContent = demonstration ? 'Data Demonstrasi' : 'Data Terverifikasi ✓';
      badge.classList.toggle('demo', demonstration);
    }
    setText('publicUpdate', demonstration
      ? 'Data demonstrasi untuk pratinjau tampilan — belum merupakan laporan resmi.'
      : `Periode ${payload.period_start} s.d. ${payload.period_end} — Disetujui ${new Date(payload.approved_at).toLocaleString('id-ID')}`);
    const empty = byId('publicEmpty');
    if (empty) empty.hidden = true;
    document.querySelectorAll('.public-kpis,.public-grid,.public-message,.update-note').forEach(element => { element.hidden = false; });

    if (!window.Chart) return;
    const barCanvas = byId('publicTrendChart');
    if (barCanvas) new Chart(barCanvas, {
      type: 'bar',
      data: { labels: monthLabels, datasets: [{ label: 'Dana terhimpun', data: trend.map(row => Number(row.income || 0)), backgroundColor: '#0798d5', borderRadius: 7, maxBarThickness: 30 }] },
      options: chartOptions(false)
    });
    const pieCanvas = byId('publicCategoryChart');
    if (pieCanvas) new Chart(pieCanvas, {
      type: 'pie',
      data: { labels: categories.map(row => row.category), datasets: [{ label: 'Penerimaan', data: categories.map(row => Number(row.amount || 0)), backgroundColor: ['#087daf','#0798d5','#f0a23a','#e5231c','#67b7d8','#83c5be'], borderColor: '#fff', borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true, font: { size: 10 } } }, tooltip: { callbacks: { label: context => `${context.label}: ${money(context.raw)}` } } } }
    });
    const lineCanvas = byId('publicLineChart');
    if (lineCanvas) new Chart(lineCanvas, {
      type: 'line',
      data: { labels: monthLabels, datasets: [{ label: 'Akumulasi dana', data: cumulative, borderColor: '#177a5b', backgroundColor: 'rgba(23,122,91,.12)', fill: true, tension: .35, pointRadius: 3, pointBackgroundColor: '#fff', pointBorderColor: '#177a5b', pointBorderWidth: 2 }] },
      options: chartOptions(false)
    });
    const sourceBarCanvas = byId('publicSourceBarChart');
    if (sourceBarCanvas) new Chart(sourceBarCanvas, {
      type: 'bar',
      data: { labels: categories.map(row => row.category), datasets: [{ label: 'Dana terhimpun', data: categories.map(row => Number(row.amount || 0)), backgroundColor: ['#087daf','#0798d5','#177a5b','#f0a23a','#8b5fbf','#e5231c'], borderRadius: 7, maxBarThickness: 28 }] },
      options: {
        ...chartOptions(false), indexAxis: 'y',
        scales: {
          x: { beginAtZero: true, ticks: { callback: compactMoney, font: { size: 10 } }, grid: { color: '#edf2f5' } },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } }
        }
      }
    });
  };

  setText('publicYear', currentYear);
  fetch('/api/public/transparency', { cache: 'no-store' })
    .then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Data belum tersedia.');
      return data;
    })
    .then(payload => {
      const data = payload.data || {};
      const hasPublishedFigures = Number(data.income || 0) > 0 || Number(data.expense || 0) > 0 ||
        Number(data.activities || 0) > 0 || Number(data.active_partners || 0) > 0;
      render(hasPublishedFigures ? payload : demoPayload, !hasPublishedFigures);
    })
    .catch(() => render(demoPayload, true));
})();
