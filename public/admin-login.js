document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('adminLoginForm');
  const emailInput = document.getElementById('adminEmail');
  const passwordInput = document.getElementById('adminPassword');
  const errorEl = document.getElementById('adminLoginError');
  const submitBtn = document.getElementById('adminLoginBtn');

  if (localStorage.getItem('adminToken')) {
    window.location.href = '/admin.html';
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.textContent = '';

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      errorEl.textContent = 'Please provide both email and password.';
      return;
    }

    toggleLoading(true);
    try {
      const response = await fetch(`${window.AppConfig.API_BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to sign in as admin.');
      }

      localStorage.setItem('adminToken', data.token);
      window.location.href = '/admin.html';
    } catch (error) {
      errorEl.textContent = error.message || 'Failed to sign in. Please try again.';
    } finally {
      toggleLoading(false);
    }
  });

  function toggleLoading(isLoading) {
    submitBtn.disabled = isLoading;
    const text = submitBtn.querySelector('.btn-text');
    const loader = submitBtn.querySelector('.loader');
    text?.classList.toggle('hidden', isLoading);
    if (loader) {
      loader.classList.toggle('hidden', !isLoading);
      loader.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    }
  }
});
