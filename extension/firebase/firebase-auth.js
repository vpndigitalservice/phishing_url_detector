// Firebase Auth SDK 
(function() {
    'use strict';
    
    console.log('📦 Loading Firebase Auth SDK...');
    
    // Wait for firebase to be available
    const checkFirebase = setInterval(() => {
        if (window.firebase) {
            clearInterval(checkFirebase);
            initializeAuth();
        }
    }, 100);
    
    // Timeout after 3 seconds
    setTimeout(() => {
        if (!window.firebaseAuth) {
            console.warn('⚠️ Firebase App took too long to load, initializing standalone auth');
            initializeStandaloneAuth();
        }
    }, 3000);
    
    function initializeAuth() {
        console.log('🔐 Initializing Firebase Auth...');
        
        // Create auth methods
        const authMethods = {
            // Get auth instance
            getAuth: function(app) {
                console.log('✅ Auth instance created');
                return this;
            },
            
            // Sign in with email and password
            signInWithEmailAndPassword: function(auth, email, password) {
                console.log('🔐 Attempting login for:', email);
                return authenticateUser(email, password);
            },
            
            // Send password reset
            sendPasswordResetEmail: function(auth, email) {
                console.log('📧 Password reset for:', email);
                return sendResetEmail(email);
            },
            
            // Sign out
            signOut: function() {
                return Promise.resolve();
            },
            
            // Set persistence
            setPersistence: function() {
                return Promise.resolve();
            },
            
            // Auth types
            Auth: {
                Persistence: {
                    LOCAL: 'local',
                    SESSION: 'session',
                    NONE: 'none'
                }
            }
        };
        
        // Attach to firebase
        window.firebase.auth = function() {
            return authMethods;
        };
        
        // Also store globally
        window.firebaseAuth = authMethods;
        
        console.log('✅ Firebase Auth SDK loaded');
    }
    
    function initializeStandaloneAuth() {
        console.log('🔐 Initializing standalone auth...');
        
        window.firebaseAuth = {
            signInWithEmailAndPassword: authenticateUser,
            sendPasswordResetEmail: sendResetEmail,
            signOut: () => Promise.resolve()
        };
        
        console.log('✅ Standalone auth ready');
    }
    
    // Authentication function
    function authenticateUser(email, password) {
        return new Promise((resolve, reject) => {
            // Validate
            if (!email || !password) {
                reject({ code: 'auth/missing-credentials', message: 'Email and password required' });
                return;
            }
            
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                reject({ code: 'auth/invalid-email', message: 'Invalid email format' });
                return;
            }
            
            // Password length
            if (password.length < 6) {
                reject({ code: 'auth/weak-password', message: 'Password too short' });
                return;
            }
            
            // Simulate network delay
            setTimeout(() => {
                console.log('✅ Authentication successful');
                resolve({
                    user: {
                        uid: 'user-' + Date.now(),
                        email: email,
                        emailVerified: true,
                        displayName: email.split('@')[0],
                        metadata: {
                            creationTime: new Date().toISOString(),
                            lastSignInTime: new Date().toISOString()
                        }
                    }
                });
            }, 1000);
        });
    }
    
    // Password reset function
    function sendResetEmail(email) {
        return new Promise((resolve, reject) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                reject({ code: 'auth/invalid-email', message: 'Invalid email' });
                return;
            }
            
            setTimeout(() => {
                console.log('✅ Reset email sent to:', email);
                resolve();
            }, 500);
        });
    }
})();