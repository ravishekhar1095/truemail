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
      heroUpgradeBtn: document.getElementById('heroUpgradeBtn'),
      focusGenerateBtn: document.getElementById('focusGenerate'),
      genBtn: document.getElementById('genBtn'),
      verifyBtn: document.getElementById('verifyBtn'),
      closeModalBtn: document.getElementById('closeModalBtn'),
      purchasePlanBtns: document.querySelectorAll('.purchase-plan-btn'),
      // User display
      userName: document.getElementById('userName'),
      userCredits: document.getElementById('userCredits'),
      navCredits: document.getElementById('navCredits'),
      dashboardSubcopy: document.getElementById('dashboardSubcopy'),
      summaryPlan: document.getElementById('summaryPlan'),
      summaryStatus: document.getElementById('summaryStatus'),
      summaryActivity: document.getElementById('summaryActivity'),
      summaryCredits: document.getElementById('summaryCredits'),
      activityTimestamp: document.getElementById('activityTimestamp'),
      activityList: document.getElementById('activityList'),
      insightsMessage: document.getElementById('insightsMessage'),
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
      verifySmtpCheckbox: document.getElementById('smtp'), // Corrected reference to match HTML
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
      lastOperation: null,
    },

    init() {
      this.state.lastOperation = this.handlers.getLastOperation();
      this.bindEvents();
      this.checkAuthStatus();
      this.ui.updateLastActivity(this.state.lastOperation);
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
      this.elements.heroUpgradeBtn?.addEventListener('click', () => this.ui.toggleModal(true));
      this.elements.focusGenerateBtn?.addEventListener('click', () => {
        const generatorCard = document.getElementById('generatorCard');
        generatorCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => this.elements.genFirstNameInput?.focus(), 280);
      });
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
          this.state.user = null;
          this.state.lastOperation = null;
          this.ui.resetDashboard();
          this.ui.showAuth();
        }
      } else {
        this.state.user = null;
        this.state.lastOperation = null;
        this.ui.resetDashboard();
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
      escapeHtml(value) {
        if (value === undefined || value === null) return '';
        return value.toString().replace(/[&<>"']/g, (match) => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[match]));
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
        const rawAmount = Number(credits ?? 0);
        const amount = Number.isFinite(rawAmount) ? rawAmount : 0;
        const formatted = amount.toLocaleString();
        App.elements.userCredits.textContent = formatted;
        App.elements.navCredits.textContent = formatted;
        if (App.state.user) {
          App.state.user.credits_left = amount;
          this.updateSummary(App.state.user);
          this.updateInsights(App.state.user);
        } else if (App.elements.summaryCredits) {
          App.elements.summaryCredits.textContent = formatted;
        }
      },
      showAuth() {
        App.elements.authCard.classList.remove('hidden');
        App.elements.dashboard.classList.add('hidden');
        App.elements.dashboardLink.classList.add('hidden');
        App.elements.navUserInfo.classList.add('hidden');
      },
      showDashboard(user) {
        App.state.user = { ...(App.state.user || {}), ...user };
        App.state.user.plan = App.state.user.plan || 'free';
        App.state.user.account_status = App.state.user.account_status || 'active';
        App.state.user.credits_left = Number(App.state.user.credits_left ?? 0);
        App.elements.authCard.classList.add('hidden');
        App.elements.dashboard.classList.remove('hidden');
        App.elements.dashboardLink.classList.remove('hidden');
        App.elements.navUserInfo.classList.remove('hidden');
        const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || user.name || user.email;
        App.elements.userName.textContent = displayName;
        this.updateCredits(App.state.user?.credits_left ?? 0);
        this.updateLastActivity(App.state.lastOperation);
      },
      updateSummary(user) {
        const defaultSubcopy = 'Keep track of the connections you discover and the emails you verify.';
        if (!user) {
          if (App.elements.summaryCredits) App.elements.summaryCredits.textContent = '0';
          if (App.elements.summaryPlan) App.elements.summaryPlan.textContent = 'Free';
          if (App.elements.summaryStatus) {
            App.elements.summaryStatus.textContent = 'Active';
            App.elements.summaryStatus.classList.remove('suspended');
          }
          if (App.elements.summaryActivity) App.elements.summaryActivity.textContent = 'No activity yet';
          if (App.elements.activityTimestamp) App.elements.activityTimestamp.textContent = 'Run your first search to see history here.';
          if (App.elements.dashboardSubcopy) App.elements.dashboardSubcopy.textContent = defaultSubcopy;
          return;
        }

        const rawCredits = Number(user.credits_left ?? 0);
        const credits = Number.isFinite(rawCredits) ? rawCredits : 0;
        if (App.elements.summaryCredits) App.elements.summaryCredits.textContent = credits.toLocaleString();

        const plan = ((user.plan && user.plan.toString()) || 'free').toLowerCase();
        if (App.elements.summaryPlan) {
          const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
          App.elements.summaryPlan.textContent = planLabel;
        }

        if (App.elements.summaryStatus) {
          const status = (user.account_status || 'active').toLowerCase();
          const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
          App.elements.summaryStatus.textContent = statusLabel;
          if (status === 'active') {
            App.elements.summaryStatus.classList.remove('suspended');
          } else {
            App.elements.summaryStatus.classList.add('suspended');
          }
        }

        if (App.elements.dashboardSubcopy) {
          let message;
          if (credits <= 1) {
            message = 'You are running low on credits. Consider upgrading before your next campaign.';
          } else if (plan === 'free') {
            message = `You have ${credits} credits ready—upgrade when you need more reach.`;
          } else {
            const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
            message = `You have ${credits} credits available on your ${planLabel} plan.`;
          }
          App.elements.dashboardSubcopy.textContent = message;
        }
      },
      updateInsights(user) {
        if (!App.elements.insightsMessage) return;
        const defaultMessage = 'You’re on the free plan—upgrade to unlock higher credit limits and CSV workflows.';
        if (!user) {
          App.elements.insightsMessage.textContent = defaultMessage;
          return;
        }

        const credits = Number(user.credits_left ?? 0);
        const plan = ((user.plan && user.plan.toString()) || 'free').toLowerCase();
        let message = defaultMessage;

        if (credits <= 1) {
          message = 'You are almost out of credits—top up or upgrade to keep your outreach running.';
        } else if (plan !== 'free') {
          const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
          message = `You’re on the ${planLabel} plan—track usage to make the most of your tier.`;
        }

        App.elements.insightsMessage.textContent = message;
      },
      updateLastActivity(activity) {
        const defaultSummary = 'No activity yet';
        const defaultTimestamp = 'Run your first search to see history here.';

        if (!activity) {
          if (App.elements.summaryActivity) App.elements.summaryActivity.textContent = defaultSummary;
          if (App.elements.activityTimestamp) App.elements.activityTimestamp.textContent = defaultTimestamp;
          if (App.elements.activityList) {
            App.elements.activityList.innerHTML = `
              <li class="activity-item empty">
                <i class="fas fa-rocket"></i>
                <div>
                  <strong>${defaultSummary}</strong>
                  <span>Generate or verify an email to populate this timeline.</span>
                </div>
              </li>
            `;
          }
          return;
        }

        const type = activity.type;
        const timestamp = new Date(activity.timestamp || Date.now());
        const formatted = `${timestamp.toLocaleDateString()} · ${timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

        let label;
        let detailText;
        let icon;

        if (type === 'generate') {
          label = 'Generated email patterns';
          icon = 'fa-magic';
          const first = activity.data?.first || '';
          const last = activity.data?.last || '';
          const domain = activity.data?.domain || '';
          const name = [first, last].filter(Boolean).join(' ').trim();
          detailText = [name, domain].filter(Boolean).join(' · ') || 'Patterns created';
        } else {
          label = 'Verified an email';
          icon = 'fa-shield-alt';
          detailText = activity.data?.email || 'Verification run';
        }

        if (App.elements.summaryActivity) App.elements.summaryActivity.textContent = label;
        if (App.elements.activityTimestamp) App.elements.activityTimestamp.textContent = formatted;

        if (App.elements.activityList) {
          const safeDetail = this.escapeHtml(detailText);
          App.elements.activityList.innerHTML = `
            <li class="activity-item">
              <i class="fas ${icon}"></i>
              <div>
                <strong>${label}</strong>
                <span>${safeDetail}</span>
              </div>
            </li>
          `;
        }
      },
      resetDashboard() {
        if (App.elements.userName) App.elements.userName.textContent = 'User';
        if (App.elements.userCredits) App.elements.userCredits.textContent = '0';
        if (App.elements.navCredits) App.elements.navCredits.textContent = '0';
        this.updateSummary(null);
        this.updateInsights(null);
        this.updateLastActivity(null);
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
        const getIcon = (isValid) => isValid ? 'fa-check success' : 'fa-times error';
        const getStatus = (value) => value === null ? 'fa-question' : getIcon(value);

        return `
          <div class="verification-result">
            <div class="result-grid">
              <div class="result-item"><span><i class="fas ${getIcon(result.formatValid)}"></i> Format</span></div>
              <div class="result-item"><span><i class="fas ${getIcon(result.domain.valid)}"></i> Domain</span></div>
              <div class="result-item"><span><i class="fas ${getIcon(result.domain.hasMX)}"></i> MX Record</span></div>
              <div class="result-item"><span><i class="fas ${getStatus(result.mailbox.exists)}"></i> Mailbox</span></div>
              <div class="result-item"><span><i class="fas ${getIcon(!result.role_based)}"></i> Not Role-Based</span></div>
              <div class="result-item"><span><i class="fas ${getStatus(result.mailbox.catch_all === false)}"></i> No Catch-All</span></div>
            </div>
            <div class="result-summary">
              <div class="score-container">
                <div class="score-label">Confidence Score</div>
                <div class="score-value">${result.score}/100</div>
              </div>
              ${result.suggestion ? `<div class="suggestion-box"><strong>Suggestion:</strong> ${result.suggestion}</div>` : ''}
              ${result.info && result.info.length > 0 ? `<div class="info-box">
                ${result.info.map(i => `<div>- ${i}</div>`).join('')}
              </div>` : ''}
            </div>
          </div>`;
      }
    },

    handlers: {
      setToken(token) {
        App.state.token = token;
        token ? localStorage.setItem('token', token) : localStorage.removeItem('token');
      },
      
      setLastOperation(type, data) {
        const payload = { type, data, timestamp: Date.now() };
        localStorage.setItem('lastOperation', JSON.stringify(payload));
        App.state.lastOperation = payload;
        App.ui.updateLastActivity(payload);
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
        this.state.lastOperation = null;
        this.ui.resetDashboard();
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
            results: [...response.valid_emails, ...response.other_patterns]
          });
          
          const all_emails = [...response.valid_emails, ...response.other_patterns];
          this.ui.renderResult(this.elements.genResult, this.ui.formatEmailResults(all_emails));
          this.ui.updateCredits(response.credits_left);
          
          // Show success notification
          const message = response.valid_emails.length > 0 ? `Found ${response.valid_emails.length} valid email(s)!` : `Generated ${all_emails.length} possible patterns.`;
          const status = response.valid_emails.length > 0 ? 'success' : 'info';
          this.ui.showNotification(status, message);
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
        
        const data = { email, deep: this.elements.verifySmtpCheckbox ? this.elements.verifySmtpCheckbox.checked : false };
        
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
            deep: data.deep,
            result: response
          });
          
          this.ui.renderResult(this.elements.verifyResult, this.ui.formatVerifyResult(response));
          this.ui.updateCredits(response.credits_left);
          
          // Show appropriate notification
          const status = response.score > 70 ? 'success' : 'warning';
          const message = response.score > 70 ? 
            'Email verification completed successfully' : 
            'Verification complete; review the results for details';
          this.ui.showNotification(status, message);
        } catch (error) {
          this.ui.renderResult(this.elements.verifyResult, `<div class="error-message">${error.message}</div>`);
          this.ui.showNotification('error', error.message);
        }
      },
      
      async loadHistory() {
        const lastOp = App.handlers.getLastOperation();
        const isFresh = lastOp && (Date.now() - lastOp.timestamp) < 3600000;

        if (isFresh) {
          if (lastOp.type === 'generate') {
            if (App.elements.genFirstNameInput) App.elements.genFirstNameInput.value = lastOp.data.first || '';
            if (App.elements.genLastNameInput) App.elements.genLastNameInput.value = lastOp.data.last || '';
            if (App.elements.genDomainInput) App.elements.genDomainInput.value = lastOp.data.domain || '';
          } else if (lastOp.type === 'verify') {
            if (App.elements.verifyEmailInput) App.elements.verifyEmailInput.value = lastOp.data.email || '';
            if (App.elements.verifySmtpCheckbox) App.elements.verifySmtpCheckbox.checked = Boolean(lastOp.data.deep);
          }
          App.state.lastOperation = lastOp;
        } else {
          App.state.lastOperation = null;
        }

        App.ui.updateLastActivity(App.state.lastOperation);
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
