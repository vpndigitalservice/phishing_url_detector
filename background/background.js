// URL Monitoring
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        analyzeUrl(tab.url, tabId);
    }
});

// Badge Management
async function updateBadge(score, tabId) {
    let color = '#4ade80'; // Green
    let text = '✓';
    
    // ADJUSTED THRESHOLDS:
    if (score >= 60) { // Changed: 60+ = RED (more sensitive)
        color = '#ef4444'; // Red
        text = '!';
    } else if (score >= 25) { // Changed: 25-59 = YELLOW
        color = '#fbbf24'; // Yellow
        text = '~';
    }
    // 0-24 = GREEN
    
    try {
        await chrome.action.setBadgeBackgroundColor({ color, tabId });
        await chrome.action.setBadgeText({ text, tabId });
    } catch (error) {
        console.warn('Could not update badge:', error);
    }
}

// Heuristic Analysis
async function analyzeUrl(url, tabId) {
    try {
        // Skip chrome:// and extension pages
        if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
            return;
        }
        
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        
        // === CHECK WHITELIST FIRST ===
        const { whitelist = [] } = await chrome.storage.local.get('whitelist');
        if (whitelist.includes(hostname)) {
            // Force green for whitelisted
            await updateBadge(5, tabId); // Very low score = green
            return;
        }
        
        // === CHECK BLACKLIST ===
        const { blacklist = [] } = await chrome.storage.local.get('blacklist');
        if (blacklist.includes(hostname)) {
            // Force red for blacklisted
            await updateBadge(95, tabId);
            showBlockedPage(tabId, url);
            return;
        }
        
        // === PERFORM ANALYSIS ===
        const analysis = performHeuristicAnalysis(url);
        
        // Update badge
        await updateBadge(analysis.score, tabId);
        
        // Store analysis
        const urlKey = `analysis_${url}`;
        await chrome.storage.local.set({ [urlKey]: analysis });
        
        // Notify popup if open
        try {
            chrome.runtime.sendMessage({
                type: 'ANALYSIS_UPDATE',
                analysis: analysis
            });
        } catch (e) {
            // Popup not open, ignore
        }
        
    } catch (error) {
        console.error('Error analyzing URL:', error);
        await updateBadge(50, tabId); // Neutral/yellow on error
    }
}

function performHeuristicAnalysis(url) {
    const warnings = [];
    let score = 0;
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        // === SAFE INDICATORS (REDUCE SCORE) ===
        
        // HTTPS (MAJOR safe indicator)
        if (urlObj.protocol === 'https:') {
            score -= 30; // More points for HTTPS
        }
        
        // Trusted TLDs
        const trustedTLDs = ['.com', '.org', '.edu', '.gov', '.net', '.io', '.co'];
        const hasTrustedTLD = trustedTLDs.some(tld => hostname.endsWith(tld));
        if (hasTrustedTLD) {
            score -= 10;
        }
        
        // Short, simple domain
        if (hostname.length < 15 && hostname.split('.').length === 2) {
            score -= 15;
        }
        
        // === PHISHING INDICATORS (INCREASE SCORE) ===
        
        // NO HTTPS (VERY BAD)
        if (urlObj.protocol !== 'https:') {
            warnings.push('🚨 Not using HTTPS');
            score += 50; // Increased from 40
        }
        
        // IP ADDRESS (VERY SUSPICIOUS)
             
         const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
                if (ipPattern.test(hostname)) {
                    // Validate it's a real IP
                    const parts = hostname.split('.');
                    const isValidIP = parts.every(part => {
                        const num = parseInt(part, 10);
                        return !isNaN(num) && num >= 0 && num <= 255;
                    });
                    
                    if (isValidIP) {
                        warnings.push('🚨 Uses IP address instead of domain');
                        score += 70;
                    } else {
                        warnings.push('⚠️ Invalid IP address format');
                        score += 40;
                    }
             }

        // SUSPICIOUS TLDs
        const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.club', '.info', '.bid', '.win'];
        const hasSuspiciousTLD = suspiciousTLDs.some(tld => hostname.endsWith(tld));
        if (hasSuspiciousTLD) {
            warnings.push('🚨 Suspicious domain extension');
            score += 40; // Increased from 30
        }
        
        // MULTIPLE DASHES (PHISHING PATTERN)
        const dashCount = (hostname.match(/-/g) || []).length;
        if (dashCount >= 2) { // Lowered threshold from 3
            warnings.push(`🚨 ${dashCount} dashes in domain (phishing pattern)`);
            score += dashCount * 15; // More points per dash
        }
        
        // PHISHING KEYWORDS IN DOMAIN
        const phishingKeywords = [
            'login', 'secure', 'verify', 'account', 'bank', 'paypal', 'update', 
            'confirm', 'validation', 'signin', 'password', 'wallet', 'crypto',
            'facebook', 'google', 'apple', 'microsoft', 'amazon', 'netflix'
        ];
        const hasPhishingKeyword = phishingKeywords.some(keyword => 
            hostname.includes(keyword)
        );
        if (hasPhishingKeyword) {
            warnings.push('🚨 Brand/security keywords in domain (likely phishing)');
            score += 40; // Increased from 20
        }
        
        // LONG DOMAIN (OBFUSCATION)
        if (hostname.length > 35) {
            warnings.push('⚠️ Very long domain name (obfuscation)');
            score += 25;
        }
        
        // EXCESSIVE SUBDOMAINS
        const subdomainCount = hostname.split('.').length;
        if (subdomainCount > 3) { // Lowered from 4
            warnings.push('⚠️ Excessive subdomains');
            score += subdomainCount * 8;
        }
        
        // @ SYMBOL (URL OBFUSCATION)
        if (url.includes('@')) {
            warnings.push('🚨 @ symbol in URL (obfuscation attack)');
            score += 80; // Almost certain phishing
        }
        
        // ENCODED CHARACTERS
        if (url.includes('%') || url.includes('&')) {
            warnings.push('⚠️ Encoded characters in URL');
            score += 20;
        }
        
        // CHECK FOR BRAND IMPERSONATION
        const brands = ['google', 'facebook', 'microsoft', 'apple', 'amazon', 'paypal'];
        brands.forEach(brand => {
            if (hostname.includes(brand) && !hostname.endsWith(`${brand}.com`)) {
                warnings.push(`🚨 Possible ${brand} impersonation`);
                score += 50;
            }
        });
        
    } catch (e) {
        warnings.push('🚨 Invalid URL format');
        score = 90; // Very high for invalid URLs
    }
    
    // Clamp score between 0 and 100
    score = Math.max(0, Math.min(100, score));
    
    return {
        score: score,
        warnings: warnings,
        timestamp: Date.now()
    };
}
async function showBlockedPage(tabId, url) {
    await chrome.scripting.executeScript({
        target: { tabId },
        func: (url) => {
            // Create warning overlay
            const overlay = document.createElement('div');
            overlay.className = 'phish-guard-blocked';
            overlay.innerHTML = `
                <div style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    color: white;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                    padding: 20px;
                    text-align: center;
                ">
                    <h1 style="font-size: 24px; margin-bottom: 20px;">⚠️ BLOCKED BY PHISH GUARD</h1>
                    <p style="margin-bottom: 20px; max-width: 400px;">
                        This website has been blocked because it's on the phishing/malware blacklist.
                    </p>
                    <p style="margin-bottom: 30px; font-family: monospace; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px;">
                        ${url}
                    </p>
                    <div style="display: flex; gap: 10px;">
                        <button id="goBack" style="
                            padding: 10px 20px;
                            background: white;
                            color: #dc2626;
                            border: none;
                            border-radius: 6px;
                            font-weight: bold;
                            cursor: pointer;
                        ">Go Back</button>
                        <button id="proceedAnyway" style="
                            padding: 10px 20px;
                            background: transparent;
                            color: white;
                            border: 2px solid white;
                            border-radius: 6px;
                            font-weight: bold;
                            cursor: pointer;
                        ">Proceed Anyway</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(overlay);
            
            // Add event listeners
            document.getElementById('goBack').addEventListener('click', () => {
                window.history.back();
                overlay.remove();
            });
            
            document.getElementById('proceedAnyway').addEventListener('click', () => {
                overlay.remove();
            });
        },
        args: [url]
    });
}

// Message handling
// Message handling - FIXED VERSION
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_BADGE') {
        // FIX: Check if sender.tab exists
        if (sender && sender.tab && sender.tab.id) {
            updateBadge(message.score, sender.tab.id);
        } else {
            // Fallback: Get active tab
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs[0]) {
                    updateBadge(message.score, tabs[0].id);
                }
            });
        }
        sendResponse({success: true});
    }
    
    // Handle other message types
    if (message.type === 'GET_ANALYSIS') {
        const urlKey = `analysis_${message.url}`;
        chrome.storage.local.get([urlKey], (result) => {
            sendResponse(result[urlKey] || null);
        });
        return true; // Keep channel open for async response
    }
    
    return true;
});
// Initialize
chrome.runtime.onInstalled.addListener(() => {
    // Set default values
    chrome.storage.local.set({
        whitelist: ['google.com', 'github.com', 'stackoverflow.com'],
        blacklist: [],
        scannedCount: 0,
        blockedCount: 0
    });
    
    console.log('Phish Guard extension installed');
});
