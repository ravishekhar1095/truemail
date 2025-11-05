document.addEventListener('DOMContentLoaded', () => {
  const Admin = {
    elements: {
      navItems: document.querySelectorAll('.admin-nav-item'),
      sections: document.querySelectorAll('.admin-section'),
      logoutBtn: document.getElementById('logoutBtn'),
      totalUsers: document.getElementById('totalUsers'),
      totalCredits: document.getElementById('totalCredits'),
      totalOperations: document.getElementById('totalOperations'),
      totalRevenue: document.getElementById('totalRevenue'),
      userSearch: document.getElementById('userSearch'),
      usersTable: document.getElementById('usersList'),
      prevPage: document.getElementById('prevPage'),
      nextPage: document.getElementById('nextPage'),
      currentPage: document.getElementById('currentPage'),
      totalPages: document.getElementById('totalPages')
    },

    state: {
      token: localStorage.getItem('adminToken'),
      page: 1,
      totalPages: 1,
      pageSize: 10
    },

    async init() {
      if (!this.state.token) {
        this.redirectToLogin();
        return;
      }

      try {
        const userRole = await this.authFetch('/api/user/role');
        if (!this.isElevatedRole(userRole.role)) {
          this.redirectToLogin();
          return;
        }

        this.state.profile = userRole;
        this.bindEvents();
        window.Admin = this;

        const initialSection = (window.location.hash || '#dashboard').slice(1);
        this.switchSection(initialSection);

        await Promise.all([this.loadStats(), this.loadUsers()]);
      } catch (error) {
        console.error('Unable to initialize admin panel:', error);
        this.redirectToLogin();
      }
    },

    async authFetch(url, options = {}) {
      const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${this.state.token}`
      };

      if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetch(url, { ...options, headers });

      if (response.status === 401) {
        this.logout();
        throw new Error('Unauthorized');
      }

      let data = null;
      const isJson = (response.headers.get('content-type') || '').includes('application/json');
      if (isJson) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const message = data?.error || data || 'Request failed';
        throw new Error(message);
      }

      return data;
    },

    isElevatedRole(role) {
      return role === 'admin' || role === 'super_admin';
    },

    bindEvents() {
      this.elements.navItems.forEach(item => {
        item.addEventListener('click', (event) => {
          event.preventDefault();
          const section = item.dataset.section || item.getAttribute('href')?.replace('#', '') || 'dashboard';
          this.switchSection(section);
          history.replaceState(null, '', `#${section}`);
        });
      });

      window.addEventListener('hashchange', () => {
        const section = (window.location.hash || '#dashboard').slice(1);
        this.switchSection(section);
      });

      this.elements.logoutBtn?.addEventListener('click', () => this.logout());

      if (this.elements.userSearch) {
        this.elements.userSearch.addEventListener('input', this.debounce(() => this.loadUsers(1), 300));
      }

      this.elements.prevPage?.addEventListener('click', () => {
        if (this.state.page > 1) this.loadUsers(this.state.page - 1);
      });

      this.elements.nextPage?.addEventListener('click', () => {
        if (this.state.page < this.state.totalPages) this.loadUsers(this.state.page + 1);
      });

      this.elements.usersTable?.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const userId = button.dataset.userId;
        if (!userId) return;

        switch (button.dataset.action) {
          case 'credits':
            this.promptCredits(userId);
            break;
          case 'status':
            this.toggleUserStatus(userId, button.dataset.status || 'active');
            break;
          default:
            break;
        }
      });
    },

    switchSection(section) {
      if (!section) section = 'dashboard';

      this.elements.sections.forEach(sec => {
        sec.classList.toggle('active', sec.id === section);
      });

      this.elements.navItems.forEach(item => {
        const target = item.dataset.section || item.getAttribute('href')?.replace('#', '');
        item.classList.toggle('active', target === section);
      });
    },

    async loadStats() {
      try {
        const stats = await this.authFetch('/api/admin/dashboard');
        const operations = typeof stats.totalOperations === 'number'
          ? stats.totalOperations
          : (stats.emailsFound || 0) + (stats.verifications || 0);
        const creditsUsed = typeof stats.totalCreditsUsed === 'number'
          ? stats.totalCreditsUsed
          : (stats.activeToday || 0);
        this.updateStat(this.elements.totalUsers, stats.totalUsers);
        this.updateStat(this.elements.totalCredits, creditsUsed);
        this.updateStat(this.elements.totalOperations, operations);
        this.updateStat(this.elements.totalRevenue, stats.totalRevenue);
      } catch (error) {
        console.error('Failed to load admin stats:', error);
        this.showNotification('error', 'Failed to load dashboard statistics.');
      }
    },

    updateStat(element, value) {
      if (!element) return;
      if (typeof value === 'number') {
        element.textContent = value.toLocaleString();
      } else if (value) {
        element.textContent = value;
      } else {
        element.textContent = '—';
      }
    },

    async loadUsers(page = 1) {
      const search = this.elements.userSearch?.value.trim() || '';
      const params = new URLSearchParams({
        page: String(page),
        limit: String(this.state.pageSize)
      });
      if (search) params.set('search', search);

      try {
        const data = await this.authFetch(`/api/admin/users?${params.toString()}`);
        this.state.page = data.pagination?.page || page;
        this.state.totalPages = data.pagination?.pages || 1;
        this.renderUsers(data.users || []);
        this.updatePagination(data.pagination);
      } catch (error) {
        console.error('Failed to load users:', error);
        this.showNotification('error', 'Unable to load users.');
      }
    },

    renderUsers(users = []) {
      if (!this.elements.usersTable) return;

      if (!users.length) {
        this.elements.usersTable.innerHTML = `
          <tr>
            <td colspan="6" class="empty-state">No users found.</td>
          </tr>`;
        return;
      }

      const rows = users.map(user => {
        const isActive = user.account_status ? user.account_status === 'active' : Boolean(user.active);
        const statusLabel = isActive ? 'Active' : 'Suspended';
        const currentStatus = isActive ? 'active' : 'suspended';

        return `
          <tr>
            <td>
              <div class="user-info">
                <div class="user-name">${user.name || user.username || '—'}</div>
                <div class="user-email">${user.email || '—'}</div>
              </div>
            </td>
            <td>${user.plan || 'free'}</td>
            <td>${(user.credits_left ?? user.credits ?? 0).toLocaleString()}</td>
            <td>
              <span class="badge ${isActive ? 'badge-success' : 'badge-warning'}">${statusLabel}</span>
            </td>
            <td>${user.updated_at ? new Date(user.updated_at).toLocaleDateString() : '—'}</td>
            <td class="table-actions">
              <button class="btn-sm btn-outline" data-action="credits" data-user-id="${user.id}" title="Adjust credits">
                <i class="fas fa-coins"></i>
              </button>
              <button class="btn-sm ${isActive ? 'btn-warning' : 'btn-success'}" data-action="status" data-status="${currentStatus}" data-user-id="${user.id}" title="${isActive ? 'Suspend user' : 'Activate user'}">
                <i class="fas fa-${isActive ? 'ban' : 'check'}"></i>
              </button>
            </td>
          </tr>`;
      }).join('');

      this.elements.usersTable.innerHTML = rows;
    },

    updatePagination(pagination = {}) {
      const page = pagination.page || this.state.page;
      const pages = pagination.pages || this.state.totalPages;

      if (this.elements.currentPage) {
        this.elements.currentPage.textContent = pages ? page : 0;
      }
      if (this.elements.totalPages) {
        this.elements.totalPages.textContent = pages.toString();
      }

      if (this.elements.prevPage) {
        this.elements.prevPage.disabled = page <= 1;
      }
      if (this.elements.nextPage) {
        this.elements.nextPage.disabled = page >= pages;
      }
    },

    promptCredits(userId) {
      const amount = prompt('Enter credits amount (use negative to deduct):', '0');
      if (amount === null) return;

      const parsed = Number(amount);
      if (!Number.isFinite(parsed) || parsed === 0) {
        this.showNotification('warning', 'Please enter a non-zero numeric amount.');
        return;
      }

      this.modifyUserCredits(userId, parsed);
    },

    async modifyUserCredits(userId, amount) {
      try {
        await this.authFetch(`/api/admin/users/${userId}/credits`, {
          method: 'POST',
          body: JSON.stringify({ amount })
        });
        this.showNotification('success', 'Credits updated successfully.');
        await Promise.all([this.loadUsers(this.state.page), this.loadStats()]);
      } catch (error) {
        console.error('Failed to modify credits:', error);
        this.showNotification('error', error.message || 'Failed to modify credits.');
      }
    },

    async toggleUserStatus(userId, currentStatus) {
      const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
      try {
        await this.authFetch(`/api/admin/users/${userId}/status`, {
          method: 'POST',
          body: JSON.stringify({ status: nextStatus })
        });
        this.showNotification('success', `User status updated to ${nextStatus}.`);
        await this.loadUsers(this.state.page);
      } catch (error) {
        console.error('Failed to update user status:', error);
        this.showNotification('error', error.message || 'Failed to update user status.');
      }
    },

    logout() {
      localStorage.removeItem('adminToken');
      this.redirectToLogin();
    },

    redirectToLogin() {
      window.location.href = '/admin-login.html';
    },

    showNotification(type, message) {
      if (!message) return;
      if (!this.elements.notificationContainer) {
        const container = document.createElement('div');
        container.className = 'admin-notifications';
        document.body.appendChild(container);
        this.elements.notificationContainer = container;
      }

      const note = document.createElement('div');
      note.className = `notification ${type}`;
      note.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'times-circle'}"></i>
        <span>${message}</span>
      `;

      this.elements.notificationContainer.appendChild(note);
      requestAnimationFrame(() => note.classList.add('show'));

      setTimeout(() => {
        note.classList.remove('show');
        setTimeout(() => note.remove(), 300);
      }, 3200);
    },

    debounce(func, wait = 300) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
  };

  window.Admin = Admin;
  Admin.init();
});
