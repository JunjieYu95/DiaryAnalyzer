// Configuration for Diary Analyzer with Supabase
const CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://kiddsrordcksmqbxyerv.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZGRzcm9yZGNrc21xYnh5ZXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MTM2MzYsImV4cCI6MjA3NTI4OTYzNn0.EJWsHLDaRMdHAMgGq5cVemYyHtJGyqsQSOOD7B2Cigk',
    
    // Google OAuth Configuration (for reference)
    GOOGLE_CLIENT_ID: '1025050561840-jedvsb3bce3gjvj5k081l5afia5h0mnq.apps.googleusercontent.com',
    
    // Application Settings
    APP_NAME: 'Diary Analyzer',
    APP_VERSION: '2.0.0',
    
    // Calendar Settings
    CALENDAR_SCOPES: [
        'https://www.googleapis.com/auth/calendar.readonly'
    ],
    
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

