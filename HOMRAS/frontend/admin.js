/**
 * HOMRAS - ადმინისტრაციის პანელის JavaScript
 * 
 * ფაილი: frontend/admin.js
 * დანიშნულება: ადმინ პანელის ფუნქციონალის მართვა
 */

document.addEventListener('DOMContentLoaded', function() {
    // ელემენტების შერჩევა
    const elements = {
        // ავთენტიფიკაცია
        loginForm: document.getElementById('adminLoginForm'),
        loginEmail: document.getElementById('adminEmail'),
        loginPassword: document.getElementById('adminPassword'),
        loginBtn: document.getElementById('adminLoginBtn'),
        logoutBtn: document.getElementById('adminLogoutBtn'),
        
        // დეშბორდის სექციები
        loginSection: document.getElementById('adminLoginSection'),
        dashboardSection: document.getElementById('adminDashboardSection'),
        
        // სტატისტიკა
        totalUsers: document.getElementById('totalUsers'),
        totalJobs: document.getElementById('totalJobs'),
        totalHandymen: document.getElementById('totalHandymen'),
        totalRevenue: document.getElementById('totalRevenue'),
        
        // ცხრილები
        usersTableBody: document.getElementById('usersTableBody'),
        jobsTableBody: document.getElementById('jobsTableBody'),
        reviewsTableBody: document.getElementById('reviewsTableBody'),
        
        // ჩანართები
        tabs: document.querySelectorAll('.admin-tab'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // ძიება და ფილტრები
        searchUsers: document.getElementById('searchUsers'),
        searchJobs: document.getElementById('searchJobs'),
        filterUserRole: document.getElementById('filterUserRole'),
        filterJobStatus: document.getElementById('filterJobStatus'),
        
        // განახლების ღილაკები
        refreshUsers: document.getElementById('refreshUsers'),
        refreshJobs: document.getElementById('refreshJobs'),
        refreshStats: document.getElementById('refreshStats'),
        
        // ჩატვირთვის ინდიკატორი
        loadingIndicator: document.getElementById('adminLoading')
    };

    // გლობალური ცვლადები
    let adminToken = localStorage.getItem('homras_admin_token');
    let adminUser = JSON.parse(localStorage.getItem('homras_admin_user') || 'null');
    let currentTab = 'dashboard';

    // ინიციალიზაცია
    initAdminPanel();

    // ძირითადი ფუნქციები
    function initAdminPanel() {
        checkAdminAuth();
        setupEventListeners();
        
        // URL-დან ტაბის შემოწმება
        const hash = window.location.hash.substring(1);
        if (hash) {
            switchTab(hash);
        }
    }

    // ავთენტიფიკაციის შემოწმება
    function checkAdminAuth() {
        if (adminToken && adminUser) {
            // მოწმდება ტოკენის მართებულობა
            if (validateAdminToken(adminToken)) {
                showDashboard();
                loadAdminData();
            } else {
                showLogin();
                showNotification('სესიის ვადა გაუვიდა. გთხოვთ შეხვიდეთ თავიდან.', 'warning');
                clearAdminAuth();
            }
        } else {
            showLogin();
        }
    }

    // ევენტ ლისენერების დაყენება
    function setupEventListeners() {
        // ავთენტიფიკაცია
        if (elements.loginForm) {
            elements.loginForm.addEventListener('submit', handleAdminLogin);
        }
        
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', handleAdminLogout);
        }
        
        // ჩანართები
        elements.tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const tabId = this.getAttribute('data-tab');
                switchTab(tabId);
            });
        });
        
        // ძიება და ფილტრები
        if (elements.searchUsers) {
            elements.searchUsers.addEventListener('input', debounce(searchUsers, 300));
        }
        
        if (elements.searchJobs) {
            elements.searchJobs.addEventListener('input', debounce(searchJobs, 300));
        }
        
        if (elements.filterUserRole) {
            elements.filterUserRole.addEventListener('change', filterUsers);
        }
        
        if (elements.filterJobStatus) {
            elements.filterJobStatus.addEventListener('change', filterJobs);
        }
        
        // განახლების ღილაკები
        if (elements.refreshUsers) {
            elements.refreshUsers.addEventListener('click', loadUsers);
        }
        
        if (elements.refreshJobs) {
            elements.refreshJobs.addEventListener('click', loadJobs);
        }
        
        if (elements.refreshStats) {
            elements.refreshStats.addEventListener('click', loadStats);
        }
        
        // კლავიატურის მალსახმობები
        document.addEventListener('keydown', handleAdminShortcuts);
        
        // კვლავ კავშირის მონიტორინგი
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOfflineStatus);
    }

    // ადმინის შესვლა
    async function handleAdminLogin(e) {
        e.preventDefault();
        
        const email = elements.loginEmail.value;
        const password = elements.loginPassword.value;
        
        if (!email || !password) {
            showNotification('გთხოვთ შეავსოთ ყველა ველი', 'error');
            return;
        }
        
        showLoading(true);
        
        try {
            const response = await fetch(`${API_BASE_URL}/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // წარმატებული შესვლა
                adminUser = data.admin;
                adminToken = data.token;
                
                localStorage.setItem('homras_admin_user', JSON.stringify(adminUser));
                localStorage.setItem('homras_admin_token', adminToken);
                
                showNotification('წარმატებით შეხვედით ადმინ პანელში!', 'success');
                showDashboard();
                loadAdminData();
            } else {
                throw new Error(data.message || 'ავთენტიფიკაციის შეცდომა');
            }
        } catch (error) {
            showNotification(error.message || 'დაფიქსირდა შეცდომა', 'error');
            console.error('Admin login error:', error);
        } finally {
            showLoading(false);
            elements.loginForm.reset();
        }
    }

    // ადმინის გამოსვლა
    function handleAdminLogout() {
        if (confirm('დარწმუნებული ხართ, რომ გსურთ გამოსვლა?')) {
            clearAdminAuth();
            showLogin();
            showNotification('თქვენ გამოხვედით ადმინ პანელიდან', 'info');
        }
    }

    // ადმინის ავთენტიფიკაციის გასუფთავება
    function clearAdminAuth() {
        localStorage.removeItem('homras_admin_user');
        localStorage.removeItem('homras_admin_token');
        adminUser = null;
        adminToken = null;
    }

    // ტოკენის ვალიდაცია
    function validateAdminToken(token) {
        try {
            // მარტივი ვალიდაცია
            if (!token) return false;
            
            const parts = token.split('.');
            if (parts.length !== 3) return false;
            
            // ვადის შემოწმება
            const payload = JSON.parse(atob(parts[1]));
            if (payload.exp && Date.now() >= payload.exp * 1000) {
                return false;
            }
            
            // შეამოწმეთ როლი
            if (payload.role !== 'admin') {
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Token validation error:', error);
            return false;
        }
    }

    // ჩვენება/დამალვა
    function showLogin() {
        if (elements.loginSection) elements.loginSection.style.display = 'block';
        if (elements.dashboardSection) elements.dashboardSection.style.display = 'none';
    }

    function showDashboard() {
        if (elements.loginSection) elements.loginSection.style.display = 'none';
        if (elements.dashboardSection) elements.dashboardSection.style.display = 'block';
    }

    function showLoading(show) {
        if (elements.loadingIndicator) {
            elements.loadingIndicator.style.display = show ? 'block' : 'none';
        }
    }

    // ჩანართების გადართვა
    function switchTab(tabId) {
        currentTab = tabId;
        
        // ჩანართების აქტივაცია
        elements.tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === tabId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // კონტენტის ჩვენება
        elements.tabContents.forEach(content => {
            if (content.id === `${tabId}Tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
        
        // URL განახლება
        window.location.hash = tabId;
        
        // მონაცემების ჩატვირთვა
        switch(tabId) {
            case 'users':
                loadUsers();
                break;
            case 'jobs':
                loadJobs();
                break;
            case 'reviews':
                loadReviews();
                break;
            case 'dashboard':
                loadStats();
                break;
        }
    }

    // ადმინის მონაცემების ჩატვირთვა
    async function loadAdminData() {
        showLoading(true);
        
        try {
            await Promise.all([
                loadStats(),
                loadUsers(),
                loadJobs(),
                loadReviews()
            ]);
        } catch (error) {
            console.error('Error loading admin data:', error);
            showNotification('მონაცემების ჩატვირთვის შეცდომა', 'error');
        } finally {
            showLoading(false);
        }
    }

    // სტატისტიკის ჩატვირთვა
    async function loadStats() {
        try {
            const response = await makeAdminRequest(`${API_BASE_URL}/admin/stats`);
            const data = await response.json();
            
            if (data.success) {
                updateStats(data.stats);
            } else {
                throw new Error(data.message || 'სტატისტიკის ჩატვირთვის შეცდომა');
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            showNotification('სტატისტიკის ჩატვირთვის შეცდომა', 'error');
        }
    }

    function updateStats(stats) {
        if (elements.totalUsers) {
            elements.totalUsers.textContent = stats.totalUsers || 0;
        }
        
        if (elements.totalJobs) {
            elements.totalJobs.textContent = stats.totalJobs || 0;
        }
        
        if (elements.totalHandymen) {
            elements.totalHandymen.textContent = stats.totalHandymen || 0;
        }
        
        if (elements.totalRevenue) {
            elements.totalRevenue.textContent = (stats.totalRevenue || 0).toFixed(2) + ' ₾';
        }
        
        // ჩარტის განახლება (თუ არსებობს)
        updateCharts(stats);
    }

    // მომხმარებლების ჩატვირთვა
    async function loadUsers() {
        try {
            const response = await makeAdminRequest(`${API_BASE_URL}/admin/users`);
            const data = await response.json();
            
            if (data.success) {
                displayUsers(data.users);
            } else {
                throw new Error(data.message || 'მომხმარებლების ჩატვირთვის შეცდომა');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            showNotification('მომხმარებლების ჩატვირთვის შეცდომა', 'error');
        }
    }

    function displayUsers(users) {
        if (!elements.usersTableBody) return;
        
        if (!users || users.length === 0) {
            elements.usersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">მომხმარებლები ვერ მოიძებნა</td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        
        users.forEach(user => {
            const roleBadge = user.role === 'admin' ? 'badge-danger' :
                            user.role === 'handyman' ? 'badge-success' :
                            'badge-primary';
            
            const statusBadge = user.isActive ? 'badge-success' : 'badge-secondary';
            const statusText = user.isActive ? 'აქტიური' : 'დაბლოკილი';
            
            html += `
                <tr>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${user.phone || '-'}</td>
                    <td>
                        <span class="badge ${roleBadge}">${user.role}</span>
                    </td>
                    <td>
                        <span class="badge ${statusBadge}">${statusText}</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline btn-edit-user" data-user-id="${user._id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline btn-toggle-user" data-user-id="${user._id}" data-active="${user.isActive}">
                            <i class="fas ${user.isActive ? 'fa-lock' : 'fa-unlock'}"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        elements.usersTableBody.innerHTML = html;
        
        // დამატებითი ღილაკების მოსმენა
        attachUserActions();
    }

    // სამუშაოების ჩატვირთვა
    async function loadJobs() {
        try {
            const response = await makeAdminRequest(`${API_BASE_URL}/admin/jobs`);
            const data = await response.json();
            
            if (data.success) {
                displayJobs(data.jobs);
            } else {
                throw new Error(data.message || 'სამუშაოების ჩატვირთვის შეცდომა');
            }
        } catch (error) {
            console.error('Error loading jobs:', error);
            showNotification('სამუშაოების ჩატვირთვის შეცდომა', 'error');
        }
    }

    function displayJobs(jobs) {
        if (!elements.jobsTableBody) return;
        
        if (!jobs || jobs.length === 0) {
            elements.jobsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">სამუშაოები ვერ მოიძებნა</td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        
        jobs.forEach(job => {
            const statusBadge = job.status === 'open' ? 'badge-success' :
                              job.status === 'in_progress' ? 'badge-warning' :
                              job.status === 'completed' ? 'badge-info' :
                              'badge-secondary';
            
            const statusText = job.status === 'open' ? 'ღია' :
                             job.status === 'in_progress' ? 'მიმდინარე' :
                             job.status === 'completed' ? 'დასრულებული' :
                             'გაუქმებული';
            
            const categoryNames = {
                plumbing: 'სანტექნიკა',
                electrical: 'ელექტრიკა',
                repair: 'რემონტი',
                cleaning: 'დასუფთავება'
            };
            
            html += `
                <tr>
                    <td>${job.title}</td>
                    <td>${categoryNames[job.category] || job.category}</td>
                    <td>${job.customer?.name || 'Unknown'}</td>
                    <td>${job.budget ? job.budget + ' ₾' : 'შეთანხმებით'}</td>
                    <td>
                        <span class="badge ${statusBadge}">${statusText}</span>
                    </td>
                    <td>${new Date(job.createdAt).toLocaleDateString('ka-GE')}</td>
                    <td>
                        <button class="btn btn-sm btn-outline btn-view-job" data-job-id="${job._id}">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline btn-edit-job" data-job-id="${job._id}">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        elements.jobsTableBody.innerHTML = html;
        
        // დამატებითი ღილაკების მოსმენა
        attachJobActions();
    }

    // შეფასებების ჩატვირთვა
    async function loadReviews() {
        try {
            const response = await makeAdminRequest(`${API_BASE_URL}/admin/reviews`);
            const data = await response.json();
            
            if (data.success) {
                displayReviews(data.reviews);
            } else {
                throw new Error(data.message || 'შეფასებების ჩატვირთვის შეცდომა');
            }
        } catch (error) {
            console.error('Error loading reviews:', error);
            showNotification('შეფასებების ჩატვირთვის შეცდომა', 'error');
        }
    }

    function displayReviews(reviews) {
        if (!elements.reviewsTableBody) return;
        
        if (!reviews || reviews.length === 0) {
            elements.reviewsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center">შეფასებები ვერ მოიძებნა</td>
                </tr>
            `;
            return;
        }
        
        let html = '';
        
        reviews.forEach(review => {
            const ratingStars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            
            html += `
                <tr>
                    <td>${review.job?.title || 'N/A'}</td>
                    <td>${review.customer?.name || 'Unknown'}</td>
                    <td>${review.handyman?.name || 'Unknown'}</td>
                    <td>
                        <span class="rating-stars" title="${review.rating} ვარსკვლავი">
                            ${ratingStars}
                        </span>
                    </td>
                    <td>${review.comment || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline btn-delete-review" data-review-id="${review._id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        elements.reviewsTableBody.innerHTML = html;
        
        // დამატებითი ღილაკების მოსმენა
        attachReviewActions();
    }

    // მომხმარებლის ქმედებების დამატება
    function attachUserActions() {
        // რედაქტირება
        document.querySelectorAll('.btn-edit-user').forEach(btn => {
            btn.addEventListener('click', function() {
                const userId = this.getAttribute('data-user-id');
                editUser(userId);
            });
        });
        
        // აქტივობის შეცვლა
        document.querySelectorAll('.btn-toggle-user').forEach(btn => {
            btn.addEventListener('click', function() {
                const userId = this.getAttribute('data-user-id');
                const isActive = this.getAttribute('data-active') === 'true';
                toggleUserStatus(userId, !isActive);
            });
        });
    }

    // სამუშაოს ქმედებების დამატება
    function attachJobActions() {
        // ნახვა
        document.querySelectorAll('.btn-view-job').forEach(btn => {
            btn.addEventListener('click', function() {
                const jobId = this.getAttribute('data-job-id');
                viewJobDetails(jobId);
            });
        });
        
        // რედაქტირება
        document.querySelectorAll('.btn-edit-job').forEach(btn => {
            btn.addEventListener('click', function() {
                const jobId = this.getAttribute('data-job-id');
                editJob(jobId);
            });
        });
    }

    // შეფასების ქმედებების დამატება
    function attachReviewActions() {
        // წაშლა
        document.querySelectorAll('.btn-delete-review').forEach(btn => {
            btn.addEventListener('click', function() {
                const reviewId = this.getAttribute('data-review-id');
                deleteReview(reviewId);
            });
        });
    }

    // მომხმარებლის რედაქტირება
    async function editUser(userId) {
        try {
            const response = await makeAdminRequest(`${API_BASE_URL}/admin/users/${userId}`);
            const data = await response.json();
            
            if (data.success) {
                showUserEditModal(data.user);
            } else {
                throw new Error(data.message || 'მომხმარებლის მონაცემების ჩატვირთვის შეცდომა');
            }
        } catch (error) {
            console.error('Error loading user details:', error);
            showNotification('დაფიქსირდა შეცდომა', 'error');
        }
    }

    // მომხმარებლის სტატუსის შეცვლა
    async function toggleUserStatus(userId, newStatus) {
        if (!confirm(`დარწმუნებული ხართ, რომ გსურთ ${newStatus ? 'გააქტიუროთ' : 'დაბლოკოთ'} ეს მომხმარებელი?`)) {
            return;
        }
        
        try {
            const response = await makeAdminRequest(`${API_BASE_URL}/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isActive: newStatus })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification(`მომხმარებელი წარმატებით ${newStatus ? 'გააქტიურდა' : 'დაბლოკილი იქნა'}!`, 'success');
                loadUsers();
            } else {
                throw new Error(data.message || 'სტატუსის შეცვლის შეცდომა');
            }
        } catch (error) {
            console.error('Error toggling user status:', error);
            showNotification('დაფიქსირდა შეცდომა', 'error');
        }
    }

    // სამუშაოს დეტალების ნახვა
    async function viewJobDetails(jobId) {
        try {
            const response = await makeAdminRequest(`${API_BASE_URL}/admin/jobs/${jobId}`);
            const data = await response.json();
            
            if (data.success) {
                showJobDetailModal(data.job);
            } else {
                throw new Error(data.message || 'სამუშაოს დეტალების ჩატვირთვის შეცდომა');
            }
        } catch (error) {
            console.error('Error loading job details:', error);
            showNotification('დაფიქსირდა შეცდომა', 'error');
        }
    }

    // სამუშაოს რედაქტირება
    async function editJob(jobId) {
        try {
            const response = await makeAdminRequest(`${API_BASE_URL}/admin/jobs/${jobId}`);
            const data = await response.json();
            
            if (data.success) {
                showJobEditModal(data.job);
            } else {
                throw new Error(data.message || 'სამუშაოს მონაცემების ჩატვირთვის შეცდომა');
            }
        } catch (error) {
            console.error('Error loading job details:', error);
            showNotification('დაფიქსირდა შეცდომა', 'error');
        }
    }

    // შეფასების წაშლა
    async function deleteReview(reviewId) {
        if (!confirm('დარწმუნებული ხართ, რომ გსურთ ამ შეფასების წაშლა?')) {
            return;
        }
        
        try {
            const response = await makeAdminRequest(`${API_BASE_URL}/admin/reviews/${reviewId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('შეფასება წარმატებით წაიშალა!', 'success');
                loadReviews();
            } else {
                throw new Error(data.message || 'შეფასების წაშლის შეცდომა');
            }
        } catch (error) {
            console.error('Error deleting review:', error);
            showNotification('დაფიქსირდა შეცდომა', 'error');
        }
    }

    // ძიება მომხმარებლებში
    async function searchUsers() {
        const query = elements.searchUsers.value;
        
        try {
            const response = await makeAdminRequest(`${API_BASE_URL}/admin/users?search=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.success) {
                displayUsers(data.users);
            }
        } catch (error) {
            console.error('Error searching users:', error);
        }
    }

    // ძიება სამუშაოებში
    async function searchJobs() {
        const query = elements.searchJobs.value;
        
        try {
            const response = await makeAdminRequest(`${API_BASE_URL}/admin/jobs?search=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (data.success) {
                displayJobs(data.jobs);
            }
        } catch (error) {
            console.error('Error searching jobs:', error);
        }
    }

    // მომხმარებლების ფილტრაცია
    async function filterUsers() {
        const role = elements.filterUserRole.value;
        
        try {
            const url = role === 'all' 
                ? `${API_BASE_URL}/admin/users`
                : `${API_BASE_URL}/admin/users?role=${role}`;
            
            const response = await makeAdminRequest(url);
            const data = await response.json();
            
            if (data.success) {
                displayUsers(data.users);
            }
        } catch (error) {
            console.error('Error filtering users:', error);
        }
    }

    // სამუშაოების ფილტრაცია
    async function filterJobs() {
        const status = elements.filterJobStatus.value;
        
        try {
            const url = status === 'all'
                ? `${API_BASE_URL}/admin/jobs`
                : `${API_BASE_URL}/admin/jobs?status=${status}`;
            
            const response = await makeAdminRequest(url);
            const data = await response.json();
            
            if (data.success) {
                displayJobs(data.jobs);
            }
        } catch (error) {
            console.error('Error filtering jobs:', error);
        }
    }

    // დამახსოვრებული მოთხოვნა ადმინისთვის
    async function makeAdminRequest(url, options = {}) {
        if (!adminToken) {
            throw new Error('არასწორი ავთენტიფიკაცია');
        }
        
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            }
        };
        
        const mergedOptions = { ...defaultOptions, ...options };
        
        const response = await fetch(url, mergedOptions);
        
        if (response.status === 401) {
            clearAdminAuth();
            showLogin();
            showNotification('სესიის ვადა გაუვიდა. გთხოვთ შეხვიდეთ თავიდან.', 'warning');
            throw new Error('Session expired');
        }
        
        return response;
    }

    // დებაუნსი ფუნქცია
    function debounce(func, wait) {
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

    // კლავიატურის მალსახმობები
    function handleAdminShortcuts(e) {
        // Ctrl + Shift + [ნომერი] - ჩანართების გადართვა
        if (e.ctrlKey && e.shiftKey && e.key >= '1' && e.key <= '4') {
            e.preventDefault();
            const tabIndex = parseInt(e.key) - 1;
            const tabs = Array.from(elements.tabs);
            if (tabs[tabIndex]) {
                tabs[tabIndex].click();
            }
        }
        
        // Ctrl + R - განახლება
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            loadAdminData();
            showNotification('განახლება...', 'info');
        }
        
        // Ctrl + L - გამოსვლა
        if (e.ctrlKey && e.key === 'l') {
            e.preventDefault();
            handleAdminLogout();
        }
        
        // Esc - მოდალის დახურვა
        if (e.key === 'Escape') {
            const modal = document.querySelector('.modal.active');
            if (modal) {
                modal.remove();
            }
        }
    }

    // ქსელის სტატუსის მონიტორინგი
    function handleOnlineStatus() {
        showNotification('ინტერნეტთან კავშირი აღდგენილია', 'success');
        loadAdminData();
    }

    function handleOfflineStatus() {
        showNotification('ინტერნეტთან კავშირი დაკარგულია', 'warning');
    }

    // ჩარტების განახლება
    function updateCharts(stats) {
        // ეს ფუნქცია განახლებს ჩარტებს, თუ ისინი არსებობს
        // მარტივი იმპლემენტაცია Chart.js ან მსგავსი ბიბლიოთეკის გამოყენებით
        console.log('Updating charts with stats:', stats);
        
        // TODO: დაამატეთ ჩარტების იმპლემენტაცია
    }

    // შეტყობინების სისტემა
    function showNotification(message, type = 'info') {
        // იგივე შეტყობინების სისტემა, როგორც მთავარ საიტზე
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
        } else {
            // ფოლბექი
            alert(`${type.toUpperCase()}: ${message}`);
        }
    }

    // მოდალების ფუნქციები
    function showUserEditModal(user) {
        // TODO: დაამატეთ მომხმარებლის რედაქტირების მოდალი
        console.log('Edit user:', user);
        showNotification('მომხმარებლის რედაქტირების ფუნქციონალი მალე დაემატება', 'info');
    }

    function showJobDetailModal(job) {
        // TODO: დაამატეთ სამუშაოს დეტალების მოდალი
        console.log('View job details:', job);
        showNotification('სამუშაოს დეტალების ფუნქციონალი მალე დაემატება', 'info');
    }

    function showJobEditModal(job) {
        // TODO: დაამატეთ სამუშაოს რედაქტირების მოდალი
        console.log('Edit job:', job);
        showNotification('სამუშაოს რედაქტირების ფუნქციონალი მალე დაემატება', 'info');
    }

    // გლობალური ექსპორტი
    window.adminPanel = {
        login: () => {
            if (elements.loginEmail) elements.loginEmail.focus();
        },
        logout: handleAdminLogout,
        refresh: loadAdminData,
        switchTab: switchTab,
        currentUser: () => adminUser
    };
});

// დამატებითი CSS სტილები ადმინ პანელისთვის
const adminStyles = `
    /* ადმინის სპეციფიკური სტილები */
    .admin-login-section {
        max-width: 400px;
        margin: 100px auto;
        padding: 30px;
        background: white;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.1);
    }
    
    .admin-dashboard {
        padding: 20px;
    }
    
    .admin-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 30px;
        padding-bottom: 20px;
        border-bottom: 1px solid #eaeaea;
    }
    
    .admin-nav {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        border-bottom: 1px solid #eaeaea;
    }
    
    .admin-tab {
        padding: 10px 20px;
        background: none;
        border: none;
        border-bottom: 3px solid transparent;
        cursor: pointer;
        font-weight: 500;
        color: #666;
        transition: all 0.3s;
    }
    
    .admin-tab:hover {
        color: #4361ee;
    }
    
    .admin-tab.active {
        color: #4361ee;
        border-bottom-color: #4361ee;
    }
    
    .tab-content {
        display: none;
    }
    
    .tab-content.active {
        display: block;
    }
    
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
    }
    
    .stat-card {
        background: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        text-align: center;
    }
    
    .stat-card h3 {
        font-size: 2.5rem;
        margin: 10px 0;
        color: #4361ee;
    }
    
    .stat-card p {
        color: #666;
        font-size: 0.9rem;
    }
    
    .admin-table {
        width: 100%;
        background: white;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    
    .admin-table th {
        background: #f8f9fa;
        padding: 15px;
        text-align: left;
        font-weight: 600;
        color: #333;
    }
    
    .admin-table td {
        padding: 15px;
        border-top: 1px solid #eaeaea;
    }
    
    .admin-table tr:hover {
        background: #f8f9fa;
    }
    
    .badge {
        display: inline-block;
        padding: 5px 10px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: 500;
    }
    
    .badge-primary {
        background: #e3f2fd;
        color: #1976d2;
    }
    
    .badge-success {
        background: #e8f5e9;
        color: #388e3c;
    }
    
    .badge-warning {
        background: #fff3e0;
        color: #f57c00;
    }
    
    .badge-danger {
        background: #ffebee;
        color: #d32f2f;
    }
    
    .badge-secondary {
        background: #f5f5f5;
        color: #757575;
    }
    
    .badge-info {
        background: #e1f5fe;
        color: #0288d1;
    }
    
    .rating-stars {
        color: #ffc107;
        font-size: 1.2rem;
    }
    
    .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255,255,255,0.8);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    }
    
    .loading-spinner {
        text-align: center;
    }
    
    .loading-spinner i {
        font-size: 3rem;
        color: #4361ee;
    }
    
    .filters {
        display: flex;
        gap: 10px;
        margin-bottom: 20px;
        align-items: center;
    }
    
    .filters input,
    .filters select {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 5px;
        font-size: 0.9rem;
    }
    
    .text-center {
        text-align: center;
    }
    
    .btn-sm {
        padding: 5px 10px;
        font-size: 0.8rem;
    }
    
    .btn-outline {
        background: transparent;
        border: 1px solid #ddd;
        color: #666;
    }
    
    .btn-outline:hover {
        background: #f8f9fa;
    }
`;

// სტილების დამატება, თუ არ არსებობს
if (!document.querySelector('#admin-styles')) {
    const style = document.createElement('style');
    style.id = 'admin-styles';
    style.textContent = adminStyles;
    document.head.appendChild(style);
} 
