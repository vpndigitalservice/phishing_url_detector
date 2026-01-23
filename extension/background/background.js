// ===== SUBSCRIPTION-BASED AUTO-SCANNING SYSTEM =====
console.log("🚀 Cyber Kavach Background loaded!");

// Subscription state
let userSubscription = 'free';
let userFeatures = {
    autoScan: false,
    autoBlock: false,
    redScreen: false,
    advancedSettings: false
};
let isAutoScanEnabled = false;
let protectionLevel = 'medium';

// ===== SESSION SYNCHRONIZATION =====
async function synchronizeUserSession() {
    try {
        const data = await chrome.storage.local.get([
            'userLoggedIn', 
            'userSubscription',
            'userFeatures'
        ]);
        
        if (data.userLoggedIn) {
            userSubscription = data.userSubscription || 'free';
            userFeatures = data.userFeatures || {};
            isAutoScanEnabled = userSubscription === 'paid' && userFeatures.autoScan;
            
            console.log(`🔄 Background synchronized: ${userSubscription}, Auto-scan: ${isAutoScanEnabled}`);
        }
    } catch (error) {
        console.error('❌ Sync error:', error);
    }
}

// ===== INITIALIZATION =====
async function initializeBackground() {
    console.log("⚙️ Initializing background service...");
    
    try {
        // First synchronize user session
        await synchronizeUserSession();
        
        // Then load other settings
        const data = await chrome.storage.local.get([
            'settings',
            'autoScan',
            'protectionLevel'
        ]);
        
        const settings = data.settings || {};
        protectionLevel = data.protectionLevel || settings.protectionLevel || 'medium';
        
        // Auto-scan only for paid users
        if (userSubscription === 'paid' && userFeatures.autoScan) {
            isAutoScanEnabled = data.autoScan !== false && settings.autoScan !== false;
        } else {
            isAutoScanEnabled = false;
        }
        
        console.log(`💰 Subscription: ${userSubscription}`);
        console.log(`🎯 Features:`, userFeatures);
        console.log(`⚙️ Auto-scan: ${isAutoScanEnabled}, Level: ${protectionLevel}`);
        
    } catch (error) {
        console.error('❌ Initialization error:', error);
        userSubscription = 'free';
        isAutoScanEnabled = false;
    }
}

// Initialize on startup
initializeBackground();

// ===== STORAGE CHANGE LISTENER FOR REAL-TIME SYNC =====
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        // If user logs in/out, sync immediately
        if (changes.userLoggedIn) {
            console.log('🔄 User login state changed, syncing...');
            setTimeout(synchronizeUserSession, 100);
        }
        
        // Update subscription if changed
        if (changes.userSubscription) {
            userSubscription = changes.userSubscription.newValue || 'free';
            console.log(`💰 Subscription changed: ${userSubscription}`);
            
            // Update features if changed
            if (changes.userFeatures) {
                userFeatures = changes.userFeatures.newValue || {};
            }
            
            // Update auto-scan based on subscription
            if (userSubscription === 'paid' && userFeatures.autoScan) {
                isAutoScanEnabled = changes.settings?.newValue?.autoScan !== false;
            } else {
                isAutoScanEnabled = false; // Force disable for free users
            }
        }
        
        // Update features
        if (changes.userFeatures) {
            userFeatures = changes.userFeatures.newValue || {};
            console.log('🎯 Features updated:', userFeatures);
            
            // Update auto-scan based on features
            if (userSubscription === 'paid') {
                isAutoScanEnabled = userFeatures.autoScan && (changes.settings?.newValue?.autoScan !== false);
            }
        }
        
        // Update settings
        if (changes.settings) {
            const newSettings = changes.settings.newValue || {};
            protectionLevel = newSettings.protectionLevel || 'medium';
            
            // Auto-scan only for paid users
            if (userSubscription === 'paid' && userFeatures.autoScan) {
                isAutoScanEnabled = newSettings.autoScan !== false;
            }
            
            console.log(`⚙️ Settings updated: Auto-scan=${isAutoScanEnabled}, Level=${protectionLevel}`);
        }
        
        if (changes.protectionLevel) {
            protectionLevel = changes.protectionLevel.newValue || 'medium';
            console.log(`⚙️ Protection level changed: ${protectionLevel}`);
        }
        
        if (changes.autoScan) {
            // Only respect auto-scan for paid users
            if (userSubscription === 'paid' && userFeatures.autoScan) {
                isAutoScanEnabled = changes.autoScan.newValue !== false;
                console.log(`⚙️ Auto-scan changed: ${isAutoScanEnabled}`);
            }
        }
    }
});

// ===== URL MONITORING (PAID USERS ONLY) =====
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Check if user is paid and auto-scan is enabled
    if (userSubscription !== 'paid' || !isAutoScanEnabled) {
        return;
    }
    
    if (changeInfo.status === 'complete' && tab.url) {
        console.log(`🔄 Paid user auto-scanning: ${tab.url}`);
        await analyzeUrl(tab.url, tabId);
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    // Check if user is paid and auto-scan is enabled
    if (userSubscription !== 'paid' || !isAutoScanEnabled) {
        return;
    }
    
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab && tab.url) {
            console.log(`🔍 Paid user tab activated, scanning: ${tab.url}`);
            await analyzeUrl(tab.url, tab.id);
        }
    } catch (error) {
        console.error('Error getting tab info:', error);
    }
});

// ===== BADGE MANAGEMENT =====
async function updateBadge(score, tabId) {
    let color = '#4ade80'; // Green
    let text = '✓';
    
    // Adjust thresholds based on protection level
    let dangerThreshold = 60;
    let warningThreshold = 25;
    
    if (protectionLevel === 'low') {
        dangerThreshold = 80;
        warningThreshold = 40;
    } else if (protectionLevel === 'high') {
        dangerThreshold = 50;
        warningThreshold = 15;
    }
    
    if (score >= dangerThreshold) {
        color = '#ef4444'; // Red
        text = '!';
    } else if (score >= warningThreshold) {
        color = '#fbbf24'; // Yellow
        text = '~';
    }
    
    try {
        await chrome.action.setBadgeBackgroundColor({ color, tabId });
        await chrome.action.setBadgeText({ text, tabId });
    } catch (error) {
        console.warn('Could not update badge:', error);
    }
}

// ===== SUBSCRIPTION-BASED URL ANALYSIS =====
async function analyzeUrl(url, tabId) {
    // Skip if not paid user or auto-scan disabled
    if (userSubscription !== 'paid' || !isAutoScanEnabled) {
        console.log('⏭️ Skipping auto-scan (free user or disabled)');
        return;
    }
    
    try {
        console.log(`🔍 Paid user analyzing URL: ${url}`);
        
        // Skip chrome:// and extension pages
        if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
            console.log('⏭️ Skipping Chrome page');
            return;
        }
        
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        // === CHECK WHITELIST FIRST ===
        const { whitelist = [] } = await chrome.storage.local.get('whitelist');
        if (whitelist.includes(hostname)) {
            console.log(`✅ Whitelisted: ${hostname}`);
            await updateBadge(5, tabId);
            return;
        }
        
        // === CHECK BLACKLIST ===
        const { blacklist = [] } = await chrome.storage.local.get('blacklist');
        if (blacklist.includes(hostname)) {
            console.log(`🚨 Blacklisted: ${hostname}`);
            await updateBadge(95, tabId);
            
            // Show red screen for paid users only
            if (userFeatures.redScreen) {
                await showBlockedPage(tabId, url, "blacklisted", 95);
            }
            return;
        }
        
        // === PERFORM ML SCAN FIRST (if server available) ===
        let finalScore = 50; // Default score
        let warnings = [];
        let mlAnalysis = null;
        
        try {
            mlAnalysis = await performMLScan(url, tabId);
            if (mlAnalysis) {
                finalScore = mlAnalysis.risk_score || 50;
                console.log(`✅ ML scan score: ${finalScore} for ${url}`);
                
                if (mlAnalysis.prediction === 'Phishing') {
                    warnings.push(`🚨 ML: Phishing detected (${(mlAnalysis.confidence * 100).toFixed(1)}% confidence)`);
                }
            }
        } catch (mlError) {
            console.log('ML scan failed, using heuristic:', mlError);
        }
        
        // === FALLBACK TO HEURISTIC IF ML FAILED ===
        if (!mlAnalysis || finalScore === 50) {
            const heuristicAnalysis = performHeuristicAnalysis(url);
            finalScore = heuristicAnalysis.score;
            warnings = heuristicAnalysis.warnings;
            console.log(`📊 Heuristic score: ${finalScore} for ${url}`);
        }
        
        // Update badge with score
        await updateBadge(finalScore, tabId);
        
        // === CHECK SUBSCRIPTION FOR AUTO-BLOCK ===
        const shouldAutoBlock = userSubscription === 'paid' && userFeatures.autoBlock;
        
        // Adjust thresholds based on protection level
        let autoBlockThreshold = 80;
        let warningMin = 71;
        let warningMax = 84;
        
        if (protectionLevel === 'low') {
            autoBlockThreshold = 95;
            warningMin = 81;
            warningMax = 94;
        } else if (protectionLevel === 'high') {
            autoBlockThreshold = 70;
            warningMin = 51;
            warningMax = 69;
        }
        
        console.log(`💰 Subscription: ${userSubscription}, Auto-block: ${shouldAutoBlock}, Level: ${protectionLevel}`);
        console.log(`📊 Score: ${finalScore}, Thresholds - Warning: ${warningMin}-${warningMax}, Auto-block: ≥${autoBlockThreshold}`);
        
        // === DECISION LOGIC ===
        if (shouldAutoBlock && finalScore >= autoBlockThreshold) {
            // SCENARIO 1: PAID USER AUTO-BLOCK
            console.log(`🚨 PAID USER AUTO-BLOCKING: ${url} (Score: ${finalScore})`);
            
            // Add to blacklist
            if (!blacklist.includes(hostname)) {
                blacklist.push(hostname);
                await chrome.storage.local.set({ blacklist: blacklist });
                
                // Update blocked count
                const { blockedCount = 0 } = await chrome.storage.local.get('blockedCount');
                await chrome.storage.local.set({ blockedCount: blockedCount + 1 });
                
                console.log(`✅ Added to blacklist: ${hostname}`);
            }
            
            await updateBadge(95, tabId);
            
            // Show red screen for paid users only
            if (userFeatures.redScreen) {
                await showBlockedPage(tabId, url, "auto_blocked", finalScore);
            }
            return;
            
        } else if (finalScore >= warningMin && finalScore <= warningMax) {
            // SCENARIO 2: WARNING SCREEN (for all users)
            console.log(`⚠️ High risk detected (${finalScore}/100), showing warning screen`);
            await showWarningBanner(tabId, url, finalScore);
            
        } else if (finalScore >= autoBlockThreshold) {
            // SCENARIO 3: HIGH SCORE BUT NO AUTO-BLOCK (free users)
            console.log(`⚠️ Very high risk detected (${finalScore}/100) but user cannot auto-block`);
            await showWarningBanner(tabId, url, finalScore);
        }
        
        // Store analysis for popup
        const urlKey = `analysis_${url}`;
        await chrome.storage.local.set({ 
            [urlKey]: {
                score: finalScore,
                warnings: warnings,
                timestamp: Date.now()
            }
        });
        
        // Send to popup if open
        sendToPopup({ score: finalScore, warnings: warnings }, url);
        
    } catch (error) {
        console.error('❌ Error analyzing URL:', error);
        await updateBadge(50, tabId);
    }
}

// ===== HEURISTIC ANALYSIS =====
function performHeuristicAnalysis(url) {
    const warnings = [];
    let score = 0;
    let factors = [];
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const pathname = urlObj.pathname.toLowerCase();
        const port = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80');
        const search = urlObj.search.toLowerCase();
        
        // === BASE SCORING ===
        if (urlObj.protocol === 'https:') {
            score = 20;
            factors.push('https_base:20');
        } else {
            score = 50;
            factors.push('http_base:50');
        }
        
        // === SAFE INDICATORS (REDUCE SCORE) ===
        const trustedTLDs = ['.com', '.org', '.edu', '.gov', '.net'];
        const hasTrustedTLD = trustedTLDs.some(tld => hostname.endsWith(tld));
        if (hasTrustedTLD) {
            score -= 15;
            factors.push('trusted_tld:-15');
        }
        
        if (hostname.length < 20 && hostname.split('.').length === 2) {
            score -= 10;
            factors.push('simple_domain:-10');
        }
        
        // === DANGEROUS INDICATORS (INCREASE SCORE) ===
        if (port !== '80' && port !== '443' && port !== '') {
            warnings.push(`🚨 Using non-standard port ${port} (common for malware)`);
            score += 40;
            factors.push(`port_${port}:40`);
        }
        
        if (hostname === 'localhost' || hostname === '127.0.0.1' || 
            hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
            warnings.push('🚨 Local/private network address (suspicious for public site)');
            score += 30;
            factors.push('local_network:30');
        }
        
        const suspiciousTLDs = ['.xyz', '.top', '.club', '.info', '.bid', '.win', '.tk', '.ml', '.ga', '.cf', '.gq'];
        const hasSuspiciousTLD = suspiciousTLDs.some(tld => hostname.endsWith(tld));
        if (hasSuspiciousTLD) {
            warnings.push('🚨 Suspicious domain extension');
            score += 25;
            factors.push('suspicious_tld:25');
        }
        
        const pathKeywords = [
            { pattern: /login/i, points: 25, message: 'Contains "login" in path' },
            { pattern: /admin/i, points: 30, message: 'Contains "admin" in path' },
            { pattern: /secure/i, points: 20, message: 'Contains "secure" in path' },
            { pattern: /verify/i, points: 20, message: 'Contains "verify" in path' },
            { pattern: /account/i, points: 25, message: 'Contains "account" in path' },
            { pattern: /bank/i, points: 30, message: 'Contains "bank" in path' },
            { pattern: /paypal/i, points: 35, message: 'Contains "PayPal" in path' },
            { pattern: /password/i, points: 30, message: 'Contains "password" in path' },
            { pattern: /update/i, points: 20, message: 'Contains "update" in path' },
            { pattern: /confirm/i, points: 20, message: 'Contains "confirm" in path' },
        ];
        
        pathKeywords.forEach(({ pattern, points, message }) => {
            if (pattern.test(pathname) || pattern.test(search)) {
                warnings.push(`🚨 ${message}`);
                score += points;
                factors.push(`path_${pattern.toString()}:${points}`);
            }
        });
        
        const domainKeywords = [
            { pattern: /login/i, points: 15, message: 'Contains "login" in domain' },
            { pattern: /secure/i, points: 12, message: 'Contains "secure" in domain' },
            { pattern: /verify/i, points: 12, message: 'Contains "verify" in domain' },
            { pattern: /account/i, points: 15, message: 'Contains "account" in domain' },
            { pattern: /bank/i, points: 20, message: 'Contains "bank" in domain' },
            { pattern: /paypal/i, points: 25, message: 'Contains "PayPal" in domain' },
        ];
        
        domainKeywords.forEach(({ pattern, points, message }) => {
            if (pattern.test(hostname)) {
                warnings.push(`🚨 ${message}`);
                score += points;
                factors.push(`domain_${pattern.toString()}:${points}`);
            }
        });
        
        const dashCount = (hostname.match(/-/g) || []).length;
        if (dashCount >= 1) {
            warnings.push(`🚨 ${dashCount} dash(es) in domain (phishing pattern)`);
            score += dashCount * 8;
            factors.push(`dashes:${dashCount * 8}`);
        }
        
        if (hostname.length > 30) {
            warnings.push('⚠️ Very long domain name (obfuscation)');
            score += 15;
            factors.push('long_domain:15');
        }
        
        const subdomainCount = hostname.split('.').length - 1;
        if (subdomainCount > 2) {
            warnings.push(`⚠️ ${subdomainCount} subdomains (excessive)`);
            score += subdomainCount * 4;
            factors.push(`subdomains:${subdomainCount * 4}`);
        }
        
        if (url.includes('%') || url.includes('&')) {
            warnings.push('⚠️ Contains encoded characters');
            score += 10;
            factors.push('encoded:10');
        }
        
    } catch (e) {
        warnings.push('🚨 Invalid URL format');
        score = 85;
    }
    
    const randomVariation = Math.floor(Math.random() * 21) - 10;
    score += randomVariation;
    score = Math.max(0, Math.min(100, score));
    
    if (score > 50) {
        console.log(`🔍 Score breakdown for ${url}: ${score} (factors: ${factors.join(', ')})`);
    }
    
    return {
        score: score,
        warnings: warnings,
        timestamp: Date.now(),
        factors: factors
    };
}

// ===== WARNING SCREEN =====
async function showWarningBanner(tabId, url, score) {
    console.log(`⚠️ Showing warning screen for ${url} (score: ${score})`);
    
    try {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['blocked_screen.js']
        });
        
        await chrome.scripting.executeScript({
            target: { tabId },
            func: (url, score) => {
                if (window.injectRedScreen) {
                    window.injectRedScreen(url, 'suspicious', score);
                }
            },
            args: [url, score]
        });
        
        console.log(`✅ Warning screen shown for ${url}`);
        
    } catch (error) {
        console.log(`⚠️ Could not show warning screen: ${error.message}`);
        await showSimpleWarningBanner(tabId, url, score);
    }
}

async function showSimpleWarningBanner(tabId, url, score) {
    await chrome.scripting.executeScript({
        target: { tabId },
        func: (url, score) => {
            const oldBanner = document.querySelector('.cyber-kavach-warning');
            if (oldBanner) oldBanner.remove();
            
            const banner = document.createElement('div');
            banner.className = 'cyber-kavach-warning';
            banner.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: #451a03;
                    padding: 12px 20px;
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    text-align: center;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-size: 20px;">⚠️</span>
                        <div>
                            <div style="font-weight: bold; font-size: 14px;">SECURITY WARNING</div>
                            <div style="font-size: 12px; opacity: 0.9;">
                                Risk Score: ${score}/100 - Exercise caution
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button id="dismissBtn" style="
                            padding: 6px 12px;
                            background: rgba(255,255,255,0.2);
                            color: #451a03;
                            border: 1px solid rgba(161, 98, 7, 0.3);
                            border-radius: 4px;
                            font-size: 12px;
                            cursor: pointer;
                        ">
                            Dismiss
                        </button>
                        <button id="reportBtn" style="
                            padding: 6px 12px;
                            background: #451a03;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            font-weight: bold;
                            font-size: 12px;
                            cursor: pointer;
                        ">
                            Report
                        </button>
                    </div>
                </div>
                <style>
                    .cyber-kavach-warning {
                        animation: slideDown 0.3s ease;
                    }
                    @keyframes slideDown {
                        from { transform: translateY(-100%); }
                        to { transform: translateY(0); }
                    }
                    body { padding-top: 56px !important; }
                </style>
            `;
            
            document.body.appendChild(banner);
            document.body.style.paddingTop = '56px';
            
            document.getElementById('dismissBtn').addEventListener('click', () => {
                banner.remove();
                document.body.style.paddingTop = '';
            });
            
            document.getElementById('reportBtn').addEventListener('click', () => {
                chrome.runtime.sendMessage({
                    type: 'REPORT_SITE',
                    url: url
                });
                
                const btn = document.getElementById('reportBtn');
                btn.textContent = 'Reported!';
                btn.disabled = true;
                btn.style.background = '#4ade80';
                btn.style.color = 'white';
            });
        },
        args: [url, score]
    });
}

// ===== RED SCREEN BLOCKING =====
async function showBlockedPage(tabId, url, reason, riskScore = null) {
    console.log(`🛑 Showing red screen for ${url}, reason: ${reason}, riskScore: ${riskScore}`);
    
    try {
        let tab;
        try {
            tab = await chrome.tabs.get(tabId);
            console.log(`✅ Tab ${tabId} exists, status: ${tab.status}, url: ${tab.url}`);
        } catch (tabError) {
            console.log(`⚠️ Tab ${tabId} no longer exists`);
            return;
        }
        
        await chrome.scripting.insertCSS({
            target: { tabId },
            css: `
                .red-screen-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
                    z-index: 99999999;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    text-align: center;
                    padding: 40px 20px;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    overflow-y: auto;
                }
                
                .yellow-screen-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    z-index: 99999999;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: #451a03;
                    text-align: center;
                    padding: 40px 20px;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    overflow-y: auto;
                }
                
                .red-screen-content, .yellow-screen-content {
                    max-width: 600px;
                    width: 90%;
                    background: rgba(0, 0, 0, 0.3);
                    padding: 40px;
                    border-radius: 20px;
                    border: 3px solid rgba(255, 255, 255, 0.2);
                    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                }
                
                .yellow-screen-content {
                    background: rgba(255, 255, 255, 0.9);
                    border: 3px solid rgba(161, 98, 7, 0.3);
                }
                
                .red-screen-title {
                    font-size: 36px;
                    font-weight: 900;
                    margin-bottom: 20px;
                    text-shadow: 0 2px 10px rgba(0,0,0,0.3);
                }
                
                .yellow-screen-title {
                    font-size: 32px;
                    font-weight: 900;
                    margin-bottom: 20px;
                    color: #78350f;
                }
                
                .red-screen-subtitle, .yellow-screen-subtitle {
                    font-size: 18px;
                    margin-bottom: 25px;
                    opacity: 0.9;
                }
                
                .red-screen-url {
                    background: rgba(0,0,0,0.5);
                    padding: 15px;
                    border-radius: 10px;
                    margin: 20px 0;
                    font-family: monospace;
                    word-break: break-all;
                    border-left: 4px solid #ef4444;
                }
                
                .red-screen-reason {
                    background: rgba(239, 68, 68, 0.2);
                    padding: 15px;
                    border-radius: 10px;
                    margin: 20px 0;
                    font-size: 16px;
                    border: 2px solid rgba(239, 68, 68, 0.4);
                }
                
                .red-screen-warning {
                    background: rgba(255, 255, 255, 0.1);
                    padding: 15px;
                    border-radius: 10px;
                    margin: 20px 0;
                    border-left: 5px solid #fbbf24;
                    text-align: left;
                }
                
                .red-screen-buttons {
                    display: flex;
                    gap: 15px;
                    margin-top: 30px;
                    flex-wrap: wrap;
                    justify-content: center;
                }
                
                .red-screen-btn {
                    padding: 16px 32px;
                    border: none;
                    border-radius: 10px;
                    font-weight: 700;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    min-width: 180px;
                }
                
                .red-screen-btn:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 20px rgba(0,0,0,0.3);
                }
                
                .red-screen-btn-primary {
                    background: white;
                    color: #dc2626;
                }
                
                .red-screen-btn-danger {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    color: white;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                }
                
                .red-screen-btn-warning {
                    background: #f59e0b;
                    color: #451a03;
                }
                
                .red-screen-btn-secondary {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border: 2px solid rgba(255, 255, 255, 0.3);
                }
                
                .yellow-screen-risk-score {
                    font-size: 72px;
                    font-weight: 900;
                    color: #dc2626;
                    margin: 20px 0;
                }
                
                .yellow-screen-risk-label {
                    font-size: 24px;
                    font-weight: 700;
                    margin-bottom: 30px;
                    color: #b45309;
                }
                
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                    20%, 40%, 60%, 80% { transform: translateX(5px); }
                }
                
                @keyframes flashRed {
                    0%, 100% { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); }
                    50% { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); }
                }
                
                .shake-warning {
                    animation: shake 0.5s ease-in-out;
                }
                
                .flash-danger {
                    animation: flashRed 0.8s ease-in-out;
                }
            `
        });
        
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ['blocked_screen.js']
        });
        
        await chrome.scripting.executeScript({
            target: { tabId },
            func: (url, reason, riskScore) => {
                if (window.injectRedScreen) {
                    window.injectRedScreen(url, reason, riskScore);
                } else {
                    document.body.innerHTML = `
                        <div style="
                            position: fixed;
                            top: 0; left: 0; right: 0; bottom: 0;
                            background: #dc2626;
                            color: white;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-family: sans-serif;
                            text-align: center;
                            padding: 20px;
                        ">
                            <div>
                                <h1 style="font-size: 36px;">🚨 BLOCKED BY CYBER KAVACH</h1>
                                <p>${url} has been blocked for security reasons.</p>
                                <button onclick="history.back()" style="
                                    padding: 12px 24px;
                                    background: white;
                                    color: #dc2626;
                                    border: none;
                                    border-radius: 8px;
                                    font-weight: bold;
                                    cursor: pointer;
                                    margin-top: 20px;
                                ">
                                    Go Back
                                </button>
                            </div>
                        </div>
                    `;
                }
            },
            args: [url, reason, riskScore]
        });
        
        console.log(`✅ Red screen injected for ${url}`);
        
    } catch (error) {
        console.error('❌ Error showing red screen:', error);
        await showSimpleBlockedPage(tabId, url, reason);
    }
}

async function showSimpleBlockedPage(tabId, url, reason) {
    const blockedHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Blocked by Cyber Kavach</title>
            <style>
                body {
                    margin: 0;
                    padding: 40px 20px;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
                    color: white;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                }
                .container {
                    max-width: 600px;
                    background: rgba(0, 0, 0, 0.3);
                    padding: 40px;
                    border-radius: 20px;
                    border: 3px solid rgba(255, 255, 255, 0.2);
                    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                }
                h1 {
                    color: #fecaca;
                    margin-bottom: 20px;
                    font-size: 36px;
                }
                .url-box {
                    background: rgba(0,0,0,0.5);
                    padding: 15px;
                    border-radius: 10px;
                    margin: 20px 0;
                    font-family: monospace;
                    word-break: break-all;
                }
                button {
                    padding: 12px 24px;
                    margin: 10px;
                    border: none;
                    border-radius: 8px;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 16px;
                }
                #goBack {
                    background: #4ade80;
                    color: white;
                }
                #proceed {
                    background: transparent;
                    color: #f87171;
                    border: 2px solid #f87171;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚨 BLOCKED BY CYBER KAVACH</h1>
                <p>${reason === 'blacklisted' 
                    ? 'This website has been blocked for security reasons.' 
                    : 'Our security system detected dangerous patterns on this site.'}</p>
                
                <div class="url-box">${url}</div>
                
                <p>⚠️ This site may attempt to steal your personal information.</p>
                
                <div>
                    <button id="goBack">← Go Back to Safety</button>
                    <button id="proceed">⚠️ Proceed Anyway (Risky)</button>
                </div>
            </div>
            
            <script>
                document.getElementById('goBack').addEventListener('click', () => {
                    if (window.history.length > 1) {
                        window.history.back();
                    } else {
                        window.location.href = 'https://www.google.com';
                    }
                });
                
                document.getElementById('proceed').addEventListener('click', () => {
                    if (confirm('⚠️ SECURITY WARNING\\n\\nThis site has been blocked for security reasons.\\nProceeding may put your information at risk.\\n\\nProceed anyway?')) {
                        window.location.href = '${url}';
                    }
                });
            </script>
        </body>
        </html>
    `;
    
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(blockedHTML)}`;
    await chrome.tabs.update(tabId, { url: dataUrl });
}

// ===== MESSAGE HANDLING =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Background received:', message.type);
    
    if (message.type === 'UPDATE_BADGE') {
        if (sender?.tab?.id) {
            updateBadge(message.score, sender.tab.id);
        }
        sendResponse({success: true});
    }
    
    if (message.type === 'GET_ANALYSIS') {
        const urlKey = `analysis_${message.url}`;
        chrome.storage.local.get([urlKey], (result) => {
            sendResponse(result[urlKey] || null);
        });
        return true;
    }
    
    if (message.type === 'REPORT_SITE') {
        console.log('📢 Report received:', message.url);
        
        // Check if paid user can auto-block
        if (userSubscription === 'paid' && userFeatures.autoBlock && message.riskScore >= 80) {
            console.log(`🛑 Paid user auto-blocking site: ${message.url}`);
            handleAutoBlock(message.url, sender.tab?.id, message.riskScore);
        }
        
        handleReportSite(message.url, sender.tab?.id).then(() => {
            sendResponse({success: true, message: 'Site reported successfully'});
        }).catch(error => {
            sendResponse({success: false, error: error.message});
        });
        return true;
    }
    
    if (message.type === 'HIGH_RISK_DETECTED') {
        console.log(`🚨 High risk detected from ML scan: ${message.url} (${message.score}/100)`);
        
        // Auto-block for paid users only
        if (userSubscription === 'paid' && userFeatures.autoBlock && message.score >= 80) {
            console.log(`🛑 Paid user auto-blocking high risk site: ${message.url}`);
            
            const urlObj = new URL(message.url);
            const hostname = urlObj.hostname;
            
            chrome.storage.local.get(['blacklist'], async (result) => {
                const { blacklist = [] } = result;
                if (!blacklist.includes(hostname)) {
                    blacklist.push(hostname);
                    await chrome.storage.local.set({ blacklist: blacklist });
                    
                    const { blockedCount = 0 } = await chrome.storage.local.get('blockedCount');
                    await chrome.storage.local.set({ blockedCount: blockedCount + 1 });
                }
                
                if (userFeatures.redScreen && sender?.tab?.id) {
                    await showBlockedPage(sender.tab.id, message.url, "ml_high_risk", message.score);
                }
            });
        }
        
        sendResponse({ success: true });
        return true;
    }
    
    if (message.type === 'UPDATE_SETTINGS') {
        if (message.settings) {
            protectionLevel = message.settings.protectionLevel || 'medium';
            
            // Auto-scan only for paid users
            if (userSubscription === 'paid' && userFeatures.autoScan) {
                isAutoScanEnabled = message.settings.autoScan !== false;
            } else {
                isAutoScanEnabled = false;
            }
            
            console.log(`⚙️ Settings updated: Auto-scan=${isAutoScanEnabled}, Level=${protectionLevel}`);
        }
        sendResponse({success: true});
    }
    
    if (message.type === 'UPDATE_SUBSCRIPTION') {
        userSubscription = message.subscription || 'free';
        userFeatures = message.features || {};
        
        // Update auto-scan based on subscription
        if (userSubscription === 'paid' && userFeatures.autoScan) {
            chrome.storage.local.get(['settings'], (result) => {
                isAutoScanEnabled = result.settings?.autoScan !== false;
                console.log(`💰 Subscription updated: ${userSubscription}, Auto-scan=${isAutoScanEnabled}`);
            });
        } else {
            isAutoScanEnabled = false;
            console.log(`💰 Subscription updated: ${userSubscription}, Auto-scan disabled`);
        }
        
        sendResponse({success: true});
    }
    
    return true;
});

// ===== AUTO-BLOCK HANDLING =====
async function handleAutoBlock(url, tabId, riskScore) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        const { blacklist = [] } = await chrome.storage.local.get('blacklist');
        if (!blacklist.includes(hostname)) {
            blacklist.push(hostname);
            await chrome.storage.local.set({ blacklist: blacklist });
            
            const { blockedCount = 0 } = await chrome.storage.local.get('blockedCount');
            await chrome.storage.local.set({ blockedCount: blockedCount + 1 });
            
            console.log(`✅ Added to blacklist: ${hostname}`);
        }
        
        if (userFeatures.redScreen && tabId) {
            await showBlockedPage(tabId, url, "ml_high_risk", riskScore);
        }
        
    } catch (error) {
        console.error('❌ Error in auto-block:', error);
    }
}

// ===== REPORT HANDLING =====
async function handleReportSite(url, tabId) {
    console.log(`🔨 Handling report for: ${url}`);
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        const data = await chrome.storage.local.get(['blacklist', 'blockedCount']);
        let blacklist = data.blacklist || [];
        let blockedCount = data.blockedCount || 0;
        
        if (!blacklist.includes(hostname)) {
            blacklist.push(hostname);
            await chrome.storage.local.set({ 
                blacklist: blacklist,
                blockedCount: blockedCount + 1 
            });
            
            console.log(`✅ Site reported: ${hostname}`);
            
            if (tabId) {
                await updateBadge(95, tabId);
            }
            
            return { success: true, hostname: hostname };
            
        } else {
            console.log(`ℹ️ Already reported: ${hostname}`);
            return { success: true, alreadyReported: true };
        }
        
    } catch (error) {
        console.error('❌ Error reporting site:', error);
        return { success: false, error: error.message };
    }
}

// ===== SEND TO POPUP =====
async function sendToPopup(analysis, url) {
    try {
        chrome.runtime.sendMessage({
            type: 'ANALYSIS_UPDATE',
            analysis: analysis,
            url: url
        });
    } catch (error) {
        // Popup not open
    }
}

// ===== ML SCANNING =====
async function performMLScan(url, tabId) {
    console.log(`🧠 Performing ML scan for: ${url}`);
    
    try {
        if (!await checkMLServer()) {
            console.log('ML server not available');
            return null;
        }
        
        const response = await fetch("http://127.0.0.1:5000/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ url: url })
        });
        
        if (!response.ok) {
            throw new Error(`ML server error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`✅ ML scan result:`, data);
        
        await updateBadge(data.risk_score || 50, tabId);
        
        const analysis = {
            score: data.risk_score || 50,
            prediction: data.prediction || 'Unknown',
            confidence: data.confidence || 0.5,
            timestamp: Date.now(),
            source: 'ml_auto'
        };
        
        const urlKey = `ml_analysis_${url}`;
        await chrome.storage.local.set({ [urlKey]: analysis });
        
        await handleMLResult(data, url, tabId);
        
        return data;
        
    } catch (error) {
        console.error('❌ ML scan failed:', error);
        return null;
    }
}

async function checkMLServer() {
    try {
        const response = await fetch("http://127.0.0.1:5000/health", { timeout: 3000 });
        return response.ok;
    } catch {
        return false;
    }
}

async function handleMLResult(data, url, tabId) {
    // Auto-block only for paid users
    if (userSubscription === 'paid' && userFeatures.autoBlock && 
        data.prediction === 'Phishing' && data.confidence > 0.7) {
        
        const riskScore = data.risk_score || 80;
        
        if (riskScore >= 80) {
            console.log(`🚨 ML detected phishing, blocking: ${url}`);
            
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            
            const { blacklist = [] } = await chrome.storage.local.get('blacklist');
            if (!blacklist.includes(hostname)) {
                blacklist.push(hostname);
                await chrome.storage.local.set({ blacklist: blacklist });
                
                const { blockedCount = 0 } = await chrome.storage.local.get('blockedCount');
                await chrome.storage.local.set({ blockedCount: blockedCount + 1 });
            }
            
            if (userFeatures.redScreen) {
                await showBlockedPage(tabId, url, "ml_phishing_detected", riskScore);
            }
            
        } else if (riskScore >= 60 && riskScore < 80) {
            console.log(`⚠️ ML detected potential phishing, showing warning: ${url}`);
            await showWarningBanner(tabId, url, riskScore);
        }
    }
}

// ===== STARTUP =====
chrome.runtime.onStartup.addListener(() => {
    console.log('🔄 Cyber Kavach background script started');
    initializeBackground();
});