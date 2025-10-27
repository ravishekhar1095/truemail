/**
 * app.js: Main application logic for the truemail.io dashboard.
 * Handles authentication, API interactions, and UI updates for the app page.
 */
document.addEventListener('DOMContentLoaded', () => {
  const App = {
    elements: {
      // Main sections
      authCard: document.getElementById('authCard'),
      dashboard: document.getElementById('dashboard'),
      dashboardLink: document.getElementById('dashboardLink'),
      navUserInfo: document.getElementById('navUserInfo'),
      // Forms & Tabs
      loginForm: document.getElementById('loginForm'),
      registerForm: document.getElementById('registerForm'),
      tabButtons: document.querySelectorAll('.tab-btn'),
      // Buttons
      loginBtn: document.getElementById('loginBtn'),
      regBtn: document.getElementById('regBtn'),
      logoutBtn: document.getElementById('logoutBtn'),
      viewPlansBtn: document.getElementById('viewPlansBtn'),
      genBtn: document.getElementById('genBtn'),
      verifyBtn: document.getElementById('verifyBtn'),
      closeModalBtn: document.getElementById('closeModalBtn'),
      purchasePlanBtns: document.querySelectorAll('.purchase-plan-btn'),
      // User display
      userName: document.getElementById('userName'),
      userCredits: document.getElementById('userCredits'),
      navCredits: document.getElementById('navCredits'),
      // Inputs
      regNameInput: document.getElementById('regName'),
      regEmailInput: document.getElementById('regEmail'),
      regPasswordInput: document.getElementById('regPassword'),
      loginEmailInput: document.getElementById('loginEmail'),
      loginPasswordInput: document.getElementById('loginPassword'),
      genFirstNameInput: document.getElementById('first'),
      genLastNameInput: document.getElementById('last'),
      genDomainInput: document.getElementById('domain2'),
      verifyEmailInput: document.getElementById('email'),
      verifySmtpCheckbox: document.getElementById('smtp'),
      // Results & Status
      authStatus: document.getElementById('authStatus'),
      genResult: document.getElementById('genResult'),
      verifyResult: document.getElementById('verifyResult'),
      // Modal
      pricingModal: document.getElementById('pricingModal'),
    },

    state: {
      token: localStorage.getItem('token'),
      user: null,
    },

    init() {
      this.bindEvents();
      this.checkAuthStatus();
      this.handlers.loadHistory();
    },

    bindEvents() {
      this.elements.tabButtons.forEach(button => {
        button.addEventListener('click', () => this.ui.switchTab(button.dataset.tab));
      });
      this.elements.loginForm.addEventListener('submit', this.handlers.login.bind(this));
      this.elements.registerForm.addEventListener('submit', this.handlers.register.bind(this));
      this.elements.logoutBtn.addEventListener('click', this.handlers.logout.bind(this));
      this.elements.genBtn.addEventListener('click', this.handlers.generateEmails.bind(this));
      this.elements.verifyBtn.addEventListener('click', this.handlers.verifyEmail.bind(this));

      // Modal events
      this.elements.viewPlansBtn.addEventListener('click', () => this.ui.toggleModal(true));
      this.elements.closeModalBtn.addEventListener('click', () => this.ui.toggleModal(false));
      this.elements.purchasePlanBtns.forEach(btn => 
        btn.addEventListener('click', this.handlers.purchasePlan.bind(this))
      );
    },

    async checkAuthStatus() {
      if (this.state.token) {
        try {
          const user = await this.api.fetch('/api/me');
          this.state.user = user;
          this.ui.showDashboard(user);
        } catch (error) {
          this.state.token = null;
          localStorage.removeItem('token');
          this.ui.showAuth();
        }
      } else {
        this.ui.showAuth();
      }
    },

    api: {
      async fetch(path, options = {}, buttonId = null) {
        if (buttonId) App.ui.toggleLoading(buttonId, true);
        
        const headers = {
          'Content-Type': 'application/json',
          ...(App.state.token && { 'Authorization': `Bearer ${App.state.token}` }),
        };

        try {
          const response = await fetch(path, { ...options, headers });
          const data = await response.json();

          if (!response.ok) {
            if (response.status === 401) App.handlers.logout();
            throw new Error(data.error || 'An unknown error occurred');
          }
          return data;
        } finally {
          if (buttonId) App.ui.toggleLoading(buttonId, false);
        }
      }
    },

    ui: {
      showNotification(type, message) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
          <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'times-circle'}"></i>
          <span>${message}</span>
        `;
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after delay
        setTimeout(() => {
          notification.classList.remove('show');
          setTimeout(() => notification.remove(), 300);
        }, 3000);
      },
      
      toggleLoading(buttonId, isLoading) {
        const button = App.elements[buttonId];
        if (!button) return;
        button.disabled = isLoading;
        button.querySelector('.btn-text')?.classList.toggle('hidden', isLoading);
        button.querySelector('.loader')?.classList.toggle('hidden', !isLoading);
      },
      showError(message) {
        App.elements.authStatus.textContent = message;
      },
      clearError() {
        App.elements.authStatus.textContent = '';
      },
      updateCredits(credits) {
        App.elements.userCredits.textContent = credits;
        App.elements.navCredits.textContent = credits;
      },
      showAuth() {
        App.elements.authCard.classList.remove('hidden');
        App.elements.dashboard.classList.add('hidden');
        App.elements.dashboardLink.classList.add('hidden');
        App.elements.navUserInfo.classList.add('hidden');
      },
      showDashboard(user) {
        App.elements.authCard.classList.add('hidden');
        App.elements.dashboard.classList.remove('hidden');
        App.elements.dashboardLink.classList.remove('hidden');
        App.elements.navUserInfo.classList.remove('hidden');
        App.elements.userName.textContent = user.name || user.email;
        this.updateCredits(user.credits_left);
      },
      switchTab(tabName) {
        App.elements.tabButtons.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        App.elements.loginForm.classList.toggle('hidden', tabName !== 'login');
        App.elements.registerForm.classList.toggle('hidden', tabName !== 'register');
        this.clearError();
      },
      toggleModal(show) {
        const modal = App.elements.pricingModal;
        
        if (show) {
          modal.classList.remove('hidden');
          document.body.style.overflow = 'hidden'; // Prevent background scrolling
          
          // Click outside to close
          const closeOnOutsideClick = (e) => {
            if (e.target === modal) {
              this.toggleModal(false);
              modal.removeEventListener('click', closeOnOutsideClick);
            }
          };
          modal.addEventListener('click', closeOnOutsideClick);
          
          // ESC key to close
          const closeOnEsc = (e) => {
            if (e.key === 'Escape') {
              this.toggleModal(false);
              document.removeEventListener('keydown', closeOnEsc);
            }
          };
          document.addEventListener('keydown', closeOnEsc);
        } else {
          modal.classList.add('hidden');
          document.body.style.overflow = ''; // Restore scrolling
        }
      },
      renderResult(element, content) {
        element.innerHTML = content;
      },
      formatEmailResults(emails) {
        if (!emails || emails.length === 0) return '<p>No email patterns generated.</p>';
        return emails.map(email => `
          <div class="result-item">
            <span>${email}</span>
            <button class="btn btn-outline" onclick="navigator.clipboard.writeText('${email}')" title="Copy email">
              <i class="fas fa-copy"></i>
            </button>
          </div>`).join('');
      },
      formatVerifyResult(result) {
        return `
          <div class="verification-result">
            <div class="result-item ${result.formatValid ? 'success' : 'error'}"><span><i class="fas fa-${result.formatValid ? 'check' : 'times'}"></i> Format Valid</span></div>
            <div class="result-item ${result.mxFound ? 'success' : 'error'}"><span><i class="fas fa-${result.mxFound ? 'check' : 'times'}"></i> MX Records Found</span></div>
            ${result.smtpConnect !== null ? `<div class="result-item ${result.smtpConnect ? 'success' : 'error'}"><span><i class="fas fa-${result.smtpConnect ? 'check' : 'times'}"></i> SMTP Connection</span></div>` : ''}
            ${result.info ? `<div class="info">${result.info}</div>` : ''}
          </div>`;
      }
    },

    handlers: {
      setToken(token) {
        App.state.token = token;
        token ? localStorage.setItem('token', token) : localStorage.removeItem('token');
      },
      
      setLastOperation(type, data) {
        localStorage.setItem('lastOperation', JSON.stringify({ type, data, timestamp: Date.now() }));
      },

      getLastOperation() {
        const data = localStorage.getItem('lastOperation');
        return data ? JSON.parse(data) : null;
      },

      async register(event) {
        event.preventDefault();
        this.ui.clearError();
        const data = {
          name: this.elements.regNameInput.value,
          email: this.elements.regEmailInput.value,
          password: this.elements.regPasswordInput.value
        };
        try {
          const response = await this.api.fetch('/api/register', { method: 'POST', body: JSON.stringify(data) }, 'regBtn');
          this.handlers.setToken(response.token);
          this.ui.showDashboard(response.user);
        } catch (error) {
          this.ui.showError(error.message);
        }
      },
      async login(event) {
        event.preventDefault();
        this.ui.clearError();
        const data = {
          email: this.elements.loginEmailInput.value,
          password: this.elements.loginPasswordInput.value
        };
        try {
          const response = await this.api.fetch('/api/login', { method: 'POST', body: JSON.stringify(data) }, 'loginBtn');
          this.handlers.setToken(response.token);
          this.ui.showDashboard(response.user);
        } catch (error) {
          this.ui.showError(error.message);
        }
      },
      logout() {
        this.handlers.setToken(null);
        this.state.user = null;
        this.ui.showAuth();
      },
      async generateEmails() {
        const domain = this.elements.genDomainInput.value.trim();
        if (!domain) return alert('Please enter a domain.');
        const data = {
          first: this.elements.genFirstNameInput.value.trim(),
          last: this.elements.genLastNameInput.value.trim(),
          domain
        };
        
        // Validate inputs
        if (!data.first || !data.last) {
          this.ui.renderResult(this.elements.genResult, `<div class="error-message">Please enter both first and last name</div>`);
          return;
        }
        
        try {
          this.ui.renderResult(this.elements.genResult, `
            <div class="loader-overlay">
              <i class="fas fa-spinner fa-spin fa-2x"></i>
            </div>
          `);
          
          const response = await this.api.fetch('/api/generate', { method: 'POST', body: JSON.stringify(data) }, 'genBtn');
          
          // Store operation history
          this.handlers.setLastOperation('generate', {
            first: data.first,
            last: data.last,
            domain: data.domain,
            results: response.emails
          });
          
          this.ui.renderResult(this.elements.genResult, this.ui.formatEmailResults(response.emails));
          this.ui.updateCredits(response.credits_left);
          
          // Show success notification
          this.ui.showNotification('success', `Generated ${response.emails.length} email patterns`);
        } catch (error) {
          this.ui.renderResult(this.elements.genResult, `<div class="error-message">${error.message}</div>`);
          this.ui.showNotification('error', error.message);
        }
      },
      async verifyEmail() {
        const email = this.elements.verifyEmailInput.value.trim();
        if (!email) {
          this.ui.showNotification('error', 'Please enter an email address');
          return;
        }
        
        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          this.ui.showNotification('error', 'Please enter a valid email format');
          return;
        }
        
        const data = { email, smtp: this.elements.verifySmtpCheckbox.checked };
        
        try {
          this.ui.renderResult(this.elements.verifyResult, `
            <div class="loader-overlay">
              <i class="fas fa-spinner fa-spin fa-2x"></i>
            </div>
          `);
          
          const response = await this.api.fetch('/api/verify', { method: 'POST', body: JSON.stringify(data) }, 'verifyBtn');
          
          // Store operation history
          this.handlers.setLastOperation('verify', {
            email: email,
            smtp: data.smtp,
            result: response
          });
          
          this.ui.renderResult(this.elements.verifyResult, this.ui.formatVerifyResult(response));
          this.ui.updateCredits(response.credits_left);
          
          // Show appropriate notification
          const status = response.formatValid && response.mxFound ? 'success' : 'warning';
          const message = response.formatValid && response.mxFound ? 
            'Email verification completed successfully' : 
            'Email verification completed with some issues';
          this.ui.showNotification(status, message);
        } catch (error) {
          this.ui.renderResult(this.elements.verifyResult, `<div class="error-message">${error.message}</div>`);
          this.ui.showNotification('error', error.message);
        }
      },
      
      async loadHistory() {
        const lastOp = this.handlers.getLastOperation();
        if (lastOp && (Date.now() - lastOp.timestamp) < 3600000) { // Within last hour
          if (lastOp.type === 'generate') {
            this.elements.genFirstNameInput.value = lastOp.data.first;
            this.elements.genLastNameInput.value = lastOp.data.last;
            this.elements.genDomainInput.value = lastOp.data.domain;
          } else if (lastOp.type === 'verify') {
            this.elements.verifyEmailInput.value = lastOp.data.email;
            this.elements.verifySmtpCheckbox.checked = lastOp.data.smtp;
          }
        }
      },
      purchasePlan(e) {
        const plan = e.currentTarget.dataset.plan;
        App.ui.toggleModal(false);
        // In a real app, this would redirect to a Stripe checkout session.
        // For now, we'll just show a notification.
        App.ui.showNotification('success', `Redirecting to purchase the ${plan} plan...`);
      }
    }
  };

  App.init();
});
