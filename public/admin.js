document.addEventListener('DOMContentLoaded', () => {
    const Admin = {
        elements: {
            // Navigation
            navItems: document.querySelectorAll('.admin-nav-item'),
            sections: document.querySelectorAll('.admin-section'),
            adminLink: document.getElementById('adminLink'),
            
            // Dashboard Stats
            statTotalUsers: document.getElementById('statTotalUsers'),
            statActiveUsers: document.getElementById('statActiveUsers'),
            statEmailsFound: document.getElementById('statEmailsFound'),
            statVerifications: document.getElementById('statVerifications'),
            
            // Users Table
            refreshUsers: document.getElementById('refreshUsers'),
            usersTable: document.querySelector('#usersTable tbody'),
            userSearch: document.getElementById('userSearch'),
            prevPage: document.getElementById('prevPage'),
            nextPage: document.getElementById('nextPage'),
            currentPage: document.getElementById('currentPage'),
            totalPages: document.getElementById('totalPages'),
            
            // Dashboard and Admin Panel
            dashboard: document.getElementById('dashboard'),
            adminPanel: document.getElementById('adminPanel')
        },

        state: {
            isAdmin: false,
            currentSection: 'dashboard',
            currentPage: 1,
            totalPages: 1,
            selectedUser: null,
            token: localStorage.getItem('token')
        },

        async init() {
            await this.checkAuth();
            if (this.state.isAdmin) {
                this.elements.adminLink.style.display = 'inline-block';
                this.bindEvents();
                this.updateStats();
                this.handleNavigation();
            }
        },

        async checkAuth() {
            if (!this.state.token) return;

            try {
                const response = await fetch('/api/user/role', {
                    headers: { 'Authorization': `Bearer ${this.state.token}` }
                });
                const data = await response.json();
                this.state.isAdmin = data.role === 'admin';
            } catch (error) {
                console.error('Error checking admin status:', error);
            }
        },

        bindEvents() {
            // Navigation
            window.addEventListener('hashchange', () => this.handleNavigation());
            
            // Users refresh
            this.elements.refreshUsers?.addEventListener('click', () => this.loadUsers());

            // User Search
            this.elements.userSearch?.addEventListener('input', this.debounce(() => {
                this.loadUsers(1);
            }, 300));

            // Pagination
            this.elements.prevPage?.addEventListener('click', () => {
                if (this.state.currentPage > 1) {
                    this.loadUsers(this.state.currentPage - 1);
                }
            });

            this.elements.nextPage?.addEventListener('click', () => {
                if (this.state.currentPage < this.state.totalPages) {
                    this.loadUsers(this.state.currentPage + 1);
                }
            });
        },

        handleNavigation() {
            const hash = window.location.hash;
            if (hash === '#admin' && this.state.isAdmin) {
                this.elements.dashboard.style.display = 'none';
                this.elements.adminPanel.style.display = 'block';
                this.loadUsers();
            } else if (hash === '#dashboard') {
                this.elements.dashboard.style.display = 'block';
                this.elements.adminPanel.style.display = 'none';
            }
        },

        async loadUsers(page = 1) {
            const search = this.elements.userSearch?.value || '';
            try {
                const response = await fetch('/api/admin/users', {
                    headers: { 
                        'Authorization': `Bearer ${this.state.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ page, search })
                });
                const data = await response.json();
                this.renderUsers(data.users);
                this.updatePagination(data.pagination);
            } catch (error) {
                console.error('Error loading users:', error);
                this.showNotification('error', 'Failed to load users');
            }
        },

        renderUsers(users) {
            this.elements.usersTable.innerHTML = users.map(user => `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.name || 'N/A'}</td>
                    <td>${user.email}</td>
                    <td>${user.credits}</td>
                    <td>
                        <span class="badge ${user.active ? 'badge-success' : 'badge-warning'}">
                            ${user.active ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td>
                        <button class="btn-sm btn-outline" onclick="Admin.modifyCredits(${user.id})">
                            <i class="fas fa-coins"></i>
                        </button>
                        <button class="btn-sm ${user.active ? 'btn-warning' : 'btn-success'}" 
                                onclick="Admin.toggleUserStatus(${user.id}, ${user.active})">
                            <i class="fas fa-${user.active ? 'ban' : 'check'}"></i>
                        </button>
                        <button class="btn-sm btn-info" onclick="Admin.viewHistory(${user.id})">
                            <i class="fas fa-history"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        },

        async updateStats() {
            try {
                const response = await fetch('/api/admin/stats', {
                    headers: { 'Authorization': `Bearer ${this.state.token}` }
                });
                const stats = await response.json();
                
                this.elements.statTotalUsers.textContent = stats.totalUsers;
                this.elements.statActiveUsers.textContent = stats.activeToday;
                this.elements.statEmailsFound.textContent = stats.emailsFound;
                this.elements.statVerifications.textContent = stats.verifications;
            } catch (error) {
                console.error('Error loading stats:', error);
                this.showNotification('error', 'Failed to load statistics');
            }
        },

        async modifyCredits(userId) {
            const amount = prompt('Enter credits amount (use negative to deduct):', '0');
            if (!amount) return;

            try {
                const response = await fetch(`/api/admin/users/${userId}/credits`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.state.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ amount: parseInt(amount) })
                });

                if (response.ok) {
                    this.loadUsers(this.state.currentPage);
                    this.showNotification('success', 'Credits modified successfully');
                } else {
                    throw new Error('Failed to modify credits');
                }
            } catch (error) {
                console.error('Error modifying credits:', error);
                this.showNotification('error', 'Failed to modify credits');
            }
        },

        async toggleUserStatus(userId, currentStatus) {
            try {
                const response = await fetch(`/api/admin/users/${userId}/status`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.state.token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ active: !currentStatus })
                });

                if (response.ok) {
                    this.loadUsers(this.state.currentPage);
                    this.showNotification('success', 'User status updated');
                } else {
                    throw new Error('Failed to update user status');
                }
            } catch (error) {
                console.error('Error updating user status:', error);
                this.showNotification('error', 'Failed to update user status');
            }
        },

        async viewHistory(userId) {
            try {
                const response = await fetch(`/api/admin/users/${userId}/history`, {
                    headers: { 'Authorization': `Bearer ${this.state.token}` }
                });
                const history = await response.json();
                
                // Show history in a modal
                this.showHistoryModal(history);
            } catch (error) {
                console.error('Error loading user history:', error);
                this.showNotification('error', 'Failed to load user history');
            }
        },

        showHistoryModal(history) {
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>User History</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <table class="history-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Action</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${history.map(item => `
                                    <tr>
                                        <td>${new Date(item.date).toLocaleString()}</td>
                                        <td>${item.action}</td>
                                        <td>${item.details}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            modal.querySelector('.modal-close').addEventListener('click', () => {
                modal.remove();
            });
        },

        showNotification(type, message) {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `
                <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
                <span>${message}</span>
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.classList.add('show');
            }, 100);
            
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        },

        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    };

    // Initialize Admin Panel
    Admin.init();
});