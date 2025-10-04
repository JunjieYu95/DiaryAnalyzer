// Configuration file for Diary Analyzer Web App
const CONFIG = {
    // Google OAuth 2.0 Client ID
    GOOGLE_CLIENT_ID: '1025050561840-jedvsb3bce3gjvj5k081l5afia5h0mnq.apps.googleusercontent.com',
    
    // Google API Key (not used in web app OAuth flow)
    GOOGLE_API_KEY: 'YOUR_GOOGLE_API_KEY_HERE',
    
    // Application settings
    APP_NAME: 'Diary Analyzer',
    APP_VERSION: '1.0.0',
    
    // Calendar settings
    CALENDAR_SCOPES: [
        'https://www.googleapis.com/auth/calendar.readonly'
    ],
    
    // Default settings
    DEFAULT_DATE_RANGE: 'today',
    DEFAULT_VIEW_MODE: 'distribution',
    
    // Debug mode
    DEBUG: false
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}
