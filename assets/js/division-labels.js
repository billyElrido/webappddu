'use strict';
(() => {
  const refreshLabels = user => {
    if (user?.division_name) unitLabels[user.division] = user.division_name;
    const divisionName = displayUnit(user.division);
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    const dashboardLabel = document.getElementById('accountDashboardLabel');
    userName.title = user.name;
    userRole.textContent = divisionName;
    userRole.title = divisionName;
    dashboardLabel.textContent = divisionName;
    dashboardLabel.title = divisionName;
    document.querySelectorAll('select option').forEach(option => {
      if (unitLabels[option.value]) option.textContent = displayUnit(option.value);
    });
  };

  const previousApplyUser = applyUser;
  applyUser = user => {
    if (user.division_name) unitLabels[user.division] = user.division_name;
    previousApplyUser(user);
    const canManageUsers = ['ketua', 'sekretaris'].includes(user.role);
    document.querySelectorAll('[data-page="pengguna"]').forEach(button => {
      button.hidden = !canManageUsers;
      button.classList.toggle('restricted', !canManageUsers);
      button.setAttribute('aria-hidden', String(!canManageUsers));
    });
    document.getElementById('pengguna').classList.toggle('restricted', !canManageUsers);
    if (!canManageUsers && document.getElementById('pengguna').classList.contains('active')) navigate('dashboard');
    refreshLabels(user);
  };

  const previousLoadUsers = loadUsers;
  loadUsers = async () => {
    await previousLoadUsers();
    currentUsers.forEach(user => { unitLabels[user.division] = user.division_name || user.division; });
    refreshLabels(currentUser);
  };

  const previousRefreshDashboard = refreshSecretaryDashboard;
  refreshSecretaryDashboard = async () => {
    await previousRefreshDashboard();
    if (dashboardDivision) document.querySelector('#dashboard .hero h3').textContent = `Dashboard ${displayUnit(dashboardDivision)}`;
  };

  setInterval(async () => {
    if (!currentUser) return;
    try {
      const result = await api('/api/me');
      if (result.user && (result.user.name !== currentUser.name || result.user.division_name !== currentUser.division_name)) {
        csrfToken = result.csrf;
        applyUser(result.user);
      }
    } catch (_) {}
  }, 30000);
})();
