// Configuration file for Diary Analyzer Web App
// This file is safe to commit - Client ID is public by design

const CONFIG = {
    // Google OAuth 2.0 Client ID
    // In production, this is injected by Vercel from environment variable
    // Locally, use your own Client ID
    GOOGLE_CLIENT_ID: '1025050561840-jedvsb3bce3gjvj5k081l5afia5h0mnq.apps.googleusercontent.com',
    
    // Google API Key (not needed for OAuth 2.0 flow)
    GOOGLE_API_KEY: 'NOT_NEEDED_FOR_DIRECT_FETCH',
    
    // Application settings
    APP_NAME: 'Diary Analyzer',
    APP_VERSION: '2.0.0',
    
    // Calendar settings
    CALENDAR_SCOPES: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar'
    ],
    
    API_BASE_URL: 'https://diary-analyzer-auth.vercel.app',
    SESSION_REFRESH_BUFFER_SECONDS: 60,
    
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
