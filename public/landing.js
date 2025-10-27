/**
 * landing.js: Handles all client-side interactions for the landing page.
 * - Plan selection buttons
 * - Interactive demo
 * - Call-to-action redirects
 * - Scroll-triggered animations
 */
document.addEventListener('DOMContentLoaded', function() {
  const app = {
    elements: {
      planButtons: document.querySelectorAll('.choosePlan'),
      demoGenerateBtn: document.getElementById('demoGenerate'),
      demoDomainInput: document.getElementById('domain'),
      demoOutput: document.getElementById('demoOut'),
      ctaGetStartedBtn: document.getElementById('ctaGetStarted'),
      elementsToObserve: document.querySelectorAll('[data-observe]'),
      // Modal elements
      pricingModal: document.getElementById('pricingModal'),
      closeModalBtn: document.getElementById('closeModalBtn'),
      purchasePlanBtns: document.querySelectorAll('#pricingModal .purchase-plan-btn'),
    },

    init() {
      this.bindEvents();
      this.initScrollObserver();
    },

    bindEvents() {
      this.elements.planButtons.forEach(btn => {
        btn.addEventListener('click', this.events.handlePlanSelection.bind(this));
      });

      // Modal events
      this.elements.closeModalBtn.addEventListener('click', () => this.ui.toggleModal(false));
      this.elements.purchasePlanBtns.forEach(btn => {
        btn.addEventListener('click', this.events.handlePurchaseRedirect.bind(this));
      });

      if (this.elements.demoGenerateBtn) {
        this.elements.demoGenerateBtn.addEventListener('click', this.events.handleDemoGeneration.bind(this));
      }

      if (this.elements.ctaGetStartedBtn) {
        this.elements.ctaGetStartedBtn.addEventListener('click', this.ui.redirectToApp);
      }
    },

    initScrollObserver() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'none';
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });

      this.elements.elementsToObserve.forEach(el => observer.observe(el));
    },

    api: {
      getToken: () => localStorage.getItem('token'),
      async call(endpoint, options) {
        const token = this.getToken();
        const defaultOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        };
        const res = await fetch(endpoint, { ...defaultOptions, ...options });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'An API error occurred.');
        return json;
      },
    },

    ui: {
      redirectToApp: () => { window.location.href = '/app.html'; },
      toggleModal(show) {
        app.elements.pricingModal.classList.toggle('hidden', !show);
      },
    },

    events: {
      async handlePlanSelection(e) {
        // When a plan is clicked on the main page, just open the pricing modal
        app.ui.toggleModal(true);
      },

      handlePurchaseRedirect(e) {
        const plan = e.currentTarget.dataset.plan;
        // From the modal, any selection should redirect to the app page for login/registration.
        console.log(`User wants to purchase ${plan}. Redirecting to app...`);
        app.ui.redirectToApp();
      },

      async handleDemoGeneration() {
        const domain = app.elements.demoDomainInput.value.trim();
        if (!domain) {
          app.elements.demoOutput.innerText = 'Please enter a domain above.';
          return;
        }

        if (!app.api.getToken()) {
          // For the demo, we still redirect to the app page to log in.
          app.ui.redirectToApp();
          return;
        }

        app.elements.demoOutput.innerText = 'Generating...';
        try {
          const json = await app.api.call('/api/generate', { body: JSON.stringify({ domain }) });
          app.elements.demoOutput.innerText = JSON.stringify(json, null, 2);
        } catch (err) {
          app.elements.demoOutput.innerText = `Error: ${err.message}`;
        }
      },
    },
  };

  app.init();
});
