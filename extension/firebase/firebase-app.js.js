// Firebase
(function() {
    'use strict';
    
    console.log('📦 Loading Firebase App SDK...');
    
    // Check if already loaded
    if (window.firebase) {
        console.log('✅ Firebase already loaded');
        return;
    }
    
    // Create Firebase object
    window.firebase = {
        // Initialize Firebase App
        initializeApp: function(config, name) {
            name = name || '[DEFAULT]';
            console.log('🔥 Firebase App initialized:', name);
            
            const app = {
                name: name,
                options: config,
                delete: function() {
                    console.log('App deleted:', name);
                }
            };
            
            // Store app
            this._apps = this._apps || {};
            this._apps[name] = app;
            
            return app;
        },
        
        // Get existing app
        app: function(name) {
            name = name || '[DEFAULT]';
            return this._apps ? this._apps[name] : null;
        },
        
        // Get all apps
        apps: function() {
            return this._apps ? Object.values(this._apps) : [];
        }
    };
    
    console.log('✅ Firebase App SDK loaded successfully');
})();