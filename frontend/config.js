// Configuration for Diary Analyzer
const CONFIG = {
    // Google OAuth Configuration
    GOOGLE_CLIENT_ID: '1025050561840-jedvsb3bce3gjvj5k081l5afia5h0mnq.apps.googleusercontent.com',
    
    // OAuth Scopes
    GOOGLE_SCOPES: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar'
    ],
    
    // Application Settings
    APP_NAME: 'Diary Analyzer',
    APP_VERSION: '2.1.0',
    
    // Default Settings
    DEFAULT_DATE_RANGE: 'today',
    DEFAULT_VIEW_MODE: 'distribution',
    
    // Debug Mode
    DEBUG: true
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}
