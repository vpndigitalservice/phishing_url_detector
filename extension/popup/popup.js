// ===== CLEAR DUAL-SCAN VERSION =====
console.log("🚀 Phish Guard Popup loaded!");

// DOM Elements
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const currentUrl = document.getElementById('currentUrl');
const scoreValue = document.getElementById('scoreValue');
const scoreFill = document.getElementById('scoreFill');
const warningsList = document.getElementById('warningsList');
const scannedCount = document.getElementById('scannedCount');
const blockedCount = document.getElementById('blockedCount');

// Buttons - NEW NAMES!
const quickScanBtn = document.getElementById('quickScanBtn');
const deepScanBtn = document.getElementById('deepScanBtn');
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
        console.log("- Quick Scan Button:", !!quickScanBtn);
        console.log("- Deep Scan Button:", !!deepScanBtn);
        console.log("- Current URL:", !!currentUrl);
        
        // Load stats
        await loadStats();
        
        // Get current tab and auto-run quick scan
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
        
        // Auto-run quick scan when popup opens
        if (url && !url.startsWith('chrome://') && !url.startsWith('chrome-extension://')) {
            await quickScan(url);
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

// ===== SCAN FUNCTIONS =====
async function quickScan(url) {
    console.log("⚡ Starting QUICK scan...");
    
    if (quickScanBtn) {
        quickScanBtn.innerHTML = '⏳ Scanning...';
        quickScanBtn.disabled = true;
    }
    
    try {
        // Perform quick analysis (local rules only)
        const analysis = performQuickAnalysis(url);
        lastAnalysis = analysis;
        
        // Update display
        updateDisplay(analysis);
        
        console.log("✅ Quick scan complete:", analysis.score);
        
        // Update scan count
        await updateScanCount();
        
    } catch (error) {
        console.error("❌ Quick scan failed:", error);
        showError("Quick scan failed");
    } finally {
        if (quickScanBtn) {
            setTimeout(() => {
                quickScanBtn.innerHTML = '⚡ Quick Check';
                quickScanBtn.disabled = false;
            }, 500);
        }
    }
}

async function deepScan(url) {
    console.log("🧠 Starting DEEP ML scan...");
    
    if (deepScanBtn) {
        deepScanBtn.innerHTML = '⏳ ML Analyzing...';
        deepScanBtn.disabled = true;
    }
    
    try {
        // First show quick results immediately
        const quickAnalysis = performQuickAnalysis(url);
        updateDisplay(quickAnalysis);
        
        // Then try ML analysis
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
        
        // Create combined analysis
        const mlAnalysis = {
            score: data.risk_score || quickAnalysis.score,
            warnings: [
                data.prediction === "Phishing" 
                    ? "🚨 ML model detected phishing" 
                    : "✅ ML model says safe",
                ...quickAnalysis.warnings
            ],
            timestamp: Date.now(),
            source: 'ml',
            confidence: data.confidence,
            mlData: data
        };
        
        lastAnalysis = mlAnalysis;
        updateDisplay(mlAnalysis);
        
        console.log("✅ Deep ML scan complete");
        
        // Update scan count
        await updateScanCount();
        
    } catch (error) {
        console.error("❌ Deep scan failed:", error);
        
        // Fallback to quick analysis
        const fallbackAnalysis = performQuickAnalysis(url);
        fallbackAnalysis.warnings.push("⚠️ ML scan failed, using local rules");
        updateDisplay(fallbackAnalysis);
        
    } finally {
        if (deepScanBtn) {
            setTimeout(() => {
                deepScanBtn.innerHTML = '🧠 Deep ML Scan';
                deepScanBtn.disabled = false;
            }, 500);
        }
    }
}

// ===== ANALYSIS FUNCTIONS =====
function performQuickAnalysis(url) {
    console.log("📊 Performing quick analysis...");
    
    let score = 0;
    let warnings = [];
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        // === SAFE INDICATORS ===
        if (urlObj.protocol === 'https:') {
            score -= 25;
        }
        
        // === DANGEROUS INDICATORS ===
        if (urlObj.protocol !== 'https:') {
            warnings.push('⚠️ Not using HTTPS');
            score += 40;
        }
        
        // IP Address
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipPattern.test(hostname)) {
            warnings.push('🚨 Uses IP address');
            score += 70;
        }
        
        // Suspicious TLDs
        const suspiciousTLDs = ['.xyz', '.top', '.club', '.info', '.bid', '.win', '.tk', '.ml', '.ga', '.cf', '.gq'];
        const hasSuspiciousTLD = suspiciousTLDs.some(tld => hostname.endsWith(tld));
        if (hasSuspiciousTLD) {
            warnings.push('⚠️ Suspicious domain extension');
            score += 35;
        }
        
        // Multiple dashes
        const dashCount = (hostname.match(/-/g) || []).length;
        if (dashCount >= 2) {
            warnings.push(`⚠️ ${dashCount} dashes in domain`);
            score += dashCount * 12;
        }
        
        // Brand impersonation
        const brands = ['facebook', 'google', 'microsoft', 'apple', 'amazon', 'paypal'];
        const isBrandImpersonation = brands.some(brand => {
            return hostname.includes(brand) && !hostname.endsWith(`${brand}.com`);
        });
        
        if (isBrandImpersonation) {
            warnings.push(`🚨 Possible brand impersonation`);
            score += 60;
        }
        
        // Ensure score is between 0-100
        score = Math.max(0, Math.min(100, score));
        
    } catch (error) {
        warnings.push('🚨 Invalid URL format');
        score = 80;
    }
    
    return {
        score: score,
        warnings: warnings,
        timestamp: Date.now(),
        source: 'quick'
    };
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
    
    // Quick Scan Button
    if (quickScanBtn) {
        quickScanBtn.addEventListener('click', async () => {
            console.log("⚡ Quick Check clicked");
            if (currentTab && currentTab.url) {
                await quickScan(currentTab.url);
            }
        });
    } else {
        console.error("❌ Quick Scan button not found!");
    }
    
    // Deep Scan Button
    if (deepScanBtn) {
        deepScanBtn.addEventListener('click', async () => {
            console.log("🧠 Deep ML Scan clicked");
            if (currentTab && currentTab.url) {
                await deepScan(currentTab.url);
            }
        });
    } else {
        console.error("❌ Deep Scan button not found!");
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
            if (!currentTab?.url) return;
            
            try {
                const urlObj = new URL(currentTab.url);
                const blacklistData = await chrome.storage.local.get(['blacklist']);
                const blacklist = blacklistData.blacklist || [];
                
                if (!blacklist.includes(urlObj.hostname)) {
                    blacklist.push(urlObj.hostname);
                    await chrome.storage.local.set({ blacklist: blacklist });
                    
                    // Update blocked count
                    const stats = await chrome.storage.local.get(['blockedCount']);
                    const newCount = (stats.blockedCount || 0) + 1;
                    await chrome.storage.local.set({ blockedCount: newCount });
                    if (blockedCount) blockedCount.textContent = newCount;
                    
                    reportBtn.innerHTML = '⚠️ Reported!';
                    setTimeout(() => {
                        reportBtn.innerHTML = '⚠️ Report';
                    }, 2000);
                    
                    // Re-analyze with blacklist consideration
                    if (lastAnalysis) {
                        lastAnalysis.score = 95;
                        lastAnalysis.warnings.push("🚨 Manually reported as phishing");
                        updateDisplay(lastAnalysis);
                    }
                }
            } catch (error) {
                console.error("Report error:", error);
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
        const settings = await chrome.storage.local.get([
            'protectionLevel',
            'autoScan',
            'blockDangerous',
            'showWarnings',
            'soundAlerts',
            'shareReports'
        ]);
        
        // Apply saved settings to UI
        const protectionLevel = document.getElementById('protectionLevel');
        const autoScan = document.getElementById('autoScan');
        const blockDangerous = document.getElementById('blockDangerous');
        const showWarnings = document.getElementById('showWarnings');
        const soundAlerts = document.getElementById('soundAlerts');
        const shareReports = document.getElementById('shareReports');
        
        if (protectionLevel) protectionLevel.value = settings.protectionLevel || 'medium';
        if (autoScan) autoScan.checked = settings.autoScan !== false;
        if (blockDangerous) blockDangerous.checked = settings.blockDangerous !== false;
        if (showWarnings) showWarnings.checked = settings.showWarnings !== false;
        if (soundAlerts) soundAlerts.checked = settings.soundAlerts || false;
        if (shareReports) shareReports.checked = settings.shareReports || false;
        
    } catch (error) {
        console.error('❌ Error loading settings:', error);
    }
}

async function saveSettings() {
    try {
        const settings = {
            protectionLevel: document.getElementById('protectionLevel')?.value || 'medium',
            autoScan: document.getElementById('autoScan')?.checked || false,
            blockDangerous: document.getElementById('blockDangerous')?.checked || false,
            showWarnings: document.getElementById('showWarnings')?.checked || false,
            soundAlerts: document.getElementById('soundAlerts')?.checked || false,
            shareReports: document.getElementById('shareReports')?.checked || false,
            lastUpdated: Date.now()
        };
        
        await chrome.storage.local.set(settings);
        console.log('💾 Settings saved');
        
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

// ===== INITIAL AUTO-SCAN =====
// The popup automatically runs quick scan when opened
// This happens in updateCurrentTab()