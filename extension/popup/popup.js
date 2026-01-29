// ===== CYBER KAVACH WITH SUBSCRIPTION SYSTEM =====
console.log("🚀 Cyber Kavach Popup loaded!");

// DOM Elements
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const currentUrl = document.getElementById('currentUrl');
const scoreValue = document.getElementById('scoreValue');
const scoreFill = document.getElementById('scoreFill');
const warningsList = document.getElementById('warningsList');
const scannedCount = document.getElementById('scannedCount');
const blockedCount = document.getElementById('blockedCount');
const userEmail = document.getElementById('userEmail');
const logoutLink = document.getElementById('logoutLink');

// Buttons
const scanBtn = document.getElementById('scanBtn');
const whitelistBtn = document.getElementById('whitelistBtn');
const reportBtn = document.getElementById('reportBtn');

// Tab elements
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// State
let currentTab = null;
let lastAnalysis = null;
let userSubscription = 'free';
let userFeatures = {};


// ===== LOADING STATE =====
function showLoadingState() {
    console.log("⏳ Showing loading state...");
    
    // Show loading in UI
    if (statusText) statusText.textContent = 'Loading...';
    if (statusDot) {
        statusDot.className = 'status-dot warning';
        statusDot.style.animation = 'pulse 1s infinite';
    }
    if (currentUrl) currentUrl.textContent = 'Loading authentication...';
    if (scoreValue) scoreValue.textContent = '--';
    if (scoreFill) scoreFill.style.width = '0%';
    if (warningsList) warningsList.textContent = 'Checking user session...';
    
    // Disable buttons
    if (scanBtn) scanBtn.disabled = true;
    if (whitelistBtn) whitelistBtn.disabled = true;
    if (reportBtn) reportBtn.disabled = true;
}

function hideLoadingState() {
    console.log("✅ Loading state hidden");
    
    // Re-enable buttons (will be adjusted by subscription later)
    if (scanBtn) scanBtn.disabled = false;
    if (whitelistBtn) whitelistBtn.disabled = false;
    if (reportBtn) reportBtn.disabled = false;
}




// ===== AUTHENTICATION CHECK WITH DELAY =====
async function checkAuthentication() {
    console.log("🔐 Checking authentication...");
    
    // Show loading state immediately
    showLoadingState();
    
    try {
        // Add a small delay to ensure storage is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const data = await chrome.storage.local.get([
            'userLoggedIn', 
            'userEmail', 
            'userName', 
            'userSubscription',
            'userFeatures'
        ]);
        
        console.log("📊 Auth check data:", data);
        
        if (!data.userLoggedIn) {
            console.log('❌ User not logged in, redirecting to login...');
            hideLoadingState();
            window.location.href = '../login/login.html';
            return false;
        }
        
        // Store user data
        userSubscription = data.userSubscription || 'free';
        userFeatures = data.userFeatures || {};
        
        console.log('✅ User authenticated:', data.userEmail);
        console.log('💰 Subscription:', userSubscription);
        console.log('🎯 Features:', userFeatures);
        
        // Display user info in footer
        if (userEmail && data.userEmail) {
            const displayName = data.userName || data.userEmail.split('@')[0];
            userEmail.textContent = `${displayName} (${userSubscription.toUpperCase()})`;
            
            // Add subscription badge
            const badge = document.createElement('span');
            badge.className = 'subscription-badge';
            badge.textContent = userSubscription === 'paid' ? '⭐ PRO' : '🆓 FREE';
            badge.style.marginLeft = '8px';
            badge.style.fontSize = '10px';
            badge.style.padding = '2px 6px';
            badge.style.borderRadius = '4px';
            badge.style.background = userSubscription === 'paid' 
                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                : '#6b7280';
            badge.style.color = 'white';
            badge.style.fontWeight = 'bold';
            
            userEmail.appendChild(badge);
        }
        
        // Hide loading state
        hideLoadingState();
        
        // Apply subscription-based restrictions
        applySubscriptionRestrictions();
        
        return true;
        
    } catch (error) {
        console.error('❌ Auth check error:', error);
        hideLoadingState();
        
        // Don't redirect immediately on error - try to continue
        showError("Authentication error. Please refresh.");
        return false;
    }
}


// ===== APPLY SUBSCRIPTION RESTRICTIONS =====
function applySubscriptionRestrictions() {
    console.log('🔒 Applying subscription restrictions...');
    
    // Update UI based on subscription
    if (userSubscription === 'free') {
        console.log('🆓 FREE user - Limited features');
        
        // Disable auto-scan in settings
        const autoScanCheckbox = document.getElementById('autoScan');
        const blockDangerousCheckbox = document.getElementById('blockDangerous');
        
        if (autoScanCheckbox) {
            autoScanCheckbox.checked = false;
            autoScanCheckbox.disabled = true;
            autoScanCheckbox.parentElement.style.opacity = '0.6';
        }
        
        if (blockDangerousCheckbox) {
            blockDangerousCheckbox.checked = false;
            blockDangerousCheckbox.disabled = true;
            blockDangerousCheckbox.parentElement.style.opacity = '0.6';
        }
        
        // Add info message about free tier
        addSubscriptionNotice();
        
    } else {
        console.log('⭐ PAID user - Full features');
        
        // Enable all features
        const autoScanCheckbox = document.getElementById('autoScan');
        const blockDangerousCheckbox = document.getElementById('blockDangerous');
        
        if (autoScanCheckbox) {
            autoScanCheckbox.disabled = false;
            autoScanCheckbox.parentElement.style.opacity = '1';
        }
        
        if (blockDangerousCheckbox) {
            blockDangerousCheckbox.disabled = false;
            blockDangerousCheckbox.parentElement.style.opacity = '1';
        }
    }
    
    // Update background script with subscription info
    updateBackgroundSubscription();
}

// Add subscription notice for free users
function addSubscriptionNotice() {
    const mainTab = document.getElementById('main-tab');
    if (!mainTab) return;
    
    // Check if notice already exists
    if (document.getElementById('subscriptionNotice')) return;
    
    const notice = document.createElement('div');
    notice.id = 'subscriptionNotice';
    notice.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            padding: 12px 16px;
            border-radius: 10px;
            margin-bottom: 15px;
            border-left: 4px solid #f59e0b;
            font-size: 13px;
            line-height: 1.4;
        ">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                <span style="font-size: 18px;">🆓</span>
                <strong>Free Plan Active</strong>
            </div>
            <p style="margin: 5px 0; opacity: 0.9;">
                Manual scanning only. Upgrade to <strong>PRO</strong> for:
            </p>
            <ul style="margin: 8px 0 5px 15px; opacity: 0.9;">
                <li>✅ Automatic ML scanning</li>
                <li>✅ Auto-block dangerous sites</li>
                <li>✅ Red screen protection</li>
                <li>✅ Advanced protection settings</li>
            </ul>
            <button id="upgradeBtn" style="
                margin-top: 8px;
                padding: 6px 12px;
                background: #f59e0b;
                color: #451a03;
                border: none;
                border-radius: 6px;
                font-weight: bold;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 6px;
            ">
                ⭐ Upgrade to PRO
            </button>
        </div>
    `;
    
    // Insert at the beginning of main tab
    mainTab.insertBefore(notice, mainTab.firstChild);
    
    // Add upgrade button handler
    document.getElementById('upgradeBtn').addEventListener('click', () => {
        chrome.tabs.create({ url: '#' });
    });
}

// Update background script with subscription info
async function updateBackgroundSubscription() {
    try {
        await chrome.runtime.sendMessage({
            type: 'UPDATE_SUBSCRIPTION',
            subscription: userSubscription,
            features: userFeatures
        });
        console.log('✅ Subscription sent to background:', userSubscription);
    } catch (error) {
        console.error('Error updating background subscription:', error);
    }
}

// ===== LOGOUT FUNCTION =====
async function logoutUser() {
    try {
        // Clear all user data
        await chrome.storage.local.remove([
            'userLoggedIn', 
            'userEmail', 
            'userId', 
            'userName',
            'userSubscription',
            'userFeatures',
            'lastLogin'
        ]);
        
        console.log('User logged out successfully');
        
        // Redirect to login page
        window.location.href = '../login/login.html';
        
    } catch (error) {
        console.error('Logout error:', error);
        alert('Logout failed. Please try again.');
    }
}

// ===== INITIALIZE WITH RETRY LOGIC =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log("📋 DOM loaded, initializing...");
    
    try {
        // Check authentication first with retry
        let authAttempts = 0;
        const maxAuthAttempts = 3;
        let isAuthenticated = false;
        
        while (authAttempts < maxAuthAttempts && !isAuthenticated) {
            authAttempts++;
            console.log(`🔄 Authentication attempt ${authAttempts}/${maxAuthAttempts}`);
            
            isAuthenticated = await checkAuthentication();
            
            if (!isAuthenticated && authAttempts < maxAuthAttempts) {
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 300));
            }
        }
        
        if (!isAuthenticated) {
            console.log("❌ Authentication failed after all attempts");
            return;
        }
        
        console.log("✅ Authentication successful, continuing initialization...");
        
        // Load stats
        await loadStats();
        
        // Get current tab
        await updateCurrentTab();
        
        // Setup all event listeners
        setupAllListeners();
        
        // Setup tabs
        setupTabs();
        
        console.log("🎉 Popup fully initialized!");
        
    } catch (error) {
        console.error("❌ Initialization failed:", error);
        showError("Failed to initialize. Please try again.");
        hideLoadingState();
    }
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'REPORT_CONFIRMED') {
        console.log('✅ Report confirmed:', message.url);
    }
});

// ===== CORE FUNCTIONS =====
async function updateCurrentTab() {
    console.log("🔄 Fetching current tab...");
    
    try {
        // Get the current active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tabs || tabs.length === 0) {
            throw new Error("No active tab found");
        }
        
        currentTab = tabs[0];
        const url = currentTab.url || '';
        
        console.log("🌐 Current tab URL:", url);
        
        // Update UI with URL
        if (currentUrl) {
            currentUrl.textContent = url.length > 50 ? url.substring(0, 47) + '...' : url;
        }
        
        // Auto-run ML scan for PAID users only
        if (userSubscription === 'paid' && url && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://')) {
            console.log('⭐ PAID user - Auto-scanning...');
            const analysis = await mlScan(url);
            
            // Check if high risk (only for paid users)
            if (analysis && analysis.score >= 80 && userFeatures.autoBlock) {
                console.log(`🚨 High risk detected (${analysis.score}/100), checking auto-block...`);
                
                try {
                    await chrome.runtime.sendMessage({
                        type: 'REPORT_SITE',
                        url: url,
                        riskScore: analysis.score
                    });
                    
                    if (analysis.score >= 90) {
                        alert(`🚨 EXTREME RISK DETECTED (${analysis.score}/100)\n\nThis website appears to be phishing/malicious.\n\nCyber Kavach PRO has blocked this site.`);
                    }
                } catch (error) {
                    console.error('Error checking auto-block:', error);
                }
            }
        } else if (url && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://')) {
            showInfo("Click 'Scan URL with ML' to check this site");
        } else {
            showInfo("Chrome pages cannot be scanned");
        }
        
    } catch (error) {
        console.error("❌ Failed to get current tab:", error);
        if (currentUrl) {
            currentUrl.textContent = "Cannot access this page";
        }
        showError("Cannot analyze this page");
    }
}

// ===== ML SCAN FUNCTION =====
async function mlScan(url) {
    console.log("🧠 Starting ML scan...");
    
    // Show scanning status
    updateDisplay({
        score: 0,
        warnings: ["🔄 Connecting to ML server..."],
        source: 'scanning'
    });
    
    if (scanBtn) {
        scanBtn.innerHTML = '⏳ Analyzing...';
        scanBtn.disabled = true;
    }
    
    let analysis = null;
    
    try {
        console.log("🌐 Connecting to ML backend...");
        const response = await fetch("http://127.0.0.1:5000/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ url: url }),
            timeout: 10000 // 10 second timeout
        });
        
        if (!response.ok) {
            throw new Error(`Backend error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("✅ ML Analysis result:", data);
        
        // Create analysis object
        analysis = {
            score: data.risk_score || 0,
            warnings: [
                data.prediction === "Phishing" 
                    ? "🚨 ML model detected phishing" 
                    : "✅ ML model says safe",
                `Confidence: ${(data.confidence * 100).toFixed(1)}%`,
                data.prediction || "Unknown"
            ],
            timestamp: Date.now(),
            source: 'ml',
            confidence: data.confidence,
            mlData: data
        };
        
        // Add feature-based warnings
        if (data.features) {
            addFeatureWarnings(analysis, data.features);
        }
        
        lastAnalysis = analysis;
        updateDisplay(analysis);
        
        console.log("✅ ML scan complete");
        
        // Update scan count
        await updateScanCount();
        
    } catch (error) {
        console.error("❌ ML scan failed:", error);
        
        // Fallback to local analysis
        analysis = performLocalAnalysis(url);
        analysis.warnings.push("⚠️ ML scan failed, using local analysis");
        updateDisplay(analysis);
        
    } finally {
        if (scanBtn) {
            setTimeout(() => {
                scanBtn.innerHTML = '🔍 Scan URL with ML';
                scanBtn.disabled = false;
            }, 500);
        }
    }
    
    return analysis;
}

// ===== LOCAL ANALYSIS FALLBACK =====
function performLocalAnalysis(url) {
    console.log("📊 Performing local analysis...");
    
    let score = 0;
    let warnings = [];
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        // === SAFE INDICATORS ===
        if (urlObj.protocol === 'https:') {
            score -= 20;
        }
        
        // === DANGEROUS INDICATORS ===
        if (urlObj.protocol !== 'https:') {
            warnings.push('⚠️ Not using HTTPS');
            score += 30;
        }
        
        // IP Address
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipPattern.test(hostname)) {
            warnings.push('🚨 Uses IP address');
            score += 40;
        }
        
        // Suspicious TLDs
        const suspiciousTLDs = ['.xyz', '.top', '.club', '.info', '.bid', '.win', '.tk', '.ml', '.ga', '.cf', '.gq'];
        const hasSuspiciousTLD = suspiciousTLDs.some(tld => hostname.endsWith(tld));
        if (hasSuspiciousTLD) {
            warnings.push('⚠️ Suspicious domain extension');
            score += 25;
        }
        
        // Multiple dashes
        const dashCount = (hostname.match(/-/g) || []).length;
        if (dashCount >= 2) {
            warnings.push(`⚠️ ${dashCount} dashes in domain`);
            score += dashCount * 10;
        }
        
        // Brand impersonation
        const brands = ['facebook', 'google', 'microsoft', 'apple', 'amazon', 'paypal'];
        const isBrandImpersonation = brands.some(brand => {
            return hostname.includes(brand) && !hostname.endsWith(`${brand}.com`);
        });
        
        if (isBrandImpersonation) {
            warnings.push(`🚨 Possible brand impersonation`);
            score += 50;
        }
        
        // Ensure score is between 0-100
        score = Math.max(0, Math.min(100, score));
        
    } catch (error) {
        warnings.push('🚨 Invalid URL format');
        score = 70;
    }
    
    return {
        score: score,
        warnings: warnings,
        timestamp: Date.now(),
        source: 'local'
    };
}

// ===== FEATURE WARNINGS =====
function addFeatureWarnings(analysis, features) {
    const warnings = analysis.warnings || [];
    
    if (features.has_ipv4) {
        warnings.push('🚨 Contains IP address');
    }
    
    if (features.suspicious_tld) {
        warnings.push('⚠️ Suspicious domain extension');
    }
    
    if (features.phishing_keyword) {
        warnings.push('⚠️ Contains phishing keywords');
    }
    
    if (features.brand_in_path) {
        warnings.push('⚠️ Brand name in URL path');
    }
    
    if (features.has_at_symbol) {
        warnings.push('🚨 Contains @ symbol');
    }
    
    if (features.num_subdomains > 2) {
        warnings.push(`⚠️ ${features.num_subdomains} subdomains`);
    }
    
    analysis.warnings = warnings;
    return analysis;
}

// ===== UI UPDATES =====
function updateDisplay(analysis) {
    console.log("🎨 Updating display with score:", analysis.score);
    
    // Update score
    const score = analysis.score || 0;
    if (scoreValue) scoreValue.textContent = `${score}/100`;
    if (scoreFill) scoreFill.style.width = `${score}%`;
    
    // Update status
    if (statusDot && statusText) {
        if (score < 30) {
            statusDot.className = 'status-dot';
            statusText.textContent = 'Safe';
        } else if (score < 70) {
            statusDot.className = 'status-dot warning';
            statusText.textContent = 'Suspicious';
        } else {
            statusDot.className = 'status-dot danger';
            statusText.textContent = 'Dangerous';
        }
    }
    
    // Update warnings
    if (warningsList) {
        if (analysis.warnings && analysis.warnings.length > 0) {
            warningsList.innerHTML = analysis.warnings
                .map(w => `<div class="warning-item">${w}</div>`)
                .join('');
        } else {
            warningsList.textContent = 'No warnings detected';
        }
    }
    
    console.log(`📊 Display updated: ${score}/100`);
}

function showError(message) {
    if (scoreValue) scoreValue.textContent = '--';
    if (scoreFill) scoreFill.style.width = '0%';
    if (statusDot && statusText) {
        statusDot.className = 'status-dot warning';
        statusText.textContent = 'Error';
    }
    if (warningsList) warningsList.textContent = message;
}

function showInfo(message) {
    if (scoreValue) scoreValue.textContent = '--';
    if (scoreFill) scoreFill.style.width = '0%';
    if (statusDot && statusText) {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Info';
    }
    if (warningsList) warningsList.textContent = message;
}

// ===== BUTTON HANDLERS =====
function setupAllListeners() {
    console.log("🔘 Setting up all listeners...");
    
    // Scan Button
    if (scanBtn) {
        scanBtn.addEventListener('click', async () => {
            console.log("🔍 Scan clicked");
            if (currentTab && currentTab.url) {
                await mlScan(currentTab.url);
            }
        });
    } else {
        console.error("❌ Scan button not found!");
    }
    
    // Whitelist Button (available for all users)
    if (whitelistBtn) {
        whitelistBtn.addEventListener('click', async () => {
            if (!currentTab?.url) return;
            
            try {
                const urlObj = new URL(currentTab.url);
                const whitelistData = await chrome.storage.local.get(['whitelist']);
                const whitelist = whitelistData.whitelist || [];
                
                if (!whitelist.includes(urlObj.hostname)) {
                    whitelist.push(urlObj.hostname);
                    await chrome.storage.local.set({ whitelist: whitelist });
                    
                    whitelistBtn.innerHTML = '✅ Whitelisted!';
                    setTimeout(() => {
                        whitelistBtn.innerHTML = '✅ Whitelist';
                    }, 2000);
                    
                    // Re-analyze with whitelist consideration
                    if (lastAnalysis) {
                        lastAnalysis.score = Math.min(lastAnalysis.score, 10);
                        updateDisplay(lastAnalysis);
                    }
                }
            } catch (error) {
                console.error("Whitelist error:", error);
            }
        });
    }
    
    // Report Button (available for all users)
    if (reportBtn) {
        reportBtn.addEventListener('click', async () => {
            if (!currentTab?.url) {
                console.error('❌ No current tab URL');
                return;
            }
            
            console.log('📢 Report button clicked for:', currentTab.url);
            
            try {
                const data = await chrome.storage.local.get(['blacklist', 'blockedCount']);
                let blacklist = data.blacklist || [];
                let blockedCount = data.blockedCount || 0;
                
                const urlObj = new URL(currentTab.url);
                const hostname = urlObj.hostname;
                
                if (!blacklist.includes(hostname)) {
                    blacklist.push(hostname);
                    await chrome.storage.local.set({ 
                        blacklist: blacklist,
                        blockedCount: blockedCount + 1 
                    });
                    
                    console.log('✅ Site reported successfully');
                    
                    // Update UI
                    if (blockedCount) {
                        blockedCount.textContent = blockedCount + 1;
                    }
                    
                    // Update button
                    reportBtn.innerHTML = '✅ Reported!';
                    reportBtn.classList.remove('btn-danger');
                    reportBtn.classList.add('btn-secondary');
                    reportBtn.disabled = true;
                    
                    // Update risk display
                    if (lastAnalysis) {
                        lastAnalysis.score = 95;
                        lastAnalysis.warnings.push("🚨 Manually reported as phishing");
                        updateDisplay(lastAnalysis);
                    }
                    
                    // Reset button after 3 seconds
                    setTimeout(() => {
                        reportBtn.innerHTML = '⚠️ Report';
                        reportBtn.classList.remove('btn-secondary');
                        reportBtn.classList.add('btn-danger');
                        reportBtn.disabled = false;
                    }, 3000);
                    
                } else {
                    alert('This site is already in the blacklist!');
                }
                
            } catch (error) {
                console.error("❌ Report error:", error);
                reportBtn.innerHTML = '❌ Failed';
                setTimeout(() => {
                    reportBtn.innerHTML = '⚠️ Report';
                }, 2000);
            }
        });
    }
    
    // Logout Link
    if (logoutLink) {
        logoutLink.addEventListener('click', async (e) => {
            e.preventDefault();
            
            if (confirm('Are you sure you want to logout from Cyber Kavach?')) {
                await logoutUser();
            }
        });
    }
    
    // Settings buttons
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    
    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', clearAllData);
    }
}

// ===== UTILITY FUNCTIONS =====
async function updateScanCount() {
    try {
        const stats = await chrome.storage.local.get(['scannedCount']);
        const newCount = (stats.scannedCount || 0) + 1;
        await chrome.storage.local.set({ scannedCount: newCount });
        if (scannedCount) scannedCount.textContent = newCount;
    } catch (error) {
        console.error("Error updating scan count:", error);
    }
}

async function loadStats() {
    try {
        const stats = await chrome.storage.local.get(['scannedCount', 'blockedCount']);
        if (scannedCount) scannedCount.textContent = stats.scannedCount || 0;
        if (blockedCount) blockedCount.textContent = stats.blockedCount || 0;
    } catch (error) {
        console.error("Error loading stats:", error);
    }
}

// ===== TABS FUNCTIONALITY =====
function setupTabs() {
    if (!tabBtns.length) return;
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Update tab visibility
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const tabContent = document.getElementById(`${tabId}-tab`);
            if (tabContent) tabContent.classList.add('active');
            
            console.log(`📑 Switched to ${tabId} tab`);
            
            // Refresh main tab when switching to it
            if (tabId === 'main') {
                updateCurrentTab();
            }
            
            // Load settings when switching to settings tab
            if (tabId === 'settings') {
                loadSettings();
            }
        });
    });
}

// ===== SETTINGS FUNCTIONS =====
async function loadSettings() {
    try {
        // Load settings
        const settings = await chrome.storage.local.get([
            'protectionLevel',
            'autoScan', 
            'blockDangerous',
            'showWarnings',
            'soundAlerts',
            'shareReports'
        ]);
        
        console.log('📥 Loaded settings from storage:', settings);
        
        // Apply to UI
        const protectionLevel = document.getElementById('protectionLevel');
        const autoScan = document.getElementById('autoScan');
        const blockDangerous = document.getElementById('blockDangerous');
        const showWarnings = document.getElementById('showWarnings');
        const soundAlerts = document.getElementById('soundAlerts');
        const shareReports = document.getElementById('shareReports');
        
        if (protectionLevel) protectionLevel.value = settings.protectionLevel || 'medium';
        if (autoScan) autoScan.checked = settings.autoScan || false;
        if (blockDangerous) blockDangerous.checked = settings.blockDangerous || false;
        if (showWarnings) showWarnings.checked = settings.showWarnings || false;
        if (soundAlerts) soundAlerts.checked = settings.soundAlerts || false;
        if (shareReports) shareReports.checked = settings.shareReports || false;
        
        // Disable paid features for free users
        if (userSubscription === 'free') {
            if (autoScan) {
                autoScan.checked = false;
                autoScan.disabled = true;
            }
            if (blockDangerous) {
                blockDangerous.checked = false;
                blockDangerous.disabled = true;
            }
        }
        
    } catch (error) {
        console.error('❌ Error loading settings:', error);
    }
}

async function saveSettings() {
    try {
        // Get current settings values
        const settings = {
            protectionLevel: document.getElementById('protectionLevel')?.value || 'medium',
            autoScan: userSubscription === 'paid' ? (document.getElementById('autoScan')?.checked || false) : false,
            blockDangerous: userSubscription === 'paid' ? (document.getElementById('blockDangerous')?.checked || false) : false,
            showWarnings: document.getElementById('showWarnings')?.checked || false,
            soundAlerts: document.getElementById('soundAlerts')?.checked || false,
            shareReports: document.getElementById('shareReports')?.checked || false
        };
        
        console.log('💾 Saving settings:', settings);
        
        // Save ALL settings at once
        await chrome.storage.local.set(settings);
        
        // Also save as a settings object for backward compatibility
        await chrome.storage.local.set({ settings: settings });
        
        // Notify background script
        await chrome.runtime.sendMessage({
            type: 'UPDATE_SETTINGS',
            settings: settings,
            subscription: userSubscription
        });
        
        // Show confirmation
        const saveBtn = document.getElementById('saveSettingsBtn');
        if (saveBtn) {
            const originalText = saveBtn.textContent;
            saveBtn.textContent = '✅ Saved!';
            saveBtn.disabled = true;
            
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }, 1500);
        }
        
    } catch (error) {
        console.error('❌ Error saving settings:', error);
        alert('Failed to save settings: ' + error.message);
    }
}

function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This will reset:\n• Scan history\n• Whitelist/Blacklist\n• Reports\n\nNote: This will NOT logout your account.')) {
        chrome.storage.local.set({
            scannedCount: 0,
            blockedCount: 0,
            whitelist: [],
            blacklist: [],
            reports: []
        }, () => {
            // Update UI
            if (scannedCount) scannedCount.textContent = '0';
            if (blockedCount) blockedCount.textContent = '0';
            
            // Show confirmation
            const clearBtn = document.getElementById('clearDataBtn');
            if (clearBtn) {
                const originalText = clearBtn.textContent;
                clearBtn.textContent = '✅ Cleared!';
                clearBtn.disabled = true;
                
                setTimeout(() => {
                    clearBtn.textContent = originalText;
                    clearBtn.disabled = false;
                }, 1500);
            }
        });
    }
}