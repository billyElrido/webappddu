'use strict';
(() => {
  let statusChart = null;
  const safe = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
  const achievement = item => item.range_target > 0
    ? Math.max(0, Math.round((Number(item.actual_range || 0) / Number(item.range_target)) * 100)) : 0;
  const statusOf = percentage => percentage >= 85
    ? { label: 'Tercapai', pill: 'green' }
    : percentage >= 70 ? { label: 'Hampir tercapai', pill: 'yellow' }
      : { label: 'Perlu perhatian', pill: 'red' };
  const destroyChart = canvas => {
    if (!window.Chart || !canvas || typeof Chart.getChart !== 'function') return;
    Chart.getChart(canvas)?.destroy();
  };
  window.updateSideAchievement = (percentage, targetCount, periodLabel, scopeLabel = '') => {
    const safePercentage = Math.min(100, Math.max(0, Math.round(Number(percentage || 0))));
    const title = document.getElementById('sideAchievementTitle');
    const text = document.getElementById('sideAchievementText');
    const period = document.getElementById('sideAchievementPeriod');
    const number = document.getElementById('sideAchievementPercent');
    const count = document.getElementById('sideAchievementCount');
    const bar = document.getElementById('sideAchievementBar');
    const progress = bar?.parentElement;
    const scope = scopeLabel === 'lembaga' ? 'Lembaga' : scopeLabel;
    if (title) title.textContent = scope ? `Capaian Kinerja ${scope}` : 'Capaian Kinerja Lembaga';
    if (text) text.textContent = 'Akumulasi target penghimpunan serta target program dan aktivitas.';
    if (period) period.textContent = periodLabel || 'Periode terpilih';
    if (number) number.textContent = `${safePercentage}%`;
    if (count) count.textContent = `${Number(targetCount || 0)} target aktif`;
    if (bar) {
      bar.style.width = `${safePercentage}%`;
      bar.style.background = colors(safePercentage);
    }
    if (progress) progress.setAttribute('aria-valuenow', String(safePercentage));
  };

  const renderAccountDashboard = (range, items = []) => {
    const normalized = Array.isArray(items) ? items : [];
    const count = document.getElementById('dashboardProgramCount');
    if (count) count.textContent = normalized.length;
    const period = document.getElementById('dashboardDivisionPeriod');
    if (period) period.textContent = range?.label || 'Periode terpilih';

    const rows = normalized.map(item => ({ ...item, percentage: achievement(item) }));
    const overallAchievement = rows.length
      ? Math.round(rows.reduce((sum, item) => sum + Math.min(100, item.percentage), 0) / rows.length) : 0;
    const selectedScope = dashboardDivision ? displayUnit(dashboardDivision)
      : ['ketua', 'sekretaris'].includes(currentUser?.role) || ['Bendahara', 'Administrasi'].includes(currentUser?.division)
        ? 'lembaga' : displayUnit(currentUser?.division || 'unit');
    window.updateSideAchievement(overallAchievement, rows.length, range?.label, selectedScope);
    const topRows = [...rows].sort((a, b) => b.percentage - a.percentage).slice(0, 8);
    const trendCanvas = document.getElementById('trendChart');
    if (window.Chart && trendCanvas) {
      destroyChart(trendCanvas);
      const labels = topRows.length ? topRows.map(item => item.program.length > 22 ? `${item.program.slice(0, 21)}…` : item.program) : ['Belum ada data'];
      const values = topRows.length ? topRows.map(item => item.percentage) : [0];
      new Chart(trendCanvas, {
        type: 'bar',
        data: { labels, datasets: [
          { label: 'Capaian', data: values, backgroundColor: values.map(colors), borderRadius: 7, maxBarThickness: 34 },
          { label: 'Target', data: labels.map(() => 100), type: 'line', borderColor: '#8fa39b', borderDash: [5, 5], borderWidth: 2, pointRadius: 0, fill: false }
        ] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${context.dataset.label}: ${context.raw}%` } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } }, y: { beginAtZero: true, suggestedMax: 100, ticks: { callback: value => `${value}%`, font: { size: 10 } }, grid: { color: '#edf2ef' } } } }
      });
    }

    const statusCounts = [
      rows.filter(item => item.percentage >= 85).length,
      rows.filter(item => item.percentage >= 70 && item.percentage < 85).length,
      rows.filter(item => item.percentage < 70).length
    ];
    const statusCanvas = document.getElementById('dashboardStatusChart');
    if (window.Chart && statusCanvas) {
      statusChart?.destroy();
      const hasData = statusCounts.some(Boolean);
      statusChart = new Chart(statusCanvas, {
        type: 'doughnut',
        data: { labels: hasData ? ['Tercapai', 'Hampir tercapai', 'Perlu perhatian'] : ['Belum ada data'], datasets: [{ data: hasData ? statusCounts : [1], backgroundColor: hasData ? ['#177a5b','#f0a23a','#db5b57'] : ['#dfe7e3'], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 9, usePointStyle: true, font: { size: 10 } } } } }
      });
    }

    const divisionMap = new Map();
    rows.forEach(item => {
      const current = divisionMap.get(item.division) || { total: 0, count: 0 };
      current.total += Math.min(100, item.percentage);
      current.count += 1;
      divisionMap.set(item.division, current);
    });
    const divisionBars = document.getElementById('divisionBars');
    if (divisionBars) divisionBars.innerHTML = divisionMap.size
      ? [...divisionMap.entries()].map(([division, value]) => {
        const percentage = Math.round(value.total / value.count);
        return `<div class="division-row"><span title="${safe(displayUnit(division))}">${safe(displayUnit(division))}</span><div class="bar"><i style="width:${percentage}%;background:${colors(percentage)}"></i></div><b>${percentage}%</b></div>`;
      }).join('')
      : '<div class="dashboard-empty-visual">Belum ada data capaian pada periode ini.</div>';

    const performanceRows = document.getElementById('performanceRows');
    if (performanceRows) performanceRows.innerHTML = topRows.length
      ? topRows.map(item => {
        const status = statusOf(item.percentage);
        return `<tr><td><b>${safe(item.program)}</b></td><td>${safe(displayUnit(item.division))}</td><td>${safe(formatTarget(item.range_target, item.target_type, item.unit))}</td><td>${item.percentage}%</td><td><span class="pill ${status.pill}">${status.label}</span></td></tr>`;
      }).join('')
      : '<tr><td colspan="5" class="empty-row">Belum ada program pada periode ini.</td></tr>';
  };

  const previousUpdateDashboard = updateDashboard;
  updateDashboard = (range, items = currentReportItems) => {
    previousUpdateDashboard(range, items);
    renderAccountDashboard(range, items);
  };
  renderAccountDashboard(activeRange(), []);
})();
