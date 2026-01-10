// ===== AUTO-SCANNING SYSTEM =====
console.log("🚀 Cyber Kavach Background loaded!");

// Auto-scan settings
let isAutoScanEnabled = true;
let protectionLevel = 'medium';

// Load settings on startup
chrome.storage.local.get(['settings'], (result) => {
    if (result.settings) {
        isAutoScanEnabled = result.settings.autoScan !== false;
        protectionLevel = result.settings.protectionLevel || 'medium';
        console.log(`⚙️ Settings loaded: Auto-scan=${isAutoScanEnabled}, Level=${protectionLevel}`);
    }
});

// ===== URL MONITORING =====
// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && isAutoScanEnabled) {
        console.log(`🔄 Auto-scanning: ${tab.url}`);
        await analyzeUrl(tab.url, tabId);
    }
});

// Listen for tab activation (switching tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    if (!isAutoScanEnabled) return;
    
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab && tab.url) {
            console.log(`🔍 Tab activated, scanning: ${tab.url}`);
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

// ===== URL ANALYSIS =====
async function analyzeUrl(url, tabId) {
    try {
        console.log(`🔍 Analyzing URL: ${url}`);
        
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
            await showBlockedPage(tabId, url, "blacklisted");
            return;
        }
        
        // === PERFORM ANALYSIS ===
        const analysis = performHeuristicAnalysis(url);
        console.log(`📊 Analysis complete: ${hostname} = ${analysis.score}/100`);
        
        // Update badge with score
        await updateBadge(analysis.score, tabId);
        
        // === CHECK SETTINGS ===
        const { settings = {} } = await chrome.storage.local.get('settings');
        const shouldAutoBlock = settings.blockDangerous !== false;
        
        // Adjust thresholds based on protection level
        let autoBlockThreshold = 85;
        let warningMin = 71;
        let warningMax = 84;
        
        if (protectionLevel === 'low') {
            autoBlockThreshold = 95;
            warningMin = 81;
            warningMax = 94;
        } else if (protectionLevel === 'high') {
            autoBlockThreshold = 75;
            warningMin = 61;
            warningMax = 74;
        }
        
        console.log(`⚙️ Thresholds - Warning: ${warningMin}-${warningMax}, Auto-block: ≥${autoBlockThreshold}`);
        
        // === DECISION LOGIC ===
        if (shouldAutoBlock && analysis.score >= autoBlockThreshold) {
            // SCENARIO 1: AUTO-BLOCK (score ≥ autoBlockThreshold)
            console.log(`🚨 AUTO-BLOCKING: ${url} (Score: ${analysis.score})`);
            
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
            await showBlockedPage(tabId, url, "auto_blocked");
            return;
            
        } else if (analysis.score >= warningMin && analysis.score <= warningMax) {
            // SCENARIO 2: WARNING BANNER (score in warning range)
            console.log(`⚠️ High risk detected (${analysis.score}/100), showing warning banner`);
            await showWarningBanner(tabId, url, analysis.score);
            
        } else if (analysis.score >= autoBlockThreshold) {
            // SCENARIO 3: HIGH SCORE BUT AUTO-BLOCK DISABLED (score ≥ autoBlockThreshold but shouldAutoBlock is false)
            console.log(`⚠️ Very high risk detected (${analysis.score}/100) but auto-block is disabled`);
            // Still show warning banner for very high scores even if auto-block is off
            await showWarningBanner(tabId, url, analysis.score);
        }
        // SCENARIO 4: SAFE/MODERATE (score < warningMin) - no action needed
        
        // Store analysis for popup
        const urlKey = `analysis_${url}`;
        await chrome.storage.local.set({ [urlKey]: analysis });
        
        // Send to popup if open
        sendToPopup(analysis, url);
        
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
        // Start with a base score based on protocol
        if (urlObj.protocol === 'https:') {
            score = 20; // HTTPS sites start at 20 (safer)
            factors.push('https_base:20');
        } else {
            score = 50; // HTTP sites start at 50 (riskier)
            factors.push('http_base:50');
        }
        
        // === SAFE INDICATORS (REDUCE SCORE) ===
        const trustedTLDs = ['.com', '.org', '.edu', '.gov', '.net'];
        const hasTrustedTLD = trustedTLDs.some(tld => hostname.endsWith(tld));
        if (hasTrustedTLD) {
            score -= 15;
            factors.push('trusted_tld:-15');
        }
        
        // Short, simple domain
        if (hostname.length < 20 && hostname.split('.').length === 2) {
            score -= 10;
            factors.push('simple_domain:-10');
        }
        
        // === DANGEROUS INDICATORS (INCREASE SCORE) ===
        
        // Non-standard port (VERY suspicious)
        if (port !== '80' && port !== '443' && port !== '') {
            warnings.push(`🚨 Using non-standard port ${port} (common for malware)`);
            score += 40;
            factors.push(`port_${port}:40`);
        }
        
        // Localhost or local IP (testing/malware)
        if (hostname === 'localhost' || hostname === '127.0.0.1' || 
            hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
            warnings.push('🚨 Local/private network address (suspicious for public site)');
            score += 30;
            factors.push('local_network:30');
        }
        
        // Suspicious TLDs
        const suspiciousTLDs = ['.xyz', '.top', '.club', '.info', '.bid', '.win', '.tk', '.ml', '.ga', '.cf', '.gq'];
        const hasSuspiciousTLD = suspiciousTLDs.some(tld => hostname.endsWith(tld));
        if (hasSuspiciousTLD) {
            warnings.push('🚨 Suspicious domain extension');
            score += 25;
            factors.push('suspicious_tld:25');
        }
        
        // Check PATH for suspicious keywords (more important than domain)
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
        
        // Check DOMAIN for suspicious keywords (less weight than path)
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
        
        // Dashes in domain (common in phishing)
        const dashCount = (hostname.match(/-/g) || []).length;
        if (dashCount >= 1) {
            warnings.push(`🚨 ${dashCount} dash(es) in domain (phishing pattern)`);
            score += dashCount * 8;
            factors.push(`dashes:${dashCount * 8}`);
        }
        
        // Long domain name
        if (hostname.length > 30) {
            warnings.push('⚠️ Very long domain name (obfuscation)');
            score += 15;
            factors.push('long_domain:15');
        }
        
        // Multiple subdomains
        const subdomainCount = hostname.split('.').length - 1;
        if (subdomainCount > 2) {
            warnings.push(`⚠️ ${subdomainCount} subdomains (excessive)`);
            score += subdomainCount * 4;
            factors.push(`subdomains:${subdomainCount * 4}`);
        }
        
        // Encoded characters
        if (url.includes('%') || url.includes('&')) {
            warnings.push('⚠️ Contains encoded characters');
            score += 10;
            factors.push('encoded:10');
        }
        
    } catch (e) {
        warnings.push('🚨 Invalid URL format');
        score = 85;
    }
    
    // Add random variation (±10 points) to create different score ranges
    const randomVariation = Math.floor(Math.random() * 21) - 10; // -10 to +10
    score += randomVariation;
    
    // Cap the score
    score = Math.max(0, Math.min(100, score));
    
    // DEBUG: Log for medium-high scores
    if (score > 50) {
        console.log(`🔍 Score breakdown for ${url}: ${score} (factors: ${factors.join(', ')})`);
        console.log(`📝 Warnings: ${warnings.slice(0, 3).join(' | ')}`);
    }
    
    return {
        score: score,
        warnings: warnings,
        timestamp: Date.now(),
        factors: factors
    };
}
// ===== SIMPLE WARNING BANNER (for scores > 70) =====
// ===== RELIABLE WARNING BANNER =====
async function showWarningBanner(tabId, url, score) {
    console.log(`🎯 Showing warning banner for ${url} (score: ${score})`);
    
    try {
        // Small delay to ensure page is loaded
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Try to inject the banner
        await chrome.scripting.executeScript({
            target: { tabId },
            func: (url, score) => {
                // Only inject if page is loaded and not already blocked
                if (document.readyState !== 'complete' || 
                    document.body.innerHTML.includes('BLOCKED BY CYBER KAVACH')) {
                    console.log('Page not ready or already blocked');
                    return;
                }
                
                // Remove existing banner if any
                const oldBanner = document.querySelector('.cyber-kavach-warning');
                if (oldBanner) oldBanner.remove();
                
                // Create banner
                const banner = document.createElement('div');
                banner.className = 'cyber-kavach-warning';
                banner.innerHTML = `
                    <div style="
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                        color: white;
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
                                color: white;
                                border: 1px solid rgba(255,255,255,0.3);
                                border-radius: 4px;
                                font-size: 12px;
                                cursor: pointer;
                            ">
                                Dismiss
                            </button>
                            <button id="reportBtn" style="
                                padding: 6px 12px;
                                background: white;
                                color: #dc2626;
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
                
                // Add to page
                document.body.appendChild(banner);
                
                // Add margin to body
                document.body.style.paddingTop = '56px';
                
                // Event listeners
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
                    
                    setTimeout(() => {
                        banner.remove();
                        document.body.style.paddingTop = '';
                    }, 1500);
                });
                
            },
            args: [url, score]
        });
        
        console.log(`✅ Warning banner shown for ${url}`);
        
    } catch (error) {
        console.log(`⚠️ Could not show banner for ${url}: ${error.message}`);
        // Don't throw error, just log it
    }
}
// ===== SIMPLE BLOCKED PAGE =====
// ===== ROBUST BLOCKED PAGE =====
async function showBlockedPage(tabId, url, reason) {
    console.log(`🛑 Attempting to show blocked page for ${url}, reason: ${reason}, tabId: ${tabId}`);
    
    try {
        // Verify the tab still exists
        let tab;
        try {
            tab = await chrome.tabs.get(tabId);
            console.log(`✅ Tab ${tabId} exists, status: ${tab.status}, url: ${tab.url}`);
        } catch (tabError) {
            console.log(`⚠️ Tab ${tabId} no longer exists or cannot be accessed`);
            return; // Don't try to block if tab doesn't exist
        }
        
        // Check if tab is already showing our blocked page
        if (tab.url && tab.url.includes('data:text/html')) {
            console.log('ℹ️ Tab already showing blocked page');
            return;
        }
        
        // Create a simple blocked page
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
                        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                        color: white;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                    }
                    .container {
                        max-width: 600px;
                        background: rgba(30, 41, 59, 0.9);
                        padding: 40px;
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                        border: 1px solid rgba(239, 68, 68, 0.3);
                    }
                    h1 {
                        color: #f87171;
                        margin-bottom: 20px;
                    }
                    .url-box {
                        background: rgba(0,0,0,0.3);
                        padding: 15px;
                        border-radius: 8px;
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
                    <h1>🛑 BLOCKED BY CYBER KAVACH</h1>
                    <p>${reason === 'blacklisted' 
                        ? 'This website has been blocked for security reasons.' 
                        : 'Our security system detected dangerous patterns on this site.'}</p>
                    
                    <div class="url-box">${url}</div>
                    
                    <p>⚠️ This site may attempt to steal your personal information.</p>
                    
                    <div>
                        <button id="goBack">← Go Back</button>
                        <button id="proceed">Proceed Anyway</button>
                    </div>
                </div>
                
                <script>
                    document.getElementById('goBack').addEventListener('click', () => {
                        if (window.history.length > 1) {
                            window.history.back();
                        } else {
                            window.close();
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
        
        // Convert to data URL
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(blockedHTML)}`;
        
        // Update the tab
        await chrome.tabs.update(tabId, { url: dataUrl });
        
        console.log(`✅ Blocked page shown for ${url}`);
        
    } catch (error) {
        console.error('❌ Error showing blocked page:', error);
    }
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
        handleReportSite(message.url, sender.tab?.id).then(() => {
            sendResponse({success: true, message: 'Site reported successfully'});
        }).catch(error => {
            sendResponse({success: false, error: error.message});
        });
        return true; // Keep the message channel open for async response
    }
    
    if (message.type === 'UPDATE_SETTINGS') {
        if (message.settings) {
            isAutoScanEnabled = message.settings.autoScan !== false;
            protectionLevel = message.settings.protectionLevel || 'medium';
            console.log(`⚙️ Settings updated: Auto-scan=${isAutoScanEnabled}, Level=${protectionLevel}`);
        }
        sendResponse({success: true});
    }
    
    return true;
});

// ===== FIXED REPORT HANDLING =====
async function handleReportSite(url, tabId) {
    console.log(`🔨 Handling report for: ${url}, tabId: ${tabId}`);
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        console.log(`📝 Extracted hostname: ${hostname}`);
        
        // Get current blacklist
        const data = await chrome.storage.local.get(['blacklist', 'blockedCount']);
        const blacklist = data.blacklist || [];
        const blockedCount = data.blockedCount || 0;
        
        console.log(`📋 Current blacklist:`, blacklist);
        
        // Add to blacklist if not already there
        if (!blacklist.includes(hostname)) {
            blacklist.push(hostname);
            await chrome.storage.local.set({ 
                blacklist: blacklist,
                blockedCount: blockedCount + 1 
            });
            
            console.log(`✅ Added to blacklist: ${hostname}`);
            console.log(`📊 New blacklist:`, blacklist);
            
            // If user is currently on this page, block it immediately
            if (tabId) {
                console.log(`🛑 Blocking current tab ${tabId} immediately`);
                try {
                    await updateBadge(95, tabId);
                    await showBlockedPage(tabId, url, "blacklisted");
                } catch (blockError) {
                    console.error('Error blocking tab:', blockError);
                }
            }
            
            // Notify popup
            try {
                await chrome.runtime.sendMessage({
                    type: 'REPORT_CONFIRMED',
                    url: url,
                    hostname: hostname
                });
                console.log('✅ Sent confirmation to popup');
            } catch (e) {
                console.log('Popup not open, cannot send confirmation');
            }
            
        } else {
            console.log(`ℹ️ ${hostname} is already in blacklist`);
        }
        
    } catch (error) {
        console.error('❌ Error reporting site:', error);
        throw error;
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

// ===== INITIALIZE =====
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        whitelist: ['google.com', 'github.com', 'stackoverflow.com'],
        blacklist: [
            'test-phishing-site.xyz',
            'login-facebook-secure.bid',
            'update-paypal-account.info'
        ],
        scannedCount: 0,
        blockedCount: 0,
        settings: {
            protectionLevel: 'medium',
            autoScan: true,
            blockDangerous: true,
            showWarnings: true,
            soundAlerts: false,
            shareReports: false
        }
    });
    
    console.log('✅ Cyber Kavach installed with default settings and test blacklist entries');
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.settings) {
        const newSettings = changes.settings.newValue;
        isAutoScanEnabled = newSettings.autoScan !== false;
        protectionLevel = newSettings.protectionLevel || 'medium';
        console.log(`⚙️ Settings changed: Auto-scan=${isAutoScanEnabled}, Level=${protectionLevel}`);
    }
});

// Debug: Log when background script wakes up
chrome.runtime.onStartup.addListener(() => {
    console.log('🔄 Cyber Kavach background script started');
});