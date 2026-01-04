console.log("⚙️ Settings page loaded");

// DOM Elements
const protectionLevel = document.getElementById('protectionLevel');
const autoScan = document.getElementById('autoScan');
const blockDangerous = document.getElementById('blockDangerous');
const showWarnings = document.getElementById('showWarnings');
const soundAlerts = document.getElementById('soundAlerts');
const shareReports = document.getElementById('shareReports');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const saveBtn = document.getElementById('saveBtn');
const backBtn = document.getElementById('backBtn');

// Load saved settings
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
        
        // Apply saved settings
        protectionLevel.value = settings.protectionLevel || 'medium';
        autoScan.checked = settings.autoScan !== false; // default true
        blockDangerous.checked = settings.blockDangerous !== false;
        showWarnings.checked = settings.showWarnings !== false;
        soundAlerts.checked = settings.soundAlerts || false;
        shareReports.checked = settings.shareReports || false;
        
        console.log("✅ Settings loaded:", settings);
    } catch (error) {
        console.error("❌ Error loading settings:", error);
    }
}

// Save settings
async function saveSettings() {
    try {
        const settings = {
            protectionLevel: protectionLevel.value,
            autoScan: autoScan.checked,
            blockDangerous: blockDangerous.checked,
            showWarnings: showWarnings.checked,
            soundAlerts: soundAlerts.checked,
            shareReports: shareReports.checked,
            lastUpdated: Date.now()
        };
        
        await chrome.storage.local.set(settings);
        console.log("💾 Settings saved:", settings);
        
        // Show confirmation
        saveBtn.textContent = "✅ Saved!";
        setTimeout(() => {
            saveBtn.textContent = "💾 Save Settings";
        }, 2000);
        
    } catch (error) {
        console.error("❌ Error saving settings:", error);
        saveBtn.textContent = "❌ Error!";
        setTimeout(() => {
            saveBtn.textContent = "💾 Save Settings";
        }, 2000);
    }
}

// Clear history
clearHistoryBtn.addEventListener('click', async () => {
    if (confirm("Clear all scan history and statistics?")) {
        try {
            await chrome.storage.local.set({
                scannedCount: 0,
                blockedCount: 0,
                whitelist: [],
                blacklist: [],
                reports: []
            });
            
            clearHistoryBtn.textContent = "✅ Cleared!";
            setTimeout(() => {
                clearHistoryBtn.textContent = "Clear Now";
            }, 2000);
            
            console.log("🧹 History cleared");
        } catch (error) {
            console.error("Error clearing history:", error);
        }
    }
});

// Back button
backBtn.addEventListener('click', () => {
    window.close(); // Close settings tab/popup
});

// Save button
saveBtn.addEventListener('click', saveSettings);

// Load settings on page load
document.addEventListener('DOMContentLoaded', loadSettings);