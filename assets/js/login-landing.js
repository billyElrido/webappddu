'use strict';
(() => {
  const screen = document.getElementById('loginScreen');
  const panel = screen?.querySelector('.login-panel');
  const form = document.getElementById('loginForm');
  const email = document.getElementById('loginEmail');
  if (!screen || !panel || !form) return;

  panel.id = 'loginModal';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'loginModalTitle');
  panel.setAttribute('aria-hidden', 'true');
  form.querySelector('h2')?.setAttribute('id', 'loginModalTitle');

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'login-modal-close';
  closeButton.setAttribute('aria-label', 'Tutup jendela login');
  closeButton.innerHTML = '&times;';
  form.prepend(closeButton);

  const open = () => {
    panel.classList.add('show');
    panel.setAttribute('aria-hidden', 'false');
    document.body.classList.add('login-modal-open');
    window.setTimeout(() => email?.focus(), 80);
  };
  const close = () => {
    panel.classList.remove('show');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('login-modal-open');
  };

  document.getElementById('openLoginModal')?.addEventListener('click', open);
  screen.querySelectorAll('[data-open-login]').forEach(button => button.addEventListener('click', open));
  closeButton.addEventListener('click', close);
  panel.addEventListener('click', event => { if (event.target === panel) close(); });
  form.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel.classList.contains('show')) close();
  });
  document.getElementById('logoutBtn')?.addEventListener('click', close);
})();
