// ===== AUTO ML-SCANNING VERSION =====
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

// ===== INITIALIZE =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log("📋 DOM loaded, initializing...");
    
    try {
        // Check if elements exist
        console.log("🔍 Checking elements:");
        console.log("- Scan Button:", !!scanBtn);
        console.log("- Current URL:", !!currentUrl);
        
        // Load stats
        await loadStats();
        
        // Get current tab and auto-run ML scan
        await updateCurrentTab();
        
        // Setup all event listeners
        setupAllListeners();
        
        // Setup tabs
        setupTabs();
        
        console.log("✅ Popup ready!");
        
    } catch (error) {
        console.error("❌ Initialization failed:", error);
        showError("Failed to initialize");
    }
});

// Listen for report confirmation from background
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
        
        // Auto-run ML scan when popup opens
        if (url && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://')) {
            const analysis = await mlScan(url);  // <-- GET THE ANALYSIS RETURN VALUE
            
            // Check if high risk and notify background
            if (analysis && analysis.score >= 80) {
                console.log(`🚨 High risk detected (${analysis.score}/100), checking auto-block...`);
                
                try {
                    // Check settings for auto-block
                    const settings = await chrome.storage.local.get(['settings']);
                    const shouldAutoBlock = settings.settings?.blockDangerous !== false;
                    
                    if (shouldAutoBlock && analysis.score >= 80) {
                        console.log(`🛑 High risk + auto-block enabled, blocking: ${url}`);
                        
                        // Report/block the site
                        await chrome.runtime.sendMessage({
                            type: 'REPORT_SITE',
                            url: url
                        });
                        
                        // Show notification
                        if (analysis.score >= 90) {
                            alert(`🚨 EXTREME RISK DETECTED (${analysis.score}/100)\n\nThis website appears to be phishing/malicious.\n\nCyber Kavach has blocked this site.`);
                        }
                    }
                } catch (error) {
                    console.error('Error checking auto-block:', error);
                }
            }
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
    
    let analysis = null; // <-- DECLARE analysis HERE
    
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
        analysis = {  // <-- ASSIGN TO analysis VARIABLE
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
        analysis = performLocalAnalysis(url);  // <-- ASSIGN TO analysis HERE TOO
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
    
    // Now analysis is guaranteed to be defined
    return analysis; // <-- RETURN analysis AT THE END
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
    
    // Whitelist Button
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
    
    // Report Button
    if (reportBtn) {
        reportBtn.addEventListener('click', async () => {
            if (!currentTab?.url) {
                console.error('❌ No current tab URL');
                return;
            }
            
            console.log('📢 Report button clicked for:', currentTab.url);
            
            try {
                // Direct storage update
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
        
        console.log('📊 Applied to UI:', {
            protectionLevel: protectionLevel?.value,
            autoScan: autoScan?.checked,
            blockDangerous: blockDangerous?.checked
        });
        
    } catch (error) {
        console.error('❌ Error loading settings:', error);
    }
}

async function saveSettings() {
    try {
        // Get current settings values
        const settings = {
            protectionLevel: document.getElementById('protectionLevel')?.value || 'medium',
            autoScan: document.getElementById('autoScan')?.checked || false,
            blockDangerous: document.getElementById('blockDangerous')?.checked || false,
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
            settings: settings
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
    if (confirm('Are you sure you want to clear all data? This will reset:\n• Scan history\n• Whitelist/Blacklist\n• Reports')) {
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

// DEBUG: Test function to check current settings
async function debugCurrentSettings() {
    const all = await chrome.storage.local.get(null);
    console.log('🔍 ALL STORED SETTINGS:', all);
    
    // Check specific settings
    console.log('📊 Current settings:');
    console.log('- autoScan:', all.autoScan);
    console.log('- blockDangerous:', all.blockDangerous);
    console.log('- protectionLevel:', all.protectionLevel);
    console.log('- whitelist:', all.whitelist?.length || 0, 'sites');
    console.log('- blacklist:', all.blacklist?.length || 0, 'sites');
}

// Call it when popup opens for debugging
debugCurrentSettings();


