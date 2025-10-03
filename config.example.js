// Configuration file for Diary Analyzer Web App
// Copy this file to config.js and fill in your actual values

const CONFIG = {
    // Google OAuth 2.0 Client ID
    // Get this from Google Cloud Console > APIs & Services > Credentials
    GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID_HERE',
    
    // Google API Key
    // Get this from Google Cloud Console > APIs & Services > Credentials
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