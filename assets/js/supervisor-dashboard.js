'use strict';

(() => {
  let supervisorBar, supervisorPie, supervisorFinance;
  const content = document.querySelector('.content');
  const page = document.createElement('section');
  page.className = 'page supervisor-page';
  page.id = 'pengawas-dashboard';
  page.innerHTML = `
    <div class="supervisor-hero">
      <div><span>MONITORING DEWAN PENGAWAS</span><h3>Kondisi Kinerja Lembaga</h3><p>Ringkasan independen target, realisasi, dan kesehatan keuangan seluruh unit.</p></div>
      <strong id="supervisorOverall">0%</strong>
    </div>
    <div class="supervisor-kpis">
      <article class="card"><span>Target Dana Terhimpun</span><strong id="supervisorFundTarget">Rp 0</strong><small id="supervisorTargetPeriod">Target periode berjalan</small></article>
      <article class="card"><span>Realisasi Dana Terhimpun</span><strong id="supervisorFundActual">Rp 0</strong><small id="supervisorActualNote">Realisasi terhadap target</small></article>
      <article class="card"><span>Persentase Capaian Dana</span><strong id="supervisorFundAchievement">0%</strong><small>Target dibanding realisasi</small></article>
      <article class="card"><span>Program Dipantau</span><strong id="supervisorPrograms">0</strong><small>Seluruh program aktif</small></article>
      <article class="card"><span>Perlu Tindak Lanjut</span><strong id="supervisorAttention">0</strong><small>Capaian di bawah 70%</small></article>
      <article class="card"><span>Saldo Periode</span><strong id="supervisorBalance">Rp 0</strong><small>Pemasukan dikurangi kas keluar</small></article>
    </div>
    <div class="supervisor-charts">
      <article class="card"><div class="card-head"><h4>Capaian Target per Unit</h4><span class="pill blue" id="supervisorPeriod">Bulan berjalan</span></div><div class="supervisor-canvas"><canvas id="supervisorUnitChart"></canvas></div></article>
      <article class="card"><div class="card-head"><h4>Status Program</h4></div><div class="supervisor-canvas pie"><canvas id="supervisorStatusChart"></canvas></div><p class="supervisor-caption" id="supervisorStatusText"></p></article>
    </div>
    <article class="card supervisor-finance"><div class="card-head"><h4>Tren Pemasukan dan Pengeluaran</h4><span class="pill green">12 bulan terakhir</span></div><div class="supervisor-canvas finance"><canvas id="supervisorFinanceChart"></canvas></div></article>
    <article class="card table-card"><div class="card-head"><h4>Ringkasan Pengawasan per Unit</h4><small>Data hanya untuk dilihat</small></div><div class="table-wrap"><table><thead><tr><th>Unit</th><th>Program</th><th>Target Dana</th><th>Realisasi Dana</th><th>Capaian</th><th>Status</th></tr></thead><tbody id="supervisorRows"></tbody></table></div></article>`;
  content.prepend(page);

  async function loadSupervisorDashboard() {
    const selected = activeRange();
    if (!selected.from || !selected.to || selected.from > selected.to) throw Error('Pilih rentang tanggal yang valid.');
    const query = new URLSearchParams({
      date_from: selected.from, date_to: selected.to, mode: byId('period').value
    });
    const data = await api('/api/supervisor-dashboard-range?' + query.toString());
    const rupiahCompact = value => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0,notation:'compact'}).format(value||0);
    const fundTarget=data.units.reduce((sum,item)=>sum+Number(item.money_target||0),0),fundActual=data.units.reduce((sum,item)=>sum+Number(item.money_actual||0),0),fundAchievement=fundTarget?Math.round(fundActual/fundTarget*100):0;
    byId('supervisorOverall').textContent=data.summary.achievement+'%';byId('supervisorFundTarget').textContent=rupiah(fundTarget);byId('supervisorFundActual').textContent=rupiah(fundActual);byId('supervisorFundAchievement').textContent=fundAchievement+'%';byId('supervisorActualNote').textContent=fundAchievement+'% dari target dana';byId('supervisorTargetPeriod').textContent=data.period_label;byId('supervisorPrograms').textContent=data.summary.programs;byId('supervisorAttention').textContent=data.summary.attention;byId('supervisorBalance').textContent=rupiah(data.summary.balance);byId('supervisorPeriod').textContent=data.period_label;
    window.updateSideAchievement?.(data.summary.achievement,data.summary.programs,data.period_label,'lembaga');
    byId('supervisorRows').innerHTML=data.units.map(x=>`<tr><td><b>${escapeHtml(x.division)}</b></td><td>${x.programs}</td><td>${rupiah(x.money_target)}</td><td>${rupiah(x.money_actual)}</td><td><b>${x.achievement}%</b></td><td><span class="pill ${x.achievement>=85?'green':x.achievement>=70?'yellow':'red'}">${x.achievement>=85?'Baik':x.achievement>=70?'Hampir':'Perlu perhatian'}</span></td></tr>`).join('');
    if(!window.Chart)return;supervisorBar?.destroy();supervisorPie?.destroy();supervisorFinance?.destroy();
    supervisorBar=new Chart(byId('supervisorUnitChart'),{type:'bar',data:{labels:data.units.map(x=>x.division),datasets:[{label:'Capaian (%)',data:data.units.map(x=>x.achievement),backgroundColor:data.units.map(x=>x.achievement>=85?'#087daf':x.achievement>=70?'#f0a23a':'#e5231c'),borderRadius:9}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,suggestedMax:100,ticks:{callback:v=>v+'%'}},x:{grid:{display:false}}}}});
    supervisorPie=new Chart(byId('supervisorStatusChart'),{type:'doughnut',data:{labels:['Tercapai','Hampir','Perlu perhatian'],datasets:[{data:[data.summary.achieved,data.summary.near,data.summary.attention],backgroundColor:['#087daf','#f0a23a','#e5231c'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'66%',plugins:{legend:{position:'bottom'}}}});byId('supervisorStatusText').textContent=`${data.summary.achieved} tercapai · ${data.summary.near} hampir · ${data.summary.attention} perlu perhatian`;
    supervisorFinance=new Chart(byId('supervisorFinanceChart'),{type:'line',data:{labels:data.finance_trend.map(x=>x.month),datasets:[{label:'Pemasukan',data:data.finance_trend.map(x=>x.income),borderColor:'#087daf',backgroundColor:'rgba(8,125,175,.12)',fill:true,tension:.35},{label:'Pengeluaran kas',data:data.finance_trend.map(x=>x.expense),borderColor:'#e5231c',backgroundColor:'transparent',tension:.35}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:{y:{beginAtZero:true,ticks:{callback:rupiahCompact}},x:{grid:{display:false}}}}});
  }
  window.refreshSupervisorDashboard=loadSupervisorDashboard;
  const applyUserBeforeSupervisor=applyUser;applyUser=user=>{applyUserBeforeSupervisor(user);const yes=user.role==='pengawas';document.querySelectorAll('.nav button,.bottom-nav button').forEach(x=>x.classList.toggle('restricted',yes));if(yes){document.querySelectorAll('.content>.page').forEach(x=>x.classList.remove('active'));page.classList.add('active');document.querySelector('.top-left h2').textContent='Dashboard Pengawasan';byId('accountDashboardLabel').textContent='Dewan Pengawas · Mode lihat saja'}else page.classList.remove('active')};
  const applySupervisorPeriodUser = applyUser;
  applyUser = user => {
    applySupervisorPeriodUser(user);
    const supervisor = user.role === 'pengawas';
    document.body.classList.toggle('supervisor-session', supervisor);
    if (!supervisor) return;
    byId('period').onchange = () => {
      const mode = byId('period').value;
      const custom = mode === 'custom';
      const years = mode === 'years';
      byId('dateRange').classList.toggle('show', custom);
      byId('yearRange').classList.toggle('show', years);
      if (custom) {
        if (!byId('globalDateFrom').value) byId('globalDateFrom').value = monday();
        if (!byId('globalDateTo').value) byId('globalDateTo').value = today();
        return;
      }
      if (years) return;
      loadSupervisorDashboard().catch(error => toast(error.message));
    };
    byId('applyRange').onclick = () => loadSupervisorDashboard()
      .then(() => toast('Rentang data pengawasan berhasil diterapkan.'))
      .catch(error => toast(error.message));
    byId('applyYearRange').onclick = () => {
      const first = Number(byId('globalYearFrom').value), last = Number(byId('globalYearTo').value);
      if (!first || !last || first > last) return toast('Tahun awal tidak boleh melebihi tahun akhir.');
      loadSupervisorDashboard()
        .then(() => toast('Rentang tahun pengawasan berhasil diterapkan.'))
        .catch(error => toast(error.message));
    };
  };
  const loadWorkspaceBeforeSupervisor=loadWorkspace;loadWorkspace=()=>{if(currentUser?.role==='pengawas')loadSupervisorDashboard().catch(e=>toast(e.message));else loadWorkspaceBeforeSupervisor()};
})();
