/**
 * auth.js: Authentication UI enhancements
 */
document.addEventListener('DOMContentLoaded', () => {
    // Password visibility toggle
    const setupPasswordToggles = () => {
        document.querySelectorAll('.password-toggle').forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const input = e.currentTarget.parentElement.querySelector('input');
                const icon = e.currentTarget.querySelector('i');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    input.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        });
    };

    // Form validation
    const setupFormValidation = () => {
        const validateEmail = (email) => {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        };

        const validatePassword = (password) => {
            return password.length >= 8;
        };

        const showInputError = (input, message) => {
            const errorDiv = input.parentElement.parentElement.querySelector('.error-message');
            if (errorDiv) {
                errorDiv.textContent = message;
            }
            input.classList.add('input-error');
        };

        const clearInputError = (input) => {
            const errorDiv = input.parentElement.parentElement.querySelector('.error-message');
            if (errorDiv) {
                errorDiv.textContent = '';
            }
            input.classList.remove('input-error');
        };

        // Real-time validation
        document.querySelectorAll('.form-input').forEach(input => {
            input.addEventListener('input', () => {
                clearInputError(input);
                
                if (input.type === 'email' && input.value) {
                    if (!validateEmail(input.value)) {
                        showInputError(input, 'Please enter a valid email address');
                    }
                }
                
                if (input.type === 'password' && input.value) {
                    if (!validatePassword(input.value)) {
                        showInputError(input, 'Password must be at least 8 characters long');
                    }
                }
            });
        });
    };

    // Form animations
    const setupFormAnimations = () => {
        const tabs = document.querySelectorAll('.tab-btn');
        const forms = document.querySelectorAll('.auth-form');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetForm = document.getElementById(`${tab.dataset.tab}Form`);
                
                forms.forEach(form => {
                    if (form === targetForm) {
                        form.style.animation = 'slideIn 0.3s forwards';
                    } else {
                        form.style.animation = 'slideOut 0.3s forwards';
                    }
                });
            });
        });
    };

    // Initialize all auth enhancements
    setupPasswordToggles();
    setupFormValidation();
    setupFormAnimations();
});