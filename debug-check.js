// Debug script to check environment
console.log('=== DIAGNOSTIC INFORMATION ===');
console.log('Current URL:', window.location.href);
console.log('Document title:', document.title);
console.log('Chart.js available:', typeof Chart !== 'undefined');

// Check Chrome extension APIs
console.log('Chrome extension APIs:');
console.log('- chrome.identity available:', typeof chrome !== 'undefined' && typeof chrome.identity !== 'undefined');
console.log('- chrome.storage available:', typeof chrome !== 'undefined' && typeof chrome.storage !== 'undefined');
console.log('- chrome.tabs available:', typeof chrome !== 'undefined' && typeof chrome.tabs !== 'undefined');

console.log('DOM Elements present:');
console.log('- viewMode selector:', !!document.getElementById('viewMode'));
console.log('- authBtn:', !!document.getElementById('authBtn'));
console.log('- authSection:', !!document.getElementById('authSection'));
console.log('- advancedContainer:', !!document.getElementById('advancedContainer'));
console.log('- timeSeriesChart:', !!document.getElementById('timeSeriesChart'));
console.log('- zoomOutBtn:', !!document.getElementById('zoomOutBtn'));

// Check which script is actually running
console.log('Current script file: debug-check.js');

if (typeof Chart === 'undefined') {
    console.error('❌ Chart.js is NOT loaded!');
} else {
    console.log('✅ Chart.js is loaded, version:', Chart.version);
}

// Check if advanced elements exist
const advancedContainer = document.getElementById('advancedContainer');
if (advancedContainer) {
    console.log('✅ Advanced container found');
} else {
    console.log('❌ Advanced container NOT found');
}

// Test auth button functionality
const authBtn = document.getElementById('authBtn');
if (authBtn) {
    console.log('✅ Auth button found');
    console.log('Auth button event listeners:', authBtn.cloneNode(false));
    
    // Add a test click handler to debug
    authBtn.addEventListener('click', function() {
        console.log('🔍 DEBUG: Auth button clicked!');
        console.log('Chrome identity API:', typeof chrome.identity);
        if (typeof chrome.identity !== 'undefined') {
            console.log('Chrome identity available, attempting auth...');
        } else {
            console.error('❌ Chrome identity API not available!');
        }
    });
} else {
    console.log('❌ Auth button NOT found');
}

// Check for stored tokens
if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['accessToken']).then(result => {
        if (result.accessToken) {
            console.log('✅ Stored access token found');
        } else {
            console.log('❌ No stored access token');
        }
    });
}

console.log('=== END DIAGNOSTIC ==='); 