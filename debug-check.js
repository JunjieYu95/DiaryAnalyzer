// Debug script to check environment
console.log('=== DIAGNOSTIC INFORMATION ===');
console.log('Current URL:', window.location.href);
console.log('Document title:', document.title);
console.log('Chart.js available:', typeof Chart !== 'undefined');
console.log('DOM Elements present:');
console.log('- viewMode selector:', !!document.getElementById('viewMode'));
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

console.log('=== END DIAGNOSTIC ==='); 