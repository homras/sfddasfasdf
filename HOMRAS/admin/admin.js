// HOMRAS ადმინისტრატორის პანელის ძირითადი ფუნქციონალი

// გლობალური ცვლადები
let currentUser = null;
let currentSection = 'dashboard';
let users = [];
let handymen = [];
let jobs = [];
let reviews = [];
let messages = [];
let transactions = [];
let activities = [];

// API ბაზური მისამართი
const API_BASE_URL = 'https://homras.onrender.com/api/admin';

// ტოკენის მენეჯმენტი
function getAuthToken() {
    return localStorage.getItem('admin_token');
}

function setAuthToken(token) {
    localStorage.setItem('admin_token', token);
}

function clearAuthToken() {
    localStorage.removeItem('admin_token');
}

function isAuthenticated() {
    const token = getAuthToken();
    if (!token) return false;
    
    // შეგვიძლია დავამატოთ ტოკენის ვალიდაცია JWT-სთვის
    return true;
}

// API მოთხოვნების ფუნქცია
async function apiRequest(endpoint, method = 'GET', data = null) {
    const token = getAuthToken();
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const options = {
        method,
        headers,
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        
        if (response.status === 401) {
            // ავტორიზაცია ვერ მოხერხდა
            clearAuthToken();
            window.location.href = '../frontend/index.html';
            return null;
        }
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || 'API შეცდომა');
        }
        
        return result;
    } catch (error) {
        console.error('API შეცდომა:', error);
        showNotification(`API შეცდომა: ${error.message}`, 'error');
        return null;
    }
}

// ნოტიფიკაციების ჩვენება
function showNotification(message, type = 'info') {
    // ამოიღეთ არსებული ნოტიფიკაცია, თუ არის
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    `;
    
    // სტილების დამატება
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex;
            align-items: center;
            justify-content: space-between;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 400px;
        }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .notification-content {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-right: 15px;
        }
        
        .notification-close {
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            padding: 0;
            font-size: 1rem;
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    // ავტომატური მოშორება
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
    
    // დახურვის ღილაკი
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
}

// მონაცემების ჩატვირთვა
async function loadDashboardData() {
    try {
        // სისტემის სტატისტიკა
        const stats = await apiRequest('/stats');
        if (stats) {
            updateDashboardStats(stats);
        }
        
        // აქტივობები
        const activitiesData = await apiRequest('/activities');
        if (activitiesData) {
            activities = activitiesData;
            updateActivityList(activities);
        }
        
        // სისტემის სტატუსი
        updateSystemStatus();
        
        // დიაგრამების ინიციალიზაცია
        initCharts(stats);
    } catch (error) {
        console.error('დეშბორდის მონაცემების ჩატვირთვის შეცდომა:', error);
        showNotification('დეშბორდის მონაცემების ჩატვირთვა ვერ მოხერხდა', 'error');
    }
}

async function loadUsers(page = 1, search = '') {
    try {
        const endpoint = `/users?page=${page}&limit=10${search ? `&search=${encodeURIComponent(search)}` : ''}`;
        const usersData = await apiRequest(endpoint);
        
        if (usersData) {
            users = usersData.users || [];
            updateUsersTable(users);
            updatePagination('users', page, usersData.totalPages || 1);
        }
    } catch (error) {
        console.error('მომხმარებლების ჩატვირთვის შეცდომა:', error);
    }
}

async function loadHandymen(filter = 'all', page = 1) {
    try {
        const endpoint = `/handymen?filter=${filter}&page=${page}&limit=10`;
        const handymenData = await apiRequest(endpoint);
        
        if (handymenData) {
            handymen = handymenData.handymen || [];
            updateHandymenTable(handymen);
            
            // დასამტკიცებელი ხელოსნების რაოდენობა
            const pendingCount = handymenData.pendingCount || 0;
            document.getElementById('pendingCount').textContent = pendingCount;
            document.querySelector('[data-filter="pending"] .badge').textContent = pendingCount;
        }
    } catch (error) {
        console.error('ხელოსნების ჩატვირთვის შეცდომა:', error);
    }
}

async function loadJobs(filter = 'all', page = 1) {
    try {
        const endpoint = `/jobs?filter=${filter}&page=${page}&limit=10`;
        const jobsData = await apiRequest(endpoint);
        
        if (jobsData) {
            jobs = jobsData.jobs || [];
            updateJobsTable(jobs);
        }
    } catch (error) {
        console.error('სამუშაოების ჩატვირთვის შეცდომა:', error);
    }
}

async function loadReviews(filter = 'all') {
    try {
        const endpoint = `/reviews?filter=${filter}`;
        const reviewsData = await apiRequest(endpoint);
        
        if (reviewsData) {
            reviews = reviewsData.reviews || [];
            updateReviewsList(reviews);
        }
    } catch (error) {
        console.error('რეცენზიების ჩატვირთვის შეცდომა:', error);
    }
}

async function loadMessages() {
    try {
        const messagesData = await apiRequest('/messages/conversations');
        
        if (messagesData) {
            messages = messagesData.conversations || [];
            updateConversationList(messages);
        }
    } catch (error) {
        console.error('შეტყობინებების ჩატვირთვის შეცდომა:', error);
    }
}

async function loadReports() {
    try {
        const reportsData = await apiRequest('/reports');
        
        if (reportsData) {
            transactions = reportsData.transactions || [];
            updateTransactionsTable(transactions);
            updateRevenueChart(reportsData.revenue);
            updateTopHandymen(reportsData.topHandymen);
        }
    } catch (error) {
        console.error('ანგარიშების ჩატვირთვის შეცდომა:', error);
    }
}

// დეშბორდის სტატისტიკის განახლება
function updateDashboardStats(stats) {
    document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
    document.getElementById('totalHandymen').textContent = stats.totalHandymen || 0;
    document.getElementById('totalJobs').textContent = stats.totalJobs || 0;
    document.getElementById('avgRating').textContent = (stats.avgRating || 0).toFixed(1);
    document.getElementById('dailyJobs').textContent = stats.dailyJobs || 0;
}

// აქტივობების სიის განახლება
function updateActivityList(activities) {
    const activityList = document.getElementById('activityList');
    activityList.innerHTML = '';
    
    activities.slice(0, 5).forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        const icon = getActivityIcon(activity.type);
        const time = formatTime(activity.timestamp);
        
        activityItem.innerHTML = `
            <div class="activity-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="activity-details">
                <h4>${activity.title}</h4>
                <p>${activity.description}</p>
            </div>
            <div class="activity-time">${time}</div>
        `;
        
        activityList.appendChild(activityItem);
    });
}

function getActivityIcon(type) {
    const icons = {
        'user_registered': 'fa-user-plus',
        'handyman_registered': 'fa-user-cog',
        'job_created': 'fa-briefcase',
        'job_completed': 'fa-check-circle',
        'review_added': 'fa-star',
        'payment_received': 'fa-credit-card',
        'system': 'fa-cog'
    };
    
    return icons[type] || 'fa-info-circle';
}

// მომხმარებელთა ცხრილის განახლება
function updateUsersTable(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        
        const statusClass = user.isActive ? 'status-active' : 'status-suspended';
        const statusText = user.isActive ? 'აქტიური' : 'დაბლოკილი';
        
        row.innerHTML = `
            <td>${user.id}</td>
            <td>
                <div class="user-info">
                    <strong>${user.fullName || 'არ არის მითითებული'}</strong>
                    <small>${user.username || ''}</small>
                </div>
            </td>
            <td>${user.email}</td>
            <td>${user.phone || 'არ არის მითითებული'}</td>
            <td>${formatDate(user.createdAt)}</td>
            <td><span class="status-tag ${statusClass}">${statusText}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-small btn-secondary" onclick="viewUserDetails(${user.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-small ${user.isActive ? 'btn-danger' : 'btn-success'}" 
                            onclick="toggleUserStatus(${user.id}, ${user.isActive})">
                        <i class="fas ${user.isActive ? 'fa-ban' : 'fa-check'}"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// ხელოსანთა ცხრილის განახლება
function updateHandymenTable(handymen) {
    const tbody = document.getElementById('handymenTableBody');
    tbody.innerHTML = '';
    
    handymen.forEach(handyman => {
        const row = document.createElement('tr');
        
        const statusClass = getHandymanStatusClass(handyman.status);
        const statusText = getHandymanStatusText(handyman.status);
        const rating = handyman.avgRating ? handyman.avgRating.toFixed(1) : 'არ არის';
        
        row.innerHTML = `
            <td>${handyman.id}</td>
            <td>
                <div class="handyman-info">
                    <strong>${handyman.fullName}</strong>
                    <small>${handyman.email}</small>
                </div>
            </td>
            <td>${handyman.specialization || 'არ არის მითითებული'}</td>
            <td>
                <div class="rating-display">
                    <i class="fas fa-star" style="color: #fbbf24;"></i>
                    <span>${rating}</span>
                    <small>(${handyman.totalReviews || 0} რეცენზია)</small>
                </div>
            </td>
            <td>${handyman.completedJobs || 0} დასრულებული</td>
            <td><span class="status-tag ${statusClass}">${statusText}</span></td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-small btn-secondary" onclick="viewHandymanDetails(${handyman.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-small btn-primary" onclick="editHandyman(${handyman.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${handyman.status === 'pending' ? `
                    <button class="btn btn-small btn-success" onclick="verifyHandyman(${handyman.id})">
                        <i class="fas fa-check"></i>
                    </button>
                    ` : ''}
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function getHandymanStatusClass(status) {
    switch (status) {
        case 'verified': return 'status-verified';
        case 'pending': return 'status-pending';
        case 'suspended': return 'status-suspended';
        default: return 'status-pending';
    }
}

function getHandymanStatusText(status) {
    switch (status) {
        case 'verified': return 'დამოწმებული';
        case 'pending': return 'დასამტკიცებელი';
        case 'suspended': return 'დაბლოკილი';
        default: return 'დასამტკიცებელი';
    }
}

// სამუშაოების ცხრილის განახლება
function updateJobsTable(jobs) {
    const tbody = document.getElementById('jobsTableBody');
    tbody.innerHTML = '';
    
    jobs.forEach(job => {
        const row = document.createElement('tr');
        
        const statusClass = getJobStatusClass(job.status);
        const statusText = getJobStatusText(job.status);
        
        row.innerHTML = `
            <td>${job.id}</td>
            <td>
                <div class="job-info">
                    <strong>${job.title}</strong>
                    <small>${job.category || 'არ არის მითითებული'}</small>
                </div>
            </td>
            <td>${job.clientName || 'არ არის მითითებული'}</td>
            <td>${job.handymanName || 'არ არის მითითებული'}</td>
            <td>${formatDate(job.createdAt)}</td>
            <td><span class="status-tag ${statusClass}">${statusText}</span></td>
            <td>${job.price ? `₾${job.price}` : 'შეთანხმებით'}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-small btn-secondary" onclick="viewJobDetails(${job.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-small btn-primary" onclick="editJob(${job.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function getJobStatusClass(status) {
    switch (status) {
        case 'pending': return 'status-pending';
        case 'active': return 'status-active';
        case 'completed': return 'status-completed';
        case 'cancelled': return 'status-cancelled';
        default: return 'status-pending';
    }
}

function getJobStatusText(status) {
    switch (status) {
        case 'pending': return 'მოთხოვნილი';
        case 'active': return 'აქტიური';
        case 'completed': return 'დასრულებული';
        case 'cancelled': return 'გაუქმებული';
        default: return 'მოთხოვნილი';
    }
}

// რეცენზიების სიის განახლება
function updateReviewsList(reviews) {
    const container = document.querySelector('.reviews-container');
    container.innerHTML = '';
    
    if (reviews.length === 0) {
        container.innerHTML = '<p class="empty-state">რეცენზიები არ მოიძებნა</p>';
        return;
    }
    
    reviews.forEach(review => {
        const reviewElement = document.createElement('div');
        reviewElement.className = 'review-item';
        
        const ratingStars = getRatingStars(review.rating);
        
        reviewElement.innerHTML = `
            <div class="review-header">
                <div class="reviewer-info">
                    <strong>${review.clientName}</strong>
                    <span>მიმოხილვა ხელოსნზე: ${review.handymanName}</span>
                </div>
                <div class="review-rating">
                    ${ratingStars}
                    <span class="review-date">${formatDate(review.createdAt)}</span>
                </div>
            </div>
            <div class="review-content">
                <p>${review.comment}</p>
            </div>
            <div class="review-actions">
                ${review.reported ? '<span class="reported-badge"><i class="fas fa-flag"></i> დასარეპორტებელი</span>' : ''}
                <button class="btn btn-small btn-danger" onclick="deleteReview(${review.id})">
                    <i class="fas fa-trash"></i> წაშლა
                </button>
            </div>
        `;
        
        container.appendChild(reviewElement);
    });
}

function getRatingStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= rating) {
            stars += '<i class="fas fa-star" style="color: #fbbf24;"></i>';
        } else if (i - 0.5 <= rating) {
            stars += '<i class="fas fa-star-half-alt" style="color: #fbbf24;"></i>';
        } else {
            stars += '<i class="far fa-star" style="color: #d1d5db;"></i>';
        }
    }
    return stars;
}

// საუბრების სიის განახლება
function updateConversationList(conversations) {
    const container = document.getElementById('conversationList');
    container.innerHTML = '';
    
    conversations.forEach(conversation => {
        const conversationElement = document.createElement('div');
        conversationElement.className = 'conversation-item';
        conversationElement.dataset.conversationId = conversation.id;
        
        const time = formatTime(conversation.lastMessageTime);
        const preview = conversation.lastMessage ? 
            (conversation.lastMessage.length > 50 ? 
                conversation.lastMessage.substring(0, 50) + '...' : 
                conversation.lastMessage) : 
            'შეტყობინება არ არის';
        
        conversationElement.innerHTML = `
            <div class="conversation-header">
                <div class="conversation-name">${conversation.participantName}</div>
                <div class="conversation-time">${time}</div>
            </div>
            <div class="conversation-preview">${preview}</div>
        `;
        
        conversationElement.addEventListener('click', () => {
            loadConversationMessages(conversation.id);
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.remove('active');
            });
            conversationElement.classList.add('active');
        });
        
        container.appendChild(conversationElement);
    });
}

// ტრანზაქციების ცხრილის განახლება
function updateTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTableBody');
    tbody.innerHTML = '';
    
    transactions.forEach(transaction => {
        const row = document.createElement('tr');
        
        const statusClass = transaction.status === 'completed' ? 'status-completed' : 
                          transaction.status === 'pending' ? 'status-pending' : 'status-cancelled';
        const statusText = transaction.status === 'completed' ? 'დასრულებული' :
                          transaction.status === 'pending' ? 'მოლოდინში' : 'გაუქმებული';
        
        row.innerHTML = `
            <td>${transaction.id}</td>
            <td>${formatDate(transaction.date)}</td>
            <td>${transaction.clientName}</td>
            <td>${transaction.handymanName}</td>
            <td>${transaction.service}</td>
            <td>₾${transaction.amount.toFixed(2)}</td>
            <td><span class="status-tag ${statusClass}">${statusText}</span></td>
        `;
        
        tbody.appendChild(row);
    });
}

// ტოპ ხელოსნების სიის განახლება
function updateTopHandymen(handymen) {
    const container = document.getElementById('topHandymenList');
    container.innerHTML = '';
    
    handymen.forEach((handyman, index) => {
        const rankElement = document.createElement('div');
        rankElement.className = 'handyman-rank';
        
        rankElement.innerHTML = `
            <div class="rank-number">${index + 1}</div>
            <div class="handyman-info">
                <h4>${handyman.fullName}</h4>
                <p>${handyman.specialization}</p>
            </div>
            <div class="handyman-stats">
                <div class="handyman-rating">
                    <i class="fas fa-star"></i> ${handyman.avgRating.toFixed(1)}
                </div>
                <div class="handyman-jobs">${handyman.completedJobs} სამუშაო</div>
            </div>
        `;
        
        container.appendChild(rankElement);
    });
}

// დიაგრამების ინიციალიზაცია
let jobsChart = null;
let categoriesChart = null;
let revenueChart = null;

function initCharts(stats) {
    // სამუშაოების დიაგრამა
    const jobsCtx = document.getElementById('jobsChart').getContext('2d');
    jobsChart = new Chart(jobsCtx, {
        type: 'line',
        data: {
            labels: stats.jobStats?.labels || ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ'],
            datasets: [{
                label: 'სამუშაოები',
                data: stats.jobStats?.data || [12, 19, 8, 15, 22, 18],
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    // კატეგორიების დიაგრამა
    const categoriesCtx = document.getElementById('categoriesChart').getContext('2d');
    categoriesChart = new Chart(categoriesCtx, {
        type: 'doughnut',
        data: {
            labels: stats.categoryStats?.labels || ['ელექტრიკა', 'სანტექნიკა', 'სამშენებლო', 'დასუფთავება', 'სხვა'],
            datasets: [{
                data: stats.categoryStats?.data || [25, 20, 30, 15, 10],
                backgroundColor: [
                    '#3b82f6',
                    '#10b981',
                    '#f59e0b',
                    '#8b5cf6',
                    '#ef4444'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // შემოსავლების დიაგრამა
    const revenueCtx = document.getElementById('revenueChart').getContext('2d');
    revenueChart = new Chart(revenueCtx, {
        type: 'bar',
        data: {
            labels: ['კვირა 1', 'კვირა 2', 'კვირა 3', 'კვირა 4'],
            datasets: [{
                label: 'შემოსავალი (₾)',
                data: [1200, 1900, 1500, 2100],
                backgroundColor: 'rgba(16, 185, 129, 0.6)',
                borderColor: '#10b981',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return '₾' + value;
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

function updateRevenueChart(revenueData) {
    if (revenueChart && revenueData) {
        revenueChart.data.labels = revenueData.labels;
        revenueChart.data.datasets[0].data = revenueData.data;
        revenueChart.update();
        
        // შემოსავლის შეჯამება
        const totalRevenue = revenueData.data.reduce((sum, val) => sum + val, 0);
        const totalCommission = totalRevenue * 0.15; // 15% საკომისიო
        
        document.getElementById('totalRevenue').textContent = `₾${totalRevenue.toFixed(2)}`;
        document.getElementById('totalCommission').textContent = `₾${totalCommission.toFixed(2)}`;
    }
}

// სისტემის სტატუსის განახლება
function updateSystemStatus() {
    // ამ მონაცემების მიღება API-დან
    const apiStatus = document.getElementById('apiStatus');
    const dbStatus = document.getElementById('dbStatus');
    
    // დროებითი მონაცემები
    apiStatus.className = 'status-indicator active';
    dbStatus.className = 'status-indicator active';
}

// ფორმატირების ფუნქციები
function formatDate(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('ka-GE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function formatTime(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) {
        return `${diffMins} წუთის წინ`;
    } else if (diffHours < 24) {
        return `${diffHours} საათის წინ`;
    } else if (diffDays < 7) {
        return `${diffDays} დღის წინ`;
    } else {
        return formatDate(dateString);
    }
}

// სექციების გადართვა
function switchSection(sectionId) {
    // მონიშნული სექციის შეცვლა
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // ახალი სექციის ჩვენება
    document.getElementById(`${sectionId}Section`).classList.add('active');
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    
    currentSection = sectionId;
    
    // მონაცემების ჩატვირთვა სექციის მიხედვით
    switch (sectionId) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'users':
            loadUsers();
            break;
        case 'handymen':
            loadHandymen();
            break;
        case 'jobs':
            loadJobs();
            break;
        case 'reviews':
            loadReviews();
            break;
        case 'messages':
            loadMessages();
            break;
        case 'reports':
            loadReports();
            break;
        case 'settings':
            // პარამეტრების ჩატვირთვა
            loadSettings();
            break;
    }
}

// პაგინაციის განახლება
function updatePagination(type, currentPage, totalPages) {
    const paginationElement = document.getElementById(`${type}Pagination`);
    if (!paginationElement) return;
    
    paginationElement.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // წინა ღილაკი
    const prevButton = document.createElement('button');
    prevButton.className = 'pagination-btn';
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            switch (type) {
                case 'users':
                    loadUsers(currentPage - 1);
                    break;
                case 'handymen':
                    loadHandymen('all', currentPage - 1);
                    break;
                case 'jobs':
                    loadJobs('all', currentPage - 1);
                    break;
            }
        }
    });
    paginationElement.appendChild(prevButton);
    
    // გვერდების ნომრები
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const pageButton = document.createElement('button');
            pageButton.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
            pageButton.textContent = i;
            pageButton.addEventListener('click', () => {
                if (i !== currentPage) {
                    switch (type) {
                        case 'users':
                            loadUsers(i);
                            break;
                        case 'handymen':
                            loadHandymen('all', i);
                            break;
                        case 'jobs':
                            loadJobs('all', i);
                            break;
                    }
                }
            });
            paginationElement.appendChild(pageButton);
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.padding = '0.5rem';
            paginationElement.appendChild(ellipsis);
        }
    }
    
    // შემდეგი ღილაკი
    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-btn';
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            switch (type) {
                case 'users':
                    loadUsers(currentPage + 1);
                    break;
                case 'handymen':
                    loadHandymen('all', currentPage + 1);
                    break;
                case 'jobs':
                    loadJobs('all', currentPage + 1);
                    break;
            }
        }
    });
    paginationElement.appendChild(nextButton);
}

// პარამეტრების ჩატვირთვა
async function loadSettings() {
    try {
        const settings = await apiRequest('/settings');
        if (settings) {
            updateSettingsForms(settings);
        }
    } catch (error) {
        console.error('პარამეტრების ჩატვირთვის შეცდომა:', error);
    }
}

function updateSettingsForms(settings) {
    // ზოგადი პარამეტრები
    if (document.getElementById('siteName')) {
        document.getElementById('siteName').value = settings.siteName || 'HOMRAS';
        document.getElementById('siteDescription').value = settings.siteDescription || '';
        document.getElementById('adminEmail').value = settings.adminEmail || '';
        document.getElementById('defaultLanguage').value = settings.defaultLanguage || 'ka';
    }
    
    // საკომისიო პარამეტრები
    if (document.getElementById('commissionRate')) {
        document.getElementById('commissionRate').value = settings.commissionRate || 15;
        document.getElementById('minWithdrawal').value = settings.minWithdrawal || 50;
        // დღეების მონიშვნა
        if (settings.withdrawalDays) {
            const select = document.getElementById('withdrawalDays');
            Array.from(select.options).forEach(option => {
                option.selected = settings.withdrawalDays.includes(parseInt(option.value));
            });
        }
    }
    
    // შეტყობინებების პარამეტრები
    if (document.getElementById('emailNewUser')) {
        document.getElementById('emailNewUser').checked = settings.emailNotifications?.newUser || true;
        document.getElementById('emailNewJob').checked = settings.emailNotifications?.newJob || true;
        document.getElementById('emailJobCompleted').checked = settings.emailNotifications?.jobCompleted || true;
        document.getElementById('smsNewJob').checked = settings.smsNotifications?.newJob || true;
        document.getElementById('smsReminder').checked = settings.smsNotifications?.reminder || false;
    }
    
    // უსაფრთხოების პარამეტრები
    if (document.getElementById('sessionTimeout')) {
        document.getElementById('sessionTimeout').value = settings.security?.sessionTimeout || 60;
        document.getElementById('require2FA').checked = settings.security?.require2FA || false;
        document.getElementById('maxLoginAttempts').value = settings.security?.maxLoginAttempts || 5;
        document.getElementById('ipWhitelist').value = settings.security?.ipWhitelist?.join('\n') || '';
    }
}

// ტაბების გადართვა (პარამეტრებში)
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(`${tabId}Tab`).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
}

// საუბრის შეტყობინებების ჩატვირთვა
async function loadConversationMessages(conversationId) {
    try {
        const messagesData = await apiRequest(`/messages/conversations/${conversationId}`);
        
        if (messagesData) {
            const conversation = messagesData.conversation;
            const messages = messagesData.messages;
            
            document.getElementById('selectedConversation').textContent = 
                `საუბარი: ${conversation.participantName}`;
            
            updateMessageHistory(messages);
        }
    } catch (error) {
        console.error('საუბრის შეტყობინებების ჩატვირთვის შეცდომა:', error);
    }
}

function updateMessageHistory(messages) {
    const container = document.getElementById('messageHistory');
    container.innerHTML = '';
    
    messages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.className = `message-bubble ${message.isAdmin ? 'sent' : 'received'}`;
        messageElement.innerHTML = `
            <div class="message-text">${message.text}</div>
            <div class="message-time">${formatTime(message.timestamp)}</div>
        `;
        
        container.appendChild(messageElement);
    });
    
    // ჩასქროლვა ბოლო შეტყობინებაზე
    container.scrollTop = container.scrollHeight;
}

// მოდალური ფანჯრები
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// დამადასტურებელი მოდალური ფანჯარა
function showConfirmation(message, onConfirm) {
    document.getElementById('confirmationText').textContent = message;
    const modal = document.getElementById('confirmationModal');
    
    modal.classList.add('active');
    
    document.getElementById('confirmBtn').onclick = () => {
        onConfirm();
        modal.classList.remove('active');
    };
    
    document.getElementById('cancelBtn').onclick = () => {
        modal.classList.remove('active');
    };
    
    modal.querySelector('.close-modal').onclick = () => {
        modal.classList.remove('active');
    };
}

// ღონისძიებების დამუშავება
function setupEventListeners() {
    // გამოსვლა
    document.getElementById('logoutBtn').addEventListener('click', () => {
        showConfirmation('დარწმუნებული ხართ, რომ გსურთ სისტემიდან გამოსვლა?', () => {
            clearAuthToken();
            window.location.href = '../frontend/index.html';
        });
    });
    
    // მენიუს გადართვა
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            switchSection(section);
        });
    });
    
    // ტაბების გადართვა (პარამეტრებში)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });
    
    // დროის დიაპაზონის შეცვლა
    document.getElementById('timeRange').addEventListener('change', (e) => {
        loadDashboardData();
    });
    
    // მომხმარებლების ძებნა
    let userSearchTimeout;
    document.getElementById('userSearch').addEventListener('input', (e) => {
        clearTimeout(userSearchTimeout);
        userSearchTimeout = setTimeout(() => {
            loadUsers(1, e.target.value);
        }, 500);
    });
    
    // მომხმარებლების ექსპორტი
    document.getElementById('exportUsers').addEventListener('click', () => {
        exportUsersToCSV();
    });
    
    // ხელოსნების ფილტრაცია
    document.querySelectorAll('#handymenSection .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#handymenSection .filter-btn').forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            loadHandymen(filter);
        });
    });
    
    // ხელოსნის დამატება
    document.getElementById('addHandymanBtn').addEventListener('click', () => {
        openHandymanModal();
    });
    
    // სამუშაოების ფილტრაცია
    document.querySelectorAll('#jobsSection .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#jobsSection .filter-btn').forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            loadJobs(filter);
        });
    });
    
    // რეცენზიების ფილტრაცია
    document.querySelectorAll('#reviewsSection .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#reviewsSection .filter-btn').forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            loadReviews(filter);
        });
    });
    
    // შეტყობინებების ძებნა
    let messageSearchTimeout;
    document.getElementById('messageSearch').addEventListener('input', (e) => {
        clearTimeout(messageSearchTimeout);
        messageSearchTimeout = setTimeout(() => {
            // ძებნის ლოგიკა
            console.log('ძებნა:', e.target.value);
        }, 500);
    });
    
    // პასუხის გაგზავნა
    document.getElementById('sendReplyBtn').addEventListener('click', () => {
        sendReply();
    });
    
    // ანგარიშის გენერაცია
    document.getElementById('generateReport').addEventListener('click', () => {
        generateReport();
    });
    
    // ფორმების გაგზავნა
    document.getElementById('generalSettingsForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveGeneralSettings();
    });
    
    document.getElementById('commissionSettingsForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveCommissionSettings();
    });
    
    document.getElementById('notificationSettingsForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveNotificationSettings();
    });
    
    document.getElementById('securitySettingsForm')?.addEventListener('submit', (e) => {
        e.preventDefault();
        saveSecuritySettings();
    });
    
    // მოდალური ფანჯრების დახურვა
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            modal.classList.remove('active');
        });
    });
    
    // მოდალური ფანჯრის გარეთ კლიკი
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
}

// ხელოსნის მოდალური ფანჯარა
function openHandymanModal(handymanId = null) {
    const modal = document.getElementById('handymanModal');
    const modalBody = modal.querySelector('.modal-body');
    
    if (handymanId) {
        // რედაქტირების რეჟიმი
        const handyman = handymen.find(h => h.id === handymanId);
        if (!handyman) return;
        
        modalBody.innerHTML = `
            <form id="handymanForm">
                <div class="form-group">
                    <label for="handymanFullName">სახელი და გვარი</label>
                    <input type="text" id="handymanFullName" value="${handyman.fullName}" required>
                </div>
                
                <div class="form-group">
                    <label for="handymanEmail">ელ. ფოსტა</label>
                    <input type="email" id="handymanEmail" value="${handyman.email}" required>
                </div>
                
                <div class="form-group">
                    <label for="handymanPhone">ტელეფონი</label>
                    <input type="tel" id="handymanPhone" value="${handyman.phone || ''}">
                </div>
                
                <div class="form-group">
                    <label for="handymanSpecialization">სპეციალიზაცია</label>
                    <input type="text" id="handymanSpecialization" value="${handyman.specialization || ''}">
                </div>
                
                <div class="form-group">
                    <label for="handymanExperience">გამოცდილება (წელი)</label>
                    <input type="number" id="handymanExperience" min="0" value="${handyman.experience || 0}">
                </div>
                
                <div class="form-group">
                    <label for="handymanDescription">აღწერა</label>
                    <textarea id="handymanDescription" rows="3">${handyman.description || ''}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="handymanStatus">სტატუსი</label>
                    <select id="handymanStatus">
                        <option value="pending" ${handyman.status === 'pending' ? 'selected' : ''}>დასამტკიცებელი</option>
                        <option value="verified" ${handyman.status === 'verified' ? 'selected' : ''}>დამოწმებული</option>
                        <option value="suspended" ${handyman.status === 'suspended' ? 'selected' : ''}>დაბლოკილი</option>
                    </select>
                </div>
                
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary close-modal">გაუქმება</button>
                    <button type="submit" class="btn btn-primary">შენახვა</button>
                </div>
            </form>
        `;
    } else {
        // დამატების რეჟიმი
        modalBody.innerHTML = `
            <form id="handymanForm">
                <div class="form-group">
                    <label for="handymanFullName">სახელი და გვარი</label>
                    <input type="text" id="handymanFullName" required>
                </div>
                
                <div class="form-group">
                    <label for="handymanEmail">ელ. ფოსტა</label>
                    <input type="email" id="handymanEmail" required>
                </div>
                
                <div class="form-group">
                    <label for="handymanPhone">ტელეფონი</label>
                    <input type="tel" id="handymanPhone">
                </div>
                
                <div class="form-group">
                    <label for="handymanSpecialization">სპეციალიზაცია</label>
                    <input type="text" id="handymanSpecialization">
                </div>
                
                <div class="form-group">
                    <label for="handymanPassword">პაროლი</label>
                    <input type="password" id="handymanPassword" required>
                </div>
                
                <div class="form-group">
                    <label for="handymanConfirmPassword">პაროლის დადასტურება</label>
                    <input type="password" id="handymanConfirmPassword" required>
                </div>
                
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary close-modal">გაუქმება</button>
                    <button type="submit" class="btn btn-primary">დამატება</button>
                </div>
            </form>
        `;
    }
    
    // ფორმის დამუშავება
    modalBody.querySelector('#handymanForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveHandyman(handymanId);
    });
    
    modal.classList.add('active');
}

// API ფუნქციები
async function saveHandyman(handymanId) {
    const form = document.getElementById('handymanForm');
    const formData = new FormData(form);
    
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });
    
    try {
        let result;
        if (handymanId) {
            result = await apiRequest(`/handymen/${handymanId}`, 'PUT', data);
        } else {
            result = await apiRequest('/handymen', 'POST', data);
        }
        
        if (result) {
            showNotification(handymanId ? 'ხელოსანი განახლდა' : 'ხელოსანი დაემატა', 'success');
            closeModal('handymanModal');
            loadHandymen();
        }
    } catch (error) {
        showNotification('ოპერაცია ვერ შესრულდა', 'error');
    }
}

async function verifyHandyman(handymanId) {
    showConfirmation('დარწმუნებული ხართ, რომ გსურთ ამ ხელოსნის დამოწმება?', async () => {
        try {
            const result = await apiRequest(`/handymen/${handymanId}/verify`, 'POST');
            
            if (result) {
                showNotification('ხელოსანი დამოწმებულია', 'success');
                loadHandymen();
            }
        } catch (error) {
            showNotification('დამოწმება ვერ შესრულდა', 'error');
        }
    });
}

async function toggleUserStatus(userId, isActive) {
    const action = isActive ? 'დაბლოკვა' : 'განბლოკვა';
    
    showConfirmation(`დარწმუნებული ხართ, რომ გსურთ მომხმარებლის ${action}?`, async () => {
        try {
            const result = await apiRequest(`/users/${userId}/toggle-status`, 'POST');
            
            if (result) {
                showNotification(`მომხმარებელი ${action === 'დაბლოკვა' ? 'დაბლოკულია' : 'განბლოკილია'}`, 'success');
                loadUsers();
            }
        } catch (error) {
            showNotification('ოპერაცია ვერ შესრულდა', 'error');
        }
    });
}

async function deleteReview(reviewId) {
    showConfirmation('დარწმუნებული ხართ, რომ გსურთ ამ რეცენზიის წაშლა?', async () => {
        try {
            const result = await apiRequest(`/reviews/${reviewId}`, 'DELETE');
            
            if (result) {
                showNotification('რეცენზია წაიშალა', 'success');
                loadReviews();
            }
        } catch (error) {
            showNotification('წაშლა ვერ შესრულდა', 'error');
        }
    });
}

async function sendReply() {
    const message = document.getElementById('replyMessage').value.trim();
    const activeConversation = document.querySelector('.conversation-item.active');
    
    if (!message || !activeConversation) {
        showNotification('შეიყვანეთ შეტყობინება', 'warning');
        return;
    }
    
    const conversationId = activeConversation.dataset.conversationId;
    
    try {
        const result = await apiRequest(`/messages/conversations/${conversationId}/reply`, 'POST', {
            text: message
        });
        
        if (result) {
            document.getElementById('replyMessage').value = '';
            loadConversationMessages(conversationId);
            showNotification('შეტყობინება გაიგზავნა', 'success');
        }
    } catch (error) {
        showNotification('შეტყობინების გაგზავნა ვერ მოხერხდა', 'error');
    }
}

async function generateReport() {
    try {
        const result = await apiRequest('/reports/generate', 'POST');
        
        if (result) {
            showNotification('ანგარიში გენერირდა', 'success');
            loadReports();
        }
    } catch (error) {
        showNotification('ანგარიშის გენერაცია ვერ მოხერხდა', 'error');
    }
}

async function exportUsersToCSV() {
    try {
        const result = await apiRequest('/users/export');
        
        if (result && result.downloadUrl) {
            // CSV ფაილის ჩამოტვირთვა
            const link = document.createElement('a');
            link.href = result.downloadUrl;
            link.download = 'homras_users.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showNotification('მომხმარებლების ექსპორტი წარმატებით დასრულდა', 'success');
        }
    } catch (error) {
        showNotification('ექსპორტი ვერ მოხერხდა', 'error');
    }
}

async function saveGeneralSettings() {
    const data = {
        siteName: document.getElementById('siteName').value,
        siteDescription: document.getElementById('siteDescription').value,
        adminEmail: document.getElementById('adminEmail').value,
        defaultLanguage: document.getElementById('defaultLanguage').value
    };
    
    try {
        const result = await apiRequest('/settings/general', 'PUT', data);
        
        if (result) {
            showNotification('ზოგადი პარამეტრები შენახულია', 'success');
        }
    } catch (error) {
        showNotification('პარამეტრების შენახვა ვერ მოხერხდა', 'error');
    }
}

async function saveCommissionSettings() {
    const withdrawalDaysSelect = document.getElementById('withdrawalDays');
    const selectedDays = Array.from(withdrawalDaysSelect.selectedOptions).map(option => parseInt(option.value));
    
    const data = {
        commissionRate: parseFloat(document.getElementById('commissionRate').value),
        minWithdrawal: parseFloat(document.getElementById('minWithdrawal').value),
        withdrawalDays: selectedDays
    };
    
    try {
        const result = await apiRequest('/settings/commission', 'PUT', data);
        
        if (result) {
            showNotification('საკომისიო პარამეტრები შენახულია', 'success');
        }
    } catch (error) {
        showNotification('პარამეტრების შენახვა ვერ მოხერხდა', 'error');
    }
}

async function saveNotificationSettings() {
    const data = {
        emailNotifications: {
            newUser: document.getElementById('emailNewUser').checked,
            newJob: document.getElementById('emailNewJob').checked,
            jobCompleted: document.getElementById('emailJobCompleted').checked
        },
        smsNotifications: {
            newJob: document.getElementById('smsNewJob').checked,
            reminder: document.getElementById('smsReminder').checked
        }
    };
    
    try {
        const result = await apiRequest('/settings/notifications', 'PUT', data);
        
        if (result) {
            showNotification('შეტყობინებების პარამეტრები შენახულია', 'success');
        }
    } catch (error) {
        showNotification('პარამეტრების შენახვა ვერ მოხერხდა', 'error');
    }
}

async function saveSecuritySettings() {
    const ipWhitelist = document.getElementById('ipWhitelist').value
        .split('\n')
        .map(ip => ip.trim())
        .filter(ip => ip);
    
    const data = {
        sessionTimeout: parseInt(document.getElementById('sessionTimeout').value),
        require2FA: document.getElementById('require2FA').checked,
        maxLoginAttempts: parseInt(document.getElementById('maxLoginAttempts').value),
        ipWhitelist: ipWhitelist
    };
    
    try {
        const result = await apiRequest('/settings/security', 'PUT', data);
        
        if (result) {
            showNotification('უსაფრთხოების პარამეტრები შენახულია', 'success');
        }
    } catch (error) {
        showNotification('პარამეტრების შენახვა ვერ მოხერხდა', 'error');
    }
}

// ხელოსნის დეტალების ნახვა (სადემონსტრაციო)
function viewHandymanDetails(handymanId) {
    showNotification('ეს ფუნქციონალი განვითარების პროცესშია', 'info');
}

// მომხმარებლის დეტალების ნახვა (სადემონსტრაციო)
function viewUserDetails(userId) {
    showNotification('ეს ფუნქციონალი განვითარების პროცესშია', 'info');
}

// სამუშაოს დეტალების ნახვა (სადემონსტრაციო)
function viewJobDetails(jobId) {
    showNotification('ეს ფუნქციონალი განვითარების პროცესშია', 'info');
}

// ხელოსნის რედაქტირება (სადემონსტრაციო)
function editHandyman(handymanId) {
    openHandymanModal(handymanId);
}

// სამუშაოს რედაქტირება (სადემონსტრაციო)
function editJob(jobId) {
    showNotification('ეს ფუნქციონალი განვითარების პროცესშია', 'info');
}

// აპლიკაციის ინიციალიზაცია
function initApp() {
    // ავტორიზაციის შემოწმება
    if (!isAuthenticated()) {
        window.location.href = '../frontend/index.html';
        return;
    }
    
    // მოვლენების დამუშავების დაყენება
    setupEventListeners();
    
    // დეშბორდის მონაცემების ჩატვირთვა
    switchSection('dashboard');
    
    // სისტემის სტატუსის პერიოდული განახლება
    setInterval(updateSystemStatus, 30000);
    
    // მონაცემების პერიოდული განახლება მიმდინარე სექციისთვის
    setInterval(() => {
        switch (currentSection) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'handymen':
                loadHandymen();
                break;
            case 'jobs':
                loadJobs();
                break;
            case 'messages':
                loadMessages();
                break;
        }
    }, 60000); // ყოველ წუთში
}

// გაშვება, როდესაც დოკუმენტი ჩაიტვირთება
document.addEventListener('DOMContentLoaded', initApp); 

