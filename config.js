// Configuration file for Diary Analyzer Web App
// This file is safe to commit - Client ID is public by design

const CONFIG = {
    // Google OAuth 2.0 Client ID
    // In production, this is injected by Vercel from environment variable
    // Locally, use your own Client ID
    GOOGLE_CLIENT_ID: '1025050561840-jedvsb3bce3gjvj5k081l5afia5h0mnq.apps.googleusercontent.com',
    
    // Google API Key (not needed for OAuth 2.0 flow)
    GOOGLE_API_KEY: 'NOT_NEEDED_FOR_DIRECT_FETCH',
    
    // Supabase Configuration
    SUPABASE_URL: 'https://kiddsrordcksmqbxyerv.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZGRzcm9yZGNrc21xYnh5ZXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MTM2MzYsImV4cCI6MjA3NTI4OTYzNn0.EJWsHLDaRMdHAMgGq5cVemYyHtJGyqsQSOOD7B2Cigk',
    
    // Application settings
    APP_NAME: 'Diary Analyzer',
    APP_VERSION: '2.0.0',
    
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
