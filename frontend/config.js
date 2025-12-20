// Configuration for Diary Analyzer with Supabase Backend
const CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://kiddsrordcksmqbxyerv.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZGRzcm9yZGNrc21xYnh5ZXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MTM2MzYsImV4cCI6MjA3NTI4OTYzNn0.EJWsHLDaRMdHAMgGq5cVemYyHtJGyqsQSOOD7B2Cigk',
    
    // Supabase Edge Function URLs
    AUTH_FUNCTION_URL: 'https://kiddsrordcksmqbxyerv.supabase.co/functions/v1/auth-google',
    CALENDAR_PROXY_URL: 'https://kiddsrordcksmqbxyerv.supabase.co/functions/v1/calendar-proxy',
    
    // Google OAuth Configuration
    GOOGLE_CLIENT_ID: '1025050561840-jedvsb3bce3gjvj5k081l5afia5h0mnq.apps.googleusercontent.com',
    
    // OAuth Scopes - requesting offline access for refresh tokens
    GOOGLE_SCOPES: [
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ],
    
    // Application Settings
    APP_NAME: 'Diary Analyzer',
    APP_VERSION: '2.1.0',
    
    // Default Settings
    DEFAULT_DATE_RANGE: 'today',
    DEFAULT_VIEW_MODE: 'distribution',
    
    // Debug Mode
    DEBUG: true,
    
    // Use backend proxy for API calls (enables refresh tokens)
    USE_BACKEND_PROXY: true
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}

