'use strict';
(() => {
  const canViewOrigin = () => ['ketua', 'sekretaris'].includes(currentUser?.role) ||
    ['Bendahara', 'Administrasi'].includes(currentUser?.division);

  const updateOriginColumn = () => {
    const body = document.getElementById('financeRows');
    const table = body?.closest('table');
    const header = table?.querySelector('thead tr');
    if (!body || !header) return;
    const allowed = canViewOrigin();
    let originHead = header.querySelector('[data-finance-origin]');
    if (allowed) {
      if (!originHead) {
        originHead = header.children.length >= 9 ? header.lastElementChild : document.createElement('th');
        if (!originHead.isConnected) header.append(originHead);
        originHead.dataset.financeOrigin = '1';
      }
      originHead.textContent = 'Asal unit/divisi';
    } else {
      if (!originHead && header.children.length >= 9) originHead = header.lastElementChild;
      originHead?.remove();
      body.querySelectorAll('tr').forEach(row => {
        if (row.children.length >= 9) row.lastElementChild.remove();
        const empty = row.querySelector('.empty-row');
        if (empty) empty.colSpan = 8;
      });
    }
  };

  const previousLoadFinances = loadFinances;
  loadFinances = async () => {
    await previousLoadFinances();
    updateOriginColumn();
  };

  const previousApplyUser = applyUser;
  applyUser = user => {
    previousApplyUser(user);
    setTimeout(updateOriginColumn, 0);
  };
})();
