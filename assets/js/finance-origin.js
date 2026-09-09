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
    const originIndex = [...header.children].findIndex(cell => ['Unit', 'Asal unit/divisi'].includes(cell.textContent.trim()));
    const originHead = originIndex >= 0 ? header.children[originIndex] : null;
    if (originHead) {
      originHead.textContent = 'Asal unit/divisi';
      originHead.hidden = !allowed;
    }
    body.querySelectorAll('tr').forEach(row => {
      const originCell = originIndex >= 0 ? row.children[originIndex] : null;
      if (originCell && !originCell.classList.contains('empty-row')) originCell.hidden = !allowed;
      const empty = row.querySelector('.empty-row');
      if (empty) empty.colSpan = allowed ? 10 : 9;
    });
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
