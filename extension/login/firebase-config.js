// Firebase Configuration
console.log('⚙️ Loading Firebase config...');

// Configuration object
const firebaseConfig = {
    apiKey: "AIzaSyCPr3W0cIVpACRScu-GfqjVYTq2ZfFu3hc",
  authDomain: "cyber-kavach-vpn.firebaseapp.com",
  projectId: "cyber-kavach-vpn",
  storageBucket: "cyber-kavach-vpn.firebasestorage.app",
  messagingSenderId: "594270548686",
  appId: "1:594270548686:web:524241325a3eacd3c1569f"
};

// Initialize function
function initializeFirebaseApp() {
    console.log('🚀 Initializing Firebase app...');
    
    try {
        // Check if firebase exists
        if (!window.firebase || typeof window.firebase.initializeApp !== 'function') {
            console.error('❌ Firebase not available');
            return null;
        }
        
        // Initialize app
        const app = window.firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase app initialized:', app.name);
        
        return app;
        
    } catch (error) {
        console.error('❌ Firebase init error:', error);
        
        // If already initialized
        if (error.code === 'app/duplicate-app') {
            console.log('📌 Using existing Firebase app');
            return window.firebase.app();
        }
        
        return null;
    }
}

// Initialize when ready
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const app = initializeFirebaseApp();
        if (app) {
            console.log('🎉 Firebase ready for authentication');
        } else {
            console.warn('⚠️ Firebase not available, using fallback auth');
        }
    }, 1000);
});