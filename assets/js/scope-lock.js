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
    updatePrograms(ownTargets);
    const canManageAllTargets = ['ketua', 'sekretaris'].includes(currentUser.role);
    document.querySelectorAll('#targetGrid .target-card').forEach(card => {
      const edit = card.querySelector('.target-edit');
      const target = edit && currentReportItems.find(item => Number(item.id) === Number(edit.dataset.editTarget));
      if (edit && (!target || (!canManageAllTargets && target.division !== currentUser.division))) edit.remove();
    });
  };
})();
