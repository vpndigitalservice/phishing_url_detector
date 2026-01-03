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
const settingsLink = document.getElementById('settingsLink');
const helpLink = document.getElementById('helpLink');

// State
let currentTab = null;
let currentRiskScore = 0;

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadStats();
    await updateCurrentTabInfo();
    setupEventListeners();
    startAutoRefresh();
}

async function loadStats() {
    const stats = await chrome.storage.local.get(['scannedCount', 'blockedCount']);
    scannedCount.textContent = stats.scannedCount || 0;
    blockedCount.textContent = stats.blockedCount || 0;
}

async function updateCurrentTabInfo() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            currentTab = tabs[0];
            currentUrl.textContent = currentTab.url || 'No URL available';
            
            // Get stored analysis for this URL
            const urlKey = `analysis_${currentTab.url}`;
            const analysis = await chrome.storage.local.get([urlKey]);
            
            if (analysis[urlKey]) {
                updateRiskDisplay(analysis[urlKey]);
            } else {
                // Perform initial quick analysis
                const quickAnalysis = performQuickAnalysis(currentTab.url);
                updateRiskDisplay(quickAnalysis);
            }
        }
    } catch (error) {
        console.error('Error getting tab info:', error);
        currentUrl.textContent = 'Error loading URL';
    }
}

function performQuickAnalysis(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const warnings = [];
        let score = 0;
        
        // === BRAND IMPERSONATION DETECTION (NEW) ===
        const brands = ['facebook', 'google', 'microsoft', 'apple', 'amazon', 'paypal', 'netflix', 'instagram', 'twitter'];
        const isBrandImpersonation = brands.some(brand => {
            // Check if domain contains brand name but isn't the official domain
            return hostname.includes(brand) && 
                   !hostname.endsWith(`${brand}.com`) &&
                   !hostname.endsWith(`www.${brand}.com`);
        });
        
        if (isBrandImpersonation) {
            warnings.push(`🚨 Possible brand impersonation: ${hostname}`);
            score += 60; // Major penalty
        }
        
        // === IP ADDRESS DETECTION (FIXED) ===
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        const isIpAddress = ipPattern.test(hostname);
        
        if (isIpAddress) {
            warnings.push('🚨 Uses IP address instead of domain name');
            score += 70; // Very suspicious
        }
        
        // === HTTPS CHECK ===
        if (urlObj.protocol === 'https:') {
            score -= 25; // HTTPS is good
        } else {
            if (!isIpAddress) { // Don't duplicate warning for IPs
                warnings.push('⚠️ Not using HTTPS');
            }
            score += 40; // HTTP penalty
        }
        
        // === SUSPICIOUS TLD DETECTION (FIXED) ===
        const suspiciousTLDs = ['.xyz', '.top', '.club', '.info', '.bid', '.win', '.tk', '.ml', '.ga', '.cf', '.gq'];
        const hasSuspiciousTLD = suspiciousTLDs.some(tld => hostname.endsWith(tld));
        
        if (hasSuspiciousTLD) {
            warnings.push('⚠️ Suspicious domain extension');
            score += 35;
        }
        
        // === DASH COUNT DETECTION ===
        const dashCount = (hostname.match(/-/g) || []).length;
        if (dashCount >= 2) {
            warnings.push(`⚠️ ${dashCount} dashes in domain (phishing pattern)`);
            score += dashCount * 12;
        }
        
        // === PHISHING KEYWORDS ===
        const phishingKeywords = ['login', 'secure', 'verify', 'account', 'bank', 'signin', 'password', 'wallet', 'crypto'];
        const hasPhishingKeyword = phishingKeywords.some(keyword => hostname.includes(keyword));
        
        if (hasPhishingKeyword && !isBrandImpersonation) {
            warnings.push('⚠️ Security keywords in domain');
            score += 25;
        }
        
        // === WHITELIST/BLACKLIST CHECK ===
        // Note: This runs asynchronously, so we handle it separately
        chrome.storage.local.get(['whitelist', 'blacklist'], (data) => {
            if (data.whitelist && data.whitelist.some(w => hostname.includes(w))) {
                // Force low score for whitelisted
                score = Math.min(score, 10);
            }
            if (data.blacklist && data.blacklist.includes(hostname)) {
                score = 95; // Force high score for blacklisted
            }
        });
        
        // === DOMAIN LENGTH CHECK ===
        if (hostname.length > 35) {
            warnings.push('⚠️ Very long domain name');
            score += 20;
        }
        
        // === ENSURE SCORE BOUNDS ===
        score = Math.max(0, Math.min(100, score));
        
        return {
            score: score,
            warnings: warnings,
            timestamp: Date.now(),
            hostname: hostname,
            isIpAddress: isIpAddress,
            isBrandImpersonation: isBrandImpersonation
        };
        
    } catch (error) {
        console.error('URL analysis error:', error, 'URL:', url);
        
        // If URL parsing fails, it might be a malformed/malicious URL
        if (url.includes('://')) {
            return {
                score: 80,
                warnings: ['🚨 Malformed or suspicious URL format'],
                timestamp: Date.now()
            };
        }
        
        return {
            score: 50,
            warnings: ['⚠️ Could not analyze URL'],
            timestamp: Date.now()
        };
    }
}

function updateRiskDisplay(analysis) {
    currentRiskScore = analysis.score;
    
    // Update score display
    scoreValue.textContent = `${analysis.score}/100`;
    scoreFill.style.width = `${analysis.score}%`;
    
    // Update status dot and text
    if (analysis.score < 30) {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Safe';
    } else if (analysis.score < 70) {
        statusDot.className = 'status-dot warning';
        statusText.textContent = 'Suspicious';
    } else {
        statusDot.className = 'status-dot danger';
        statusText.textContent = 'Dangerous';
    }
    
    // Update warnings
    if (analysis.warnings && analysis.warnings.length > 0) {
        warningsList.innerHTML = analysis.warnings
            .map(warning => `<div class="warning-item">${warning}</div>`)
            .join('');
    } else {
        warningsList.textContent = 'No warnings detected';
    }
}

function setupEventListeners() {
    // Scan Button
    scanBtn.addEventListener('click', async () => {
        scanBtn.disabled = true;
        scanBtn.innerHTML = '⏳ Scanning...';
        
        // Perform deep scan
        const analysis = await performDeepScan(currentTab.url);
        updateRiskDisplay(analysis);
        
        // Update stats
        const stats = await chrome.storage.local.get(['scannedCount']);
        const newCount = (stats.scannedCount || 0) + 1;
        await chrome.storage.local.set({ scannedCount: newCount });
        scannedCount.textContent = newCount;
        
        // Save analysis
        const urlKey = `analysis_${currentTab.url}`;
        await chrome.storage.local.set({ [urlKey]: analysis });
        
        // Update badge
        await chrome.runtime.sendMessage({
            type: 'UPDATE_BADGE',
            score: analysis.score
        });
        
        // Reset button
        setTimeout(() => {
            scanBtn.disabled = false;
            scanBtn.innerHTML = '🔍 Scan Now';
        }, 1000);
    });
    
    // Whitelist Button
    whitelistBtn.addEventListener('click', async () => {
        if (!currentTab?.url) return;
        
        const urlObj = new URL(currentTab.url);
        const whitelistData = await chrome.storage.local.get(['whitelist']);
        const whitelist = whitelistData.whitelist || [];
        
        if (!whitelist.includes(urlObj.hostname)) {
            whitelist.push(urlObj.hostname);
            await chrome.storage.local.set({ whitelist: whitelist });
            
            // Update display
            const analysis = performQuickAnalysis(currentTab.url);
            updateRiskDisplay(analysis);
            
            // Show confirmation
            whitelistBtn.innerHTML = '✅ Whitelisted!';
            setTimeout(() => {
                whitelistBtn.innerHTML = '✅ Whitelist Site';
            }, 2000);
        }
    });
    
    // Report Button
    reportBtn.addEventListener('click', async () => {
        if (!currentTab?.url) return;
        
        const urlObj = new URL(currentTab.url);
        const reportData = {
            url: currentTab.url,
            hostname: urlObj.hostname,
            timestamp: Date.now(),
            reason: prompt('Reason for reporting (phishing, malware, scam):') || 'Not specified'
        };
        
        // Store report locally
        const reportsData = await chrome.storage.local.get(['reports']);
        const reports = reportsData.reports || [];
        reports.push(reportData);
        await chrome.storage.local.set({ reports: reports });
        
        // Update blocked count
        const stats = await chrome.storage.local.get(['blockedCount']);
        const newCount = (stats.blockedCount || 0) + 1;
        await chrome.storage.local.set({ blockedCount: newCount });
        blockedCount.textContent = newCount;
        
        // Add to blacklist
        const blacklistData = await chrome.storage.local.get(['blacklist']);
        const blacklist = blacklistData.blacklist || [];
        if (!blacklist.includes(urlObj.hostname)) {
            blacklist.push(urlObj.hostname);
            await chrome.storage.local.set({ blacklist: blacklist });
        }
        
        // Show confirmation
        reportBtn.innerHTML = '⚠️ Reported!';
        setTimeout(() => {
            reportBtn.innerHTML = '⚠️ Report Phishing';
        }, 2000);
    });
    
    // Settings Link
    settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.runtime.openOptionsPage();
    });
    
    // Help Link
    helpLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'https://example.com/help' });
    });
}

async function performDeepScan(url) {
    try{
        const response = await fetch("http://127.0.0.1:5000/predict",{
            method: "POST",
            headers: {
                "Content-Type":"application/json"
            },
            body: JSON.stringify({ url: url})
        });

        const data = await response.json();

        return{
            score: data.risk_score,
            warnings: [
                data.prediction === "Phishing"
                ? "🚨 ML model detected phishing behavior"
                : "✅ ML model considers this safe"
            ],
            mlScore: data.risk_score,
            timestamp: Date.now()
        };
           
        } catch (error){
            console.error("Backend  error:", error);
            return{
                score: 50,
                warnings: ["⚠️ Backend unavailable"],
            timestamp: Date.now()
            };
        }

    }
//     // Simulate API call to backend
//     return new Promise(resolve => {
//         setTimeout(() => {
//             const analysis = performQuickAnalysis(url);
//             // Add more detailed analysis
//             analysis.score += Math.random() * 20 - 10; // Simulate ML analysis
//             analysis.score = Math.max(0, Math.min(100, analysis.score));
//             analysis.warnings.push('Deep scan completed');
//             analysis.mlScore = Math.round(Math.random() * 100);
//             resolve(analysis);
//         }, 1500);
//     });
// }

function startAutoRefresh() {
    // Update every 5 seconds if popup stays open
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            updateCurrentTabInfo();
        }
    }, 5000);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ANALYSIS_UPDATE') {
        updateRiskDisplay(message.analysis);
    }
});

// Add this to popup.js after the existing functions
async function runTestSuite() {
    console.log('=== Running Phish Guard Tests ===');
    
    const testCases = [
        { url: 'https://google.com', expected: 'green', reason: 'HTTPS + trusted' },
        { url: 'http://example.com', expected: 'yellow', reason: 'No HTTPS' },
        { url: 'http://secure-login-verify-account.com', expected: 'red', reason: 'Multiple dashes + HTTP' },
        { url: 'http://123.456.789.012/login', expected: 'red', reason: 'IP address + login' },
        { url: 'https://phishing.xyz', expected: 'yellow', reason: 'Suspicious TLD' },
    ];
    
    for (const testCase of testCases) {
        const analysis = performQuickAnalysis(testCase.url);
        let color = 'yellow';
        if (analysis.score < 30) color = 'green';
        if (analysis.score >= 70) color = 'red';
        
        console.log(`Test: ${testCase.url}`);
        console.log(`  Score: ${analysis.score}, Expected: ${testCase.expected}, Got: ${color}`);
        console.log(`  Result: ${color === testCase.expected ? 'PASS' : 'FAIL'} - ${testCase.reason}`);
        console.log(`  Warnings: ${analysis.warnings.join(', ')}`);
        console.log('---');
    }
}

// Add this function to popup.js
async function testAllScenarios() {
    console.log('🧪 RUNNING COMPREHENSIVE PHISH GUARD TESTS 🧪\n');
    
    const testCases = [
        {
            url: 'https://www.google.com',
            expected: 'GREEN',
            minScore: 0,
            maxScore: 20,
            description: 'Trusted HTTPS site with simple domain'
        },
        {
            url: 'http://example.com',
            expected: 'YELLOW',
            minScore: 30,
            maxScore: 59,
            description: 'HTTP site without suspicious patterns'
        },
        {
            url: 'http://secure-login-verify-account.com',
            expected: 'RED',
            minScore: 70,
            maxScore: 100,
            description: 'HTTP + multiple dashes + phishing keywords'
        },
        {
            url: 'https://login.facebook-secure-verify.com',
            expected: 'RED',
            minScore: 70,
            maxScore: 100,
            description: 'HTTPS but with brand impersonation'
        },
        {
            url: 'http://123.456.789.012/login.php',
            expected: 'RED',
            minScore: 80,
            maxScore: 100,
            description: 'IP address + login page'
        },
        {
            url: 'https://phishing-site.xyz',
            expected: 'YELLOW/RED',
            minScore: 40,
            maxScore: 80,
            description: 'Suspicious TLD (.xyz)'
        },
        {
            url: 'http://free-gift-reward-claim-now-win.com',
            expected: 'RED',
            minScore: 70,
            maxScore: 100,
            description: 'Multiple dashes + long domain + HTTP'
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of testCases) {
        const analysis = performQuickAnalysis(test.url);
        const color = analysis.score < 25 ? 'GREEN' : analysis.score < 60 ? 'YELLOW' : 'RED';
        
        const passedTest = color === test.expected || 
                          (test.expected.includes('/') && test.expected.includes(color));
        
        console.log(`🔗 ${test.url}`);
        console.log(`   Score: ${analysis.score} (${color})`);
        console.log(`   Expected: ${test.expected} (${test.minScore}-${test.maxScore})`);
        console.log(`   Result: ${passedTest ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`   Warnings: ${analysis.warnings.length ? analysis.warnings.join(', ') : 'None'}`);
        console.log(`   Description: ${test.description}\n`);
        
        if (passedTest) passed++;
        else failed++;
        
        // Wait a bit between tests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`📊 SUMMARY: ${passed} passed, ${failed} failed`);
    
    // Test badge updates
    console.log('\n🛡️ Testing badge updates...');
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (tabs[0]) {
        chrome.runtime.sendMessage({
            type: 'UPDATE_BADGE',
            score: 10
        }, () => console.log('Green badge test sent'));
        
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: 'UPDATE_BADGE',
                score: 40
            }, () => console.log('Yellow badge test sent'));
        }, 1000);
        
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: 'UPDATE_BADGE',
                score: 80
            }, () => console.log('Red badge test sent'));
        }, 2000);
    }
}

// Helper: Validate IP address format
function isValidIP(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    
    for (const part of parts) {
        const num = parseInt(part, 10);
        if (isNaN(num) || num < 0 || num > 255 || part !== num.toString()) {
            return false;
        }
    }
    return true;
}

// Update test cases in testAllScenarios function:
const testCases = [
    // ... keep existing tests ...
    {
        url: 'http://192.168.1.1/login.php',
        expected: 'RED',
        minScore: 70,
        maxScore: 100,
        description: 'Valid IP address + login page'
    },
    {
        url: 'http://123.456.789.012/login.php',
        expected: 'RED/YELLOW',
        minScore: 50,
        maxScore: 100,
        description: 'Invalid IP format (should still be suspicious)'
    },
    {
        url: 'https://login.facebook-secure-verify.com',
        expected: 'RED',
        minScore: 60,
        maxScore: 100,
        description: 'Facebook impersonation + HTTPS'
    },
    {
        url: 'https://phishing-site.xyz',
        expected: 'YELLOW',
        minScore: 25,
        maxScore: 60,
        description: 'Suspicious TLD (.xyz) with HTTPS'
    },
    {
        url: 'http://phishing-site.xyz',
        expected: 'RED',
        minScore: 60,
        maxScore: 100,
        description: 'Suspicious TLD (.xyz) without HTTPS'
    }
];