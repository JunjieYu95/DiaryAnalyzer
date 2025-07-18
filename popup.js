// DOM elements
const authSection = document.getElementById('authSection');
const loadingSection = document.getElementById('loadingSection');
const authBtn = document.getElementById('authBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');

// Initialize the extension
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthStatus();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    authBtn.addEventListener('click', authenticateUser);
    zoomOutBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'main.html' });
    });
}

// Check authentication status
async function checkAuthStatus() {
    try {
        const result = await chrome.storage.local.get(['accessToken']);
        if (result.accessToken && typeof result.accessToken === 'string') {
            showSection('loading');
            // We have a token, so we can open the main view directly
            chrome.tabs.create({ url: 'main.html' });
            window.close(); // Close the popup
        } else {
            showSection('auth');
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        showSection('auth');
    }
}

// Authenticate user with Google Calendar
async function authenticateUser() {
    try {
        const token = await chrome.identity.getAuthToken({interactive: true});
        
        let actualToken = null;
        if (typeof token === 'string') {
            actualToken = token;
        } else if (typeof token === 'object' && token && token.token) {
            actualToken = token.token;
        }
        
        if (actualToken && typeof actualToken === 'string' && actualToken.length > 0) {
            await chrome.storage.local.set({accessToken: actualToken});
            showSection('loading');
            chrome.tabs.create({ url: 'main.html' });
            window.close(); // Close the popup
        } else {
            showError('Authentication failed. Please try again.');
        }
    } catch (error) {
        console.error('Authentication error:', error);
        showError('Authentication failed. Please try again.');
    }
}

// Show specific section
function showSection(section) {
    authSection.classList.add('hidden');
    loadingSection.classList.add('hidden');
    
    switch (section) {
        case 'auth':
            authSection.classList.remove('hidden');
            break;
        case 'loading':
            loadingSection.classList.remove('hidden');
            break;
    }
}

// Show error message
function showError(message) {
    const errorElement = document.createElement('p');
    errorElement.textContent = message;
    errorElement.style.color = '#dc3545';
    authSection.appendChild(errorElement);
}