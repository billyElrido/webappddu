'use strict';
(() => {
  const money = value => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0
  }).format(value || 0);
  const publishButton = document.createElement('button');
  publishButton.id = 'publishTransparency';
  publishButton.className = 'primary restricted';
  publishButton.type = 'button';
  publishButton.textContent = 'Review transparansi publik';
  document.querySelector('#laporan .page-title')?.append(publishButton);

  const modal = document.createElement('div');
  modal.className = 'transparency-review';
  modal.innerHTML = `
    <div class="transparency-review-card">
      <div class="review-head"><div><small>PERSETUJUAN KETUA</small><h3>Review Transparansi Publik</h3><p>Pastikan ringkasan berikut sudah sesuai sebelum ditampilkan kepada masyarakat.</p></div><button type="button" id="closeTransparencyReview" aria-label="Tutup">&times;</button></div>
      <div class="review-period" id="transparencyReviewPeriod">Memuat periode...</div>
      <div class="review-kpis">
        <article><span>Dana terhimpun</span><strong id="reviewIncome">Rp 0</strong></article>
        <article><span>Penyaluran & penggunaan</span><strong id="reviewExpense">Rp 0</strong></article>
        <article><span>Kegiatan tercatat</span><strong id="reviewActivities">0</strong></article>
        <article><span>Donatur & mitra aktif</span><strong id="reviewPartners">0</strong></article>
      </div>
      <div class="review-note"><b>Yang tidak dipublikasikan:</b> target internal, nilai realisasi, nama dan kontak donatur, saldo rekening, evaluasi, pengajuan anggaran, serta identitas petugas.</div>
      <div class="review-actions"><button type="button" class="secondary" id="editTransparencyData">Kembali & edit data</button><button type="button" class="primary" id="confirmTransparencyPublish">Publikasikan sekarang</button></div>
    </div>`;
  document.body.append(modal);
  const close = () => modal.classList.remove('show');
  document.getElementById('closeTransparencyReview').onclick = close;
  document.getElementById('editTransparencyData').onclick = close;
  modal.onclick = event => { if (event.target === modal) close(); };

  if (!document.getElementById('publicLanding')) {
    const publicLink = document.createElement('a');
    publicLink.className = 'public-dashboard-link';
    publicLink.href = '/transparansi.html';
    publicLink.textContent = 'Lihat Transparansi Publik';
    document.querySelector('.login-box .login-submit')?.insertAdjacentElement('afterend', publicLink);
  }

  publishButton.onclick = async () => {
    publishButton.disabled = true;
    publishButton.textContent = 'Menyiapkan review...';
    try {
      const preview = await api('/api/transparency/preview');
      document.getElementById('transparencyReviewPeriod').textContent = `Periode ${preview.period_start} s.d. ${preview.period_end}`;
      document.getElementById('reviewIncome').textContent = money(preview.data.income);
      document.getElementById('reviewExpense').textContent = money(preview.data.expense);
      document.getElementById('reviewActivities').textContent = preview.data.activities || 0;
      document.getElementById('reviewPartners').textContent = preview.data.active_partners || 0;
      modal.classList.add('show');
    } catch (error) { toast(error.message); }
    finally { publishButton.disabled = false; publishButton.textContent = 'Review transparansi publik'; }
  };

  document.getElementById('confirmTransparencyPublish').onclick = async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Mempublikasikan...';
    try {
      const result = await api('/api/transparency/publish', { method: 'POST', body: '{}' });
      close();
      toast(result.message);
      window.open('/transparansi.html', '_blank', 'noopener');
    } catch (error) { toast(error.message); }
    finally { button.disabled = false; button.textContent = 'Publikasikan sekarang'; }
  };

  const previousApplyUser = applyUser;
  applyUser = user => {
    previousApplyUser(user);
    publishButton.classList.toggle('restricted', user.role !== 'ketua');
  };
})();
