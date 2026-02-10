/**
 * HOMRAS - სამუშაოების მენეჯმენტის ფუნქციები
 */

// სამუშაოს დეტალების ჩვენება
async function showJobDetails(jobId) {
    try {
        const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`);
        const data = await response.json();
        
        if (data.success) {
            createJobDetailModal(data.job);
        } else {
            throw new Error(data.message || 'სამუშაოს დეტალების ჩატვირთვის შეცდომა');
        }
    } catch (error) {
        console.error('Error loading job details:', error);
        showNotification('დაფიქსირდა შეცდომა', 'error');
    }
}

function createJobDetailModal(job) {
    // არსებული მოდალის წაშლა
    const existingModal = document.getElementById('jobDetailModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'jobDetailModal';
    modal.className = 'modal active';
    
    // კატეგორიის ინფო
    const categoryInfo = {
        plumbing: { name: 'სანტექნიკა', icon: 'fa-faucet', color: '#4361ee' },
        electrical: { name: 'ელექტრიკა', icon: 'fa-bolt', color: '#ff9f1c' },
        repair: { name: 'რემონტი', icon: 'fa-tools', color: '#2ec4b6' },
        cleaning: { name: 'დასუფთავება', icon: 'fa-broom', color: '#4cc9f0' }
    };
    
    const cityNames = {
        batumi: 'ბათუმი',
        tbilisi: 'თბილისი',
        kutaisi: 'ქუთაისი'
    };
    
    modal.innerHTML = `
        <div class="modal-content job-detail-modal">
            <div class="modal-header">
                <h2>${job.title}</h2>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="job-detail-header">
                    <div class="job-category-badge" style="background-color: ${categoryInfo[job.category].color}20; border-color: ${categoryInfo[job.category].color}">
                        <i class="fas ${categoryInfo[job.category].icon}" style="color: ${categoryInfo[job.category].color}"></i>
                        ${categoryInfo[job.category].name}
                    </div>
                    <div class="job-status status-${job.status}">${job.status === 'open' ? 'ღია' : 'დახურული'}</div>
                </div>
                
                <div class="job-detail-info">
                    <div class="info-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${cityNames[job.city] || job.city}, ${job.address}</span>
                    </div>
                    <div class="info-item">
                        <i class="fas fa-calendar-alt"></i>
                        <span>გამოქვეყნებული: ${new Date(job.createdAt).toLocaleDateString('ka-GE')}</span>
                    </div>
                    ${job.budget ? `
                        <div class="info-item">
                            <i class="fas fa-money-bill-wave"></i>
                            <span>ბიუჯეტი: ${job.budget} ₾</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="job-description-section">
                    <h3>სამუშაოს აღწერა</h3>
                    <p>${job.description}</p>
                </div>
                
                ${job.photos && job.photos.length > 0 ? `
                    <div class="job-photos-section">
                        <h3>ფოტოები</h3>
                        <div class="job-photos-grid">
                            ${job.photos.map(photo => `
                                <img src="${photo}" alt="Job photo" class="job-photo">
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="job-actions">
                    ${job.status === 'open' ? `
                        <button class="btn btn-primary btn-apply-job" data-job-id="${job._id}">
                            <i class="fas fa-paper-plane"></i> განცხადება სამუშაოზე
                        </button>
                    ` : `
                        <button class="btn btn-secondary" disabled>
                            <i class="fas fa-lock"></i> სამუშაო დახურულია
                        </button>
                    `}
                    <button class="btn btn-outline btn-contact-owner" data-user-id="${job.customerId}">
                        <i class="fas fa-envelope"></i> დამკვეთთან დაკავშირება
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // დახურვის ღილაკი
    modal.querySelector('.close-modal').addEventListener('click', () => {
        modal.remove();
    });
    
    // განცხადების ღილაკი
    const applyBtn = modal.querySelector('.btn-apply-job');
    if (applyBtn) {
        applyBtn.addEventListener('click', function() {
            const jobId = this.getAttribute('data-job-id');
            applyForJob(jobId);
        });
    }
    
    // კონტაქტის ღილაკი
    const contactBtn = modal.querySelector('.btn-contact-owner');
    if (contactBtn) {
        contactBtn.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            contactJobOwner(userId, job._id);
        });
    }
}

// განცხადება სამუშაოზე
async function applyForJob(jobId) {
    const user = JSON.parse(localStorage.getItem('homras_user') || 'null');
    
    if (!user) {
        showNotification('გთხოვთ შეხვიდეთ სისტემაში', 'info');
        document.querySelector('.modal.active')?.remove();
        setTimeout(() => showModal('loginModal'), 300);
        return;
    }
    
    if (user.role !== 'handyman') {
        showNotification('მხოლოდ ხელოსნებს შეუძლიათ განცხადება სამუშაოებზე', 'warning');
        return;
    }
    
    try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL}/jobs/${jobId}/apply`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showNotification('თქვენი განცხადება წარმატებით გაიგზავნა!', 'success');
            
            // მოდალის დახურვა
            document.getElementById('jobDetailModal')?.remove();
        } else {
            throw new Error(data.message || 'განცხადების შეცდომა');
        }
    } catch (error) {
        console.error('Error applying for job:', error);
        showNotification(error.message || 'დაფიქსირდა შეცდომა', 'error');
    }
}

// დამკვეთთან დაკავშირება
function contactJobOwner(userId, jobId) {
    const user = JSON.parse(localStorage.getItem('homras_user') || 'null');
    
    if (!user) {
        showNotification('გთხოვთ შეხვიდეთ სისტემაში', 'info');
        return;
    }
    
    // შეტყობინების მოდალი
    createMessageModal(userId, jobId);
}

function createMessageModal(userId, jobId) {
    const existingModal = document.getElementById('messageModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'messageModal';
    modal.className = 'modal active';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>შეტყობინების გაგზავნა</h2>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <form id="messageForm">
                    <div class="form-group">
                        <label for="messageSubject">თემა</label>
                        <input type="text" id="messageSubject" value="სამუშაოს შესახებ" readonly>
                    </div>
                    <div class="form-group">
                        <label for="messageText">შეტყობინება</label>
                        <textarea id="messageText" rows="4" placeholder="დაწერეთ თქვენი შეტყობინება..." required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="messagePhone">საკონტაქტო ტელეფონი</label>
                        <input type="tel" id="messagePhone" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">
                        <i class="fas fa-paper-plane"></i> გაგზავნა
                    </button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // ფორმის დამუშავება
    modal.querySelector('#messageForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const subject = document.getElementById('messageSubject').value;
        const text = document.getElementById('messageText').value;
        const phone = document.getElementById('messagePhone').value;
        
        if (!text || !phone) {
            showNotification('გთხოვთ შეავსოთ ყველა ველი', 'error');
            return;
        }
        
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> გაგზავნა...';
        submitBtn.disabled = true;
        
        try {
            const response = await makeAuthenticatedRequest(`${API_BASE_URL}/messages`, {
                method: 'POST',
                body: JSON.stringify({
                    to: userId,
                    subject,
                    text,
                    phone,
                    jobId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showNotification('შეტყობინება წარმატებით გაიგზავნა!', 'success');
                modal.remove();
            } else {
                throw new Error(data.message || 'შეტყობინების გაგზავნის შეცდომა');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            showNotification(error.message || 'დაფიქსირდა შეცდომა', 'error');
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });
    
    // დახურვის ღილაკი
    modal.querySelector('.close-modal').addEventListener('click', () => {
        modal.remove();
    });
}

// ჩემი სამუშაოების ჩატვირთვა
async function loadMyJobs() {
    const user = JSON.parse(localStorage.getItem('homras_user') || 'null');
    
    if (!user) return;
    
    try {
        const endpoint = user.role === 'customer' 
            ? `${API_BASE_URL}/jobs/my-jobs`
            : `${API_BASE_URL}/jobs/applied-jobs`;
        
        const response = await makeAuthenticatedRequest(endpoint);
        const data = await response.json();
        
        if (data.success) {
            return data.jobs;
        } else {
            throw new Error(data.message || 'სამუშაოების ჩატვირთვის შეცდომა');
        }
    } catch (error) {
        console.error('Error loading my jobs:', error);
        showNotification('დაფიქსირდა შეცდომა', 'error');
        return [];
    }
}

// ექსპორტირებული ფუნქციები
window.jobHelpers = {
    showJobDetails,
    applyForJob,
    contactJobOwner,
    loadMyJobs
};

// CSS სტილების დამატება სამუშაო დეტალებისთვის
const jobDetailStyles = `
    .job-detail-modal {
        max-width: 700px;
    }
    
    .job-detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    
    .job-category-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        border-radius: 20px;
        border: 2px solid;
        font-weight: 500;
    }
    
    .job-status {
        padding: 6px 12px;
        border-radius: 20px;
        font-weight: 500;
        font-size: 14px;
    }
    
    .status-open {
        background-color: #d4edda;
        color: #155724;
    }
    
    .status-closed {
        background-color: #f8d7da;
        color: #721c24;
    }
    
    .job-detail-info {
        background-color: #f8f9fa;
        padding: 20px;
        border-radius: 10px;
        margin-bottom: 20px;
    }
    
    .info-item {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
    }
    
    .info-item:last-child {
        margin-bottom: 0;
    }
    
    .info-item i {
        color: #4361ee;
        width: 20px;
    }
    
    .job-description-section,
    .job-photos-section {
        margin-bottom: 30px;
    }
    
    .job-photos-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 10px;
        margin-top: 15px;
    }
    
    .job-photo {
        width: 100%;
        height: 150px;
        object-fit: cover;
        border-radius: 8px;
        cursor: pointer;
        transition: transform 0.2s;
    }
    
    .job-photo:hover {
        transform: scale(1.05);
    }
    
    .job-actions {
        display: flex;
        gap: 15px;
        margin-top: 30px;
    }
    
    @media (max-width: 768px) {
        .job-actions {
            flex-direction: column;
        }
    }
`;

// სტილების დამატება
if (!document.querySelector('#job-detail-styles')) {
    const style = document.createElement('style');
    style.id = 'job-detail-styles';
    style.textContent = jobDetailStyles;
    document.head.appendChild(style);
} 
