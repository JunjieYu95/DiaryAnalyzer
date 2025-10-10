// Configuration file for Diary Analyzer Web App
// This file is safe to commit - Client ID is public by design

const CONFIG = {
    // Google OAuth 2.0 Client ID
    // In production, this is injected by Vercel from environment variable
    // Locally, use your own Client ID
    GOOGLE_CLIENT_ID: 'YOUR_GOOGLE_CLIENT_ID_HERE',
    
    // Google API Key (not needed for OAuth 2.0 flow)
    GOOGLE_API_KEY: 'NOT_NEEDED_FOR_DIRECT_FETCH',
    
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
