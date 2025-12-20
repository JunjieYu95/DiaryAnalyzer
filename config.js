// Configuration file for Diary Analyzer Web App
// This file is safe to commit - Client ID is public by design

const CONFIG = {
    // Google OAuth 2.0 Client ID
    // In production, this is injected by Vercel from environment variable
    GOOGLE_CLIENT_ID: '1025050561840-jedvsb3bce3gjvj5k081l5afia5h0mnq.apps.googleusercontent.com',
    
    // OAuth Scopes
    GOOGLE_SCOPES: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar'
    ],
    
    // Application settings
    APP_NAME: 'Diary Analyzer',
    APP_VERSION: '2.1.0',
    
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
