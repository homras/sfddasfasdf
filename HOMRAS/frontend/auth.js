/**
 * HOMRAS - ავთენტიფიკაციის ფუნქციები
 */

// JWT ტოკენის ვალიდაცია
function validateToken(token) {
    try {
        if (!token) return false;
        
        // მარტივი ტოკენის ვალიდაცია (სრული იმპლემენტაცია საჭიროებს backend-ს)
        const parts = token.split('.');
        if (parts.length !== 3) return false;
        
        // შეამოწმეთ ვადა
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp && Date.now() >= payload.exp * 1000) {
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Token validation error:', error);
        return false;
    }
}

// დაცული მოთხოვნები
async function makeAuthenticatedRequest(url, options = {}) {
    const token = localStorage.getItem('homras_token');
    const user = JSON.parse(localStorage.getItem('homras_user') || 'null');
    
    if (!token || !user) {
        throw new Error('არასწორი ავთენტიფიკაცია');
    }
    
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, mergedOptions);
        
        if (response.status === 401) {
            // ავტორიზაციის შეცდომა - გამოსვლა
            localStorage.removeItem('homras_user');
            localStorage.removeItem('homras_token');
            window.location.reload();
            throw new Error('სესია დასრულდა. გთხოვთ შეხვიდეთ თავიდან.');
        }
        
        return response;
    } catch (error) {
        console.error('Authenticated request error:', error);
        throw error;
    }
}

// პაროლის ვალიდაცია
function validatePassword(password) {
    const errors = [];
    
    if (password.length < 6) {
        errors.push('პაროლი უნდა შეიცავდეს მინიმუმ 6 სიმბოლოს');
    }
    
    if (!/[A-Z]/.test(password)) {
        errors.push('პაროლი უნდა შეიცავდეს მინიმუმ ერთ დიდ ასოს');
    }
    
    if (!/[0-9]/.test(password)) {
        errors.push('პაროლი უნდა შეიცავდეს მინიმუმ ერთ ციფრს');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// ელ.ფოსტის ვალიდაცია
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ტელეფონის ვალიდაცია (საქართველო)
function validatePhone(phone) {
    const phoneRegex = /^(?:\+995|995|0)?(5\d{2}|7\d{2}|8\d{2})\d{6}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}

// მომხმარებლის პროფილის ჩატვირთვა
async function loadUserProfile() {
    const user = JSON.parse(localStorage.getItem('homras_user') || 'null');
    
    if (!user) return null;
    
    try {
        const response = await makeAuthenticatedRequest(`${API_BASE_URL}/users/profile`);
        const data = await response.json();
        
        if (data.success) {
            // პროფილის განახლება
            user.profile = data.profile;
            localStorage.setItem('homras_user', JSON.stringify(user));
            return data.profile;
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
    
    return null;
}

// ექსპორტირებული ფუნქციები
window.authHelpers = {
    validateToken,
    makeAuthenticatedRequest,
    validatePassword,
    validateEmail,
    validatePhone,
    loadUserProfile
}; 
