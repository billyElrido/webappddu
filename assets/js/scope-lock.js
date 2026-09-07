'use strict';

(() => {
  const applyUserWithAccess = applyUser;
  applyUser = user => {
    applyUserWithAccess(user);
    const lock = select => {
      if (!select) return;
      select.innerHTML = `<option value="${user.division}">${user.division}</option>`;
      select.value = user.division;
      select.disabled = true;
      select.title = `Terkunci untuk akun ${user.division}`;
    };
    lock(document.getElementById('divisi'));
    document.querySelectorAll('.division-select').forEach(lock);
  };

  const loadTargetsWithScope = loadTargets;
  loadTargets = async () => {
    await loadTargetsWithScope();
    const ownTargets = currentReportItems.filter(item => item.division === currentUser.division && item.target_type !== 'uang');
    const weekly = document.getElementById('weeklyTarget');
    if (weekly) weekly.innerHTML = ownTargets.map(item => `<option value="${item.id}">${item.program}</option>`).join('');
    updatePrograms(ownTargets);
    document.querySelectorAll('#targetGrid .target-card').forEach((card,index) => {
      const edit = card.querySelector('.target-edit');
      if (edit && currentReportItems[index]?.division !== currentUser.division) edit.remove();
    });
  };
})();
