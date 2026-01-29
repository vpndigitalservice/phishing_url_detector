// Cyber Kavach Login with Subscription System
console.log('🔑 Cyber Kavach Login initialized');

// DOM Elements
const elements = {
    form: document.getElementById('loginForm'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    loginBtn: document.getElementById('loginBtn'),
    signUpBtn: document.getElementById('signUpBtn'),
    forgotPassword: document.getElementById('forgotPassword'),
    errorMessage: document.getElementById('errorMessage'),
    successMessage: document.getElementById('successMessage'),
    loading: document.getElementById('loading'),
    rememberMe: document.getElementById('rememberMe')
};

// User database (in production, this would be on a server)
const userDatabase = {
    // Default paid user for testing
    'paid@cyberkavach.com': {
        password: 'PaidUser123',
        subscription: 'paid',
        name: 'Paid User',
        features: {
            autoScan: true,
            autoBlock: true,
            redScreen: true,
            advancedSettings: true
        }
    },
    // Free user for testing
    'free@cyberkavach.com': {
        password: 'FreeUser123',
        subscription: 'free',
        name: 'Free User',
        features: {
            autoScan: false,
            autoBlock: false,
            redScreen: false,
            advancedSettings: false
        }
    }
};

// ===== SESSION MANAGEMENT =====
async function saveUserSession(userData) {
    try {
        // Save all user data at once
        await chrome.storage.local.set({
            userLoggedIn: true,
            userEmail: userData.email,
            userId: userData.uid,
            userName: userData.name,
            userSubscription: userData.subscription,
            userFeatures: userData.features,
            lastLogin: new Date().toISOString(),
            // Also set as individual keys for faster access
            '_userLoggedIn': true,
            '_userSubscription': userData.subscription
        });
        
        console.log('💾 User session saved to storage');
        
        // Verify it was saved
        const verify = await chrome.storage.local.get(['userLoggedIn', 'userSubscription']);
        console.log('✅ Storage verification:', verify);
        
    } catch (error) {
        console.error('❌ Error saving user session:', error);
        throw error;
    }
}

// ===== INITIALIZATION =====
function initialize() {
    console.log('📱 Login page loaded');
    
    // Set demo credentials for testing
    elements.email.value = 'paid@cyberkavach.com';
    elements.password.value = 'PaidUser123';
    
    // Load saved credentials
    loadSavedCredentials();
    
    // Setup event listeners
    setupEventListeners();
    
    // Auto-focus email field
    if (elements.email) {
        setTimeout(() => elements.email.focus(), 100);
    }
}

// Add storage check on login page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔑 Login page loaded');
    
    // Check storage immediately
    chrome.storage.local.get(['userLoggedIn'], (result) => {
        console.log('📊 Initial storage check:', result);
        
        if (result.userLoggedIn) {
            console.log('✅ User already logged in, quick redirecting...');
            // Quick redirect without loading credentials
            setTimeout(() => {
                window.location.href = '../popup/popup.html';
            }, 100);
            return;
        }
        
        // Otherwise load credentials normally
        chrome.storage.local.get(['rememberedEmail', 'userLoggedIn'], (result) => {
            if (result.rememberedEmail) {
                elements.email.value = result.rememberedEmail;
                elements.rememberMe.checked = true;
                console.log('📝 Loaded remembered email:', result.rememberedEmail);
            }
        });
    });
    
    // Rest of initialization
    initialize();
});

function loadSavedCredentials() {
    chrome.storage.local.get(['rememberedEmail', 'userLoggedIn'], (result) => {
        if (result.rememberedEmail && elements.email && !elements.email.value) {
            elements.email.value = result.rememberedEmail;
            elements.rememberMe.checked = true;
            console.log('📝 Loaded saved email:', result.rememberedEmail);
        }
        
        // Redirect if already logged in (fallback check)
        if (result.userLoggedIn) {
            console.log('✅ Already logged in, redirecting...');
            redirectToMain();
        }
    });
}

function setupEventListeners() {
    // Login form submission
    if (elements.form) {
        elements.form.addEventListener('submit', handleLogin);
    }
    
    // Sign up button
    if (elements.signUpBtn) {
        elements.signUpBtn.addEventListener('click', handleSignUp);
    }
    
    // Forgot password
    if (elements.forgotPassword) {
        elements.forgotPassword.addEventListener('click', handleForgotPassword);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter' && elements.form) {
            elements.form.requestSubmit();
        }
    });
}

// ===== UI FUNCTIONS =====
// Toggle password visibility
window.togglePasswordVisibility = function() {
    if (!elements.password) return;
    
    const type = elements.password.type === 'password' ? 'text' : 'password';
    elements.password.type = type;
    
    const button = document.querySelector('.toggle-password');
    if (button) {
        button.textContent = type === 'password' ? '👁️' : '🙈';
        button.setAttribute('aria-label', type === 'password' ? 'Show password' : 'Hide password');
    }
}

// Show/hide messages
function showMessage(type, text) {
    if (type === 'error' && elements.errorMessage) {
        elements.errorMessage.textContent = text;
        elements.errorMessage.style.display = 'block';
        if (elements.successMessage) {
            elements.successMessage.style.display = 'none';
        }
    } else if (type === 'success' && elements.successMessage) {
        elements.successMessage.textContent = text;
        elements.successMessage.style.display = 'block';
        if (elements.errorMessage) {
            elements.errorMessage.style.display = 'none';
        }
    }
}

// Show/hide loading
function setLoading(isLoading) {
    if (elements.loading) {
        elements.loading.style.display = isLoading ? 'block' : 'none';
    }
    if (elements.loginBtn) {
        elements.loginBtn.disabled = isLoading;
        elements.loginBtn.innerHTML = isLoading ? '⏳ Authenticating...' : '🔐 Sign In';
    }
    if (elements.signUpBtn) {
        elements.signUpBtn.disabled = isLoading;
    }
}

// Validate email
function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// ===== AUTHENTICATION HANDLERS =====
// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = elements.email.value.trim();
    const password = elements.password.value;
    
    // Validation
    if (!email || !password) {
        showMessage('error', 'Please enter email and password');
        return;
    }
    
    if (!isValidEmail(email)) {
        showMessage('error', 'Please enter a valid email address');
        return;
    }
    
    if (password.length < 6) {
        showMessage('error', 'Password must be at least 6 characters');
        return;
    }
    
    setLoading(true);
    
    try {
        // Authenticate user
        const userData = await authenticate(email, password);
        
        // Save email if "Remember me" is checked
        if (elements.rememberMe && elements.rememberMe.checked) {
            await chrome.storage.local.set({ rememberedEmail: email });
            console.log('💾 Email saved for future logins');
        } else {
            await chrome.storage.local.remove('rememberedEmail');
        }
        
        // Save user session with subscription data
        await saveUserSession(userData);
        
        console.log('🎉 Login successful for:', userData.email);
        console.log('💰 Subscription:', userData.subscription);
        console.log('🎯 Features:', userData.features);
        
        showMessage('success', `Welcome ${userData.name}! (${userData.subscription.toUpperCase()} plan)`);
        
        // Wait a moment before redirecting
        setTimeout(() => {
            redirectToMain();
        }, 1000);
        
    } catch (error) {
        console.error('❌ Login error:', error);
        showMessage('error', error.message || 'Login failed. Please try again.');
    } finally {
        setLoading(false);
    }
}

// Authentication function with subscription
async function authenticate(email, password) {
    return new Promise((resolve, reject) => {
        // Simulate network delay
        setTimeout(() => {
            // Check user database
            const user = userDatabase[email];
            
            if (user && user.password === password) {
                resolve({
                    uid: 'user-' + Date.now(),
                    email: email,
                    name: user.name,
                    subscription: user.subscription,
                    features: user.features
                });
            } else {
                reject({ 
                    code: 'auth/invalid-credentials', 
                    message: 'Invalid email or password' 
                });
            }
        }, 1000);
    });
}

// Handle sign up
function handleSignUp(e) {
    e.preventDefault();
    showMessage('error', 'New users must sign up on our website. Visit cyberkavach.com to create an account.');
    
    setTimeout(() => {
        if (confirm('Open website to sign up?')) {
            chrome.tabs.create({ url: '#' });
        }
    }, 500);
}

// Handle forgot password
function handleForgotPassword(e) {
    e.preventDefault();
    
    const email = elements.email.value.trim();
    
    if (!email || !isValidEmail(email)) {
        showMessage('error', 'Please enter a valid email address');
        return;
    }
    
    setLoading(true);
    
    // Simulate sending reset email
    setTimeout(() => {
        setLoading(false);
        showMessage('success', `Password reset link sent to ${email}. Check your inbox.`);
        console.log('📧 Reset email sent to:', email);
    }, 1000);
}

// Redirect to main popup
function redirectToMain() {
    setTimeout(() => {
        window.location.href = '../popup/popup.html';
    }, 1500);
}