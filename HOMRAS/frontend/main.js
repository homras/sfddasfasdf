 // main.js - HOMRAS პლატფორმის ძირითადი JavaScript კოდი

// ===== GLOBAL STATE =====
const AppState = {
    currentPage: 'home',
    currentLang: 'ka',
    userType: null,
    userData: null,
    jobs: [],
    handymen: [],
    notifications: [],
    theme: 'light'
};

// ===== DOM ELEMENTS =====
const DOM = {
    loadingScreen: document.getElementById('loadingScreen'),
    mainApp: document.getElementById('mainApp'),
    mobileMenuToggle: document.getElementById('mobileMenuToggle'),
    primaryNav: document.querySelector('.primary-nav'),
    langToggle: document.getElementById('langToggle'),
    langDropdown: document.getElementById('langDropdown'),
    langOptions: document.querySelectorAll('.lang-option'),
    navLinks: document.querySelectorAll('.nav-link'),
    contentPages: document.querySelectorAll('.content-page'),
    loginBtn: document.getElementById('loginBtn'),
    registerBtn: document.getElementById('registerBtn'),
    backToTop: document.getElementById('backToTop'),
    // Client Page
    jobCreationForm: document.getElementById('jobCreationForm'),
    previewJobBtn: document.getElementById('previewJobBtn'),
    closePreviewBtn: document.getElementById('closePreviewBtn'),
    jobPreviewSection: document.getElementById('jobPreviewSection'),
    previewContent: document.getElementById('previewContent'),
    budgetRange: document.getElementById('budgetRange'),
    budgetValue: document.getElementById('budgetValue'),
    jobPhotos: document.getElementById('jobPhotos'),
    filePreview: document.getElementById('filePreview'),
    // Handyman Page
    handymanProfileForm: document.getElementById('handymanProfileForm'),
    previewProfileBtn: document.getElementById('previewProfileBtn'),
    profilePhoto: document.getElementById('profilePhoto'),
    uploadPhotoBtn: document.getElementById('uploadPhotoBtn'),
    removePhotoBtn: document.getElementById('removePhotoBtn'),
    photoPreview: document.getElementById('photoPreview'),
    skillsDropdown: document.getElementById('skillsDropdown'),
    skillTags: document.querySelectorAll('.skill-tag'),
    // Modals
    loginModal: document.getElementById('loginModal'),
    registerModal: document.getElementById('registerModal'),
    // Notifications
    successNotification: document.getElementById('successNotification'),
    errorNotification: document.getElementById('errorNotification')
};

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('HOMRAS პლატფორმა ინიციალიზაცია...');
    
    // დატვირთვის ეკრანის სიმულაცია
    setTimeout(() => {
        DOM.loadingScreen.style.opacity = '0';
        DOM.loadingScreen.style.visibility = 'hidden';
        DOM.mainApp.style.opacity = '1';
        
        // ინიციალიზაცია
        initApp();
    }, 1500);
});

function initApp() {
    console.log('აპლიკაციის ინიციალიზაცია...');
    
    // ევენთ ლისენერები
    setupEventListeners();
    
    // URL-დან გვერდის დაფიქსირება
    handleURLRouting();
    
    // ენის დაყენება
    setLanguage(AppState.currentLang);
    
    // თემის დაყენება
    setTheme(AppState.theme);
    
    // სქროლი
    setupScrollEffects();
    
    // ინფორმაციის ჩატვირთვა
    loadJobs();
    loadHandymen();
    
    // მობილური მენიუს შემოწმება
    checkMobileMenu();
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // მობილური მენიუ
    DOM.mobileMenuToggle?.addEventListener('click', toggleMobileMenu);
    
    // ენის შეცვლა
    DOM.langToggle?.addEventListener('click', toggleLanguageDropdown);
    DOM.langOptions.forEach(option => {
        option.addEventListener('click', () => {
            const lang = option.dataset.lang;
            setLanguage(lang);
            toggleLanguageDropdown();
        });
    });
    
    // ნავიგაცია
    DOM.navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
            if (window.innerWidth <= 768) {
                toggleMobileMenu();
            }
        });
    });
    
    // CTA ღილაკები
    document.querySelectorAll('[data-page]').forEach(btn => {
        if (!btn.classList.contains('nav-link')) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const page = btn.dataset.page;
                navigateTo(page);
            });
        }
    });
    
    // ავტორიზაციის ღილაკები
    DOM.loginBtn?.addEventListener('click', showLoginModal);
    DOM.registerBtn?.addEventListener('click', showRegisterModal);
    
    // სქროლის ღილაკი
    DOM.backToTop?.addEventListener('click', scrollToTop);
    window.addEventListener('scroll', toggleBackToTop);
    
    // ფაილის ატვირთვა
    if (DOM.jobPhotos) {
        DOM.jobPhotos.addEventListener('change', handleFileUpload);
    }
    
    // ბიუჯეტის სლაიდერი
    if (DOM.budgetRange) {
        DOM.budgetRange.addEventListener('input', updateBudgetValue);
    }
    
    // განცხადების ფორმა
    if (DOM.jobCreationForm) {
        DOM.jobCreationForm.addEventListener('submit', handleJobCreation);
    }
    
    if (DOM.previewJobBtn) {
        DOM.previewJobBtn.addEventListener('click', previewJob);
    }
    
    if (DOM.closePreviewBtn) {
        DOM.closePreviewBtn.addEventListener('click', () => {
            DOM.jobPreviewSection.style.display = 'none';
        });
    }
    
    // ხელოსნის პროფილი
    if (DOM.handymanProfileForm) {
        DOM.handymanProfileForm.addEventListener('submit', handleProfileSave);
    }
    
    if (DOM.previewProfileBtn) {
        DOM.previewProfileBtn.addEventListener('click', previewProfile);
    }
    
    if (DOM.uploadPhotoBtn) {
        DOM.uploadPhotoBtn.addEventListener('click', () => DOM.profilePhoto.click());
    }
    
    if (DOM.removePhotoBtn) {
        DOM.removePhotoBtn.addEventListener('click', removeProfilePhoto);
    }
    
    if (DOM.profilePhoto) {
        DOM.profilePhoto.addEventListener('change', handleProfilePhotoUpload);
    }
    
    // სპეციალობების მენეჯმენტი
    if (DOM.skillsDropdown) {
        DOM.skillsDropdown.addEventListener('change', handleSkillAdd);
    }
    
    if (DOM.skillTags) {
        DOM.skillTags.forEach(tag => {
            tag.querySelector('.remove-skill').addEventListener('click', handleSkillRemove);
        });
    }
    
    // ენის დროპდაუნი დახურვა
    document.addEventListener('click', (e) => {
        if (!DOM.langToggle.contains(e.target) && !DOM.langDropdown.contains(e.target)) {
            DOM.langDropdown.style.opacity = '0';
            DOM.langDropdown.style.visibility = 'hidden';
            DOM.langDropdown.style.transform = 'translateY(-10px)';
        }
    });
    
    // რესპონსივობისთვის
    window.addEventListener('resize', handleResize);
}

// ===== NAVIGATION & ROUTING =====
function navigateTo(page) {
    console.log(`ნავიგაცია გვერდზე: ${page}`);
    
    // ნავიგაციის მენიუს განახლება
    DOM.navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === page) {
            link.classList.add('active');
        }
    });
    
    // კონტენტის გვერდების განახლება
    DOM.contentPages.forEach(contentPage => {
        contentPage.classList.remove('active');
        if (contentPage.dataset.page === page) {
            contentPage.classList.add('active');
        }
    });
    
    // URL განახლება
    history.pushState({ page }, '', `#${page}`);
    
    // მდებარეობის განახლება
    scrollToSection(page);
    
    // State განახლება
    AppState.currentPage = page;
}

function handleURLRouting() {
    const hash = window.location.hash.substring(1) || 'home';
    navigateTo(hash);
}

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId + 'Page');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// ===== LANGUAGE SWITCHER =====
function setLanguage(lang) {
    AppState.currentLang = lang;
    localStorage.setItem('lang', lang);
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (translations[lang] && translations[lang][key]) {
            el.innerHTML = translations[lang][key];
        }
    });
    
    document.querySelector('.current-lang').textContent = lang.toUpperCase();
    
    document.querySelectorAll('.lang-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.lang === lang);
    });
}

function toggleLanguageDropdown() {
    DOM.langDropdown.classList.toggle('show');
}

// ===== MOBILE MENU =====
function toggleMobileMenu() {
    DOM.primaryNav.classList.toggle('show');
}

// ===== NOTIFICATIONS =====
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span class="notification-text">${message}</span>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    });
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// ===== FORM HANDLERS =====
function handleJobCreation(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    console.log('Job created:', data);
    showNotification('განცხადება წარმატებით გაიგზავნა!', 'success');
    
    e.target.reset();
}

function handleProfileSave(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    console.log('Profile saved:', data);
    showNotification('პროფილი წარმატებით შეინახა!', 'success');
    
    e.target.reset();
}

// ===== PHOTO PREVIEW =====
function handleProfilePhotoUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = ev => {
            DOM.photoPreview.innerHTML = `<img src="${ev.target.result}" alt="Preview" style="width:100%;height:100%;object-fit:cover;">`;
        };
        reader.readAsDataURL(file);
    }
}

function removeProfilePhoto() {
    DOM.photoPreview.innerHTML = '';
    DOM.profilePhoto.value = '';
}

// ===== BACK TO TOP =====
function toggleBackToTop() {
    if (window.scrollY > 500) {
        DOM.backToTop.classList.add('show');
    } else {
        DOM.backToTop.classList.remove('show');
    }
}

function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== INITIAL CALLS =====
initApp();
 

