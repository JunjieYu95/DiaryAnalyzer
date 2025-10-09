# 🚀 Diary Analyzer Setup with Supabase

Complete guide to setting up the Diary Analyzer web application with Supabase backend.

## 📋 Prerequisites

1. **Supabase Account** - Sign up at [supabase.com](https://supabase.com)
2. **Google Cloud Console Account** - For OAuth credentials
3. **Node.js & npm** - For local development (optional)
4. **Supabase CLI** - For deploying edge functions

```bash
npm install -g supabase
```

## 🎯 Step-by-Step Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in project details:
   - **Name**: Diary Analyzer
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users
4. Click "Create new project"
5. Wait for project to be ready (~2 minutes)

### 2. Get Supabase Credentials

1. Go to **Project Settings → API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Project API Key (anon, public)**: `eyJxxx...`
   - **Service Role Key** (keep this secret!): `eyJxxx...`

### 3. Configure Google OAuth

#### A. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. **Enable APIs**:
   - Google Calendar API
   - Google+ API (for user info)

4. **Configure OAuth Consent Screen**:
   - Go to **APIs & Services → OAuth consent screen**
   - Choose **External** user type
   - Fill in app information:
     - **App name**: Diary Analyzer
     - **User support email**: your-email@example.com
     - **Developer contact**: your-email@example.com
   - Add scopes:
     - `https://www.googleapis.com/auth/calendar.readonly`
   - Add test users (your email)
   - Click "Save and Continue"

5. **Create OAuth 2.0 Client ID**:
   - Go to **APIs & Services → Credentials**
   - Click "Create Credentials" → "OAuth 2.0 Client ID"
   - **Application type**: Web application
   - **Name**: Diary Analyzer Web
   - **Authorized JavaScript origins**:
     ```
     http://localhost:8000
     https://your-project.supabase.co
     https://yourdomain.com
     ```
   - **Authorized redirect URIs**:
     ```
     http://localhost:8000
     https://your-project.supabase.co/functions/v1/auth-google/callback
     https://yourdomain.com/auth/callback
     ```
   - Click "Create"
   - **Copy Client ID and Client Secret**

#### B. Add Google Credentials to Supabase

1. Go to Supabase Dashboard → **Project Settings → Secrets**
2. Add these secrets:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

### 4. Set Up Database

#### A. Link Local Project to Supabase

```bash
cd backend
supabase init
supabase link --project-ref your-project-ref
```

Find your project ref in Supabase Dashboard → Project Settings → General

#### B. Run Migrations

```bash
cd backend
supabase db push
```

This creates the necessary tables:
- `user_tokens` - Stores Google OAuth tokens
- `calendar_cache` - Caches calendar data (optional)

### 5. Deploy Edge Functions

```bash
cd backend

# Deploy all functions
supabase functions deploy auth-google
supabase functions deploy calendar-events

# Or deploy all at once
supabase functions deploy
```

Verify deployment:
- Go to Supabase Dashboard → Edge Functions
- Check that functions are listed and active

### 6. Configure Frontend

#### A. Update config.js

Create or update `frontend/config.js`:

```javascript
const CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key',
    
    // Google OAuth Configuration (for reference only, not used directly)
    GOOGLE_CLIENT_ID: 'your-client-id.apps.googleusercontent.com',
    
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
    DEBUG: false
};

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
}
```

#### B. Update index.html

Replace the Google Sign-In button implementation with Supabase auth:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diary Analyzer</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <!-- Your UI here -->
    
    <!-- Load configuration first -->
    <script src="config.js"></script>
    
    <!-- Load API clients as ES modules -->
    <script type="module">
        import { supabase } from './src/api/supabase.js';
        import * as auth from './src/api/auth.js';
        import * as calendar from './src/api/calendar.js';
        
        // Make available globally for non-module scripts
        window.supabase = supabase;
        window.auth = auth;
        window.calendar = calendar;
    </script>
    
    <!-- Load main app -->
    <script src="src/app.js"></script>
</body>
</html>
```

### 7. Test Locally

#### A. Start Local Server

```bash
cd frontend
python3 -m http.server 8000
```

#### B. Test Supabase Functions Locally (Optional)

In another terminal:

```bash
cd backend
supabase start
supabase functions serve
```

#### C. Open App

Open `http://localhost:8000` in your browser

### 8. Deploy to Production

#### A. Deploy Frontend

**Option 1: Vercel**
```bash
cd frontend
vercel deploy
```

**Option 2: Netlify**
```bash
cd frontend
netlify deploy
```

**Option 3: Supabase Storage**
Upload static files to Supabase Storage and enable public access

#### B. Update Google OAuth Redirect URIs

Add your production URL to Google Cloud Console:
```
https://yourdomain.com
https://yourdomain.com/auth/callback
```

#### C. Update Frontend Config

Update `config.js` with production URLs

## 🧪 Testing

### Test Authentication Flow

1. Click "Sign In with Google"
2. Should redirect to Google OAuth
3. Grant calendar permissions
4. Should redirect back to app
5. Should see calendar data

### Test API Calls

Open browser console and run:

```javascript
// Test authentication
const authUrl = await window.auth.initiateGoogleAuth();
console.log('Auth URL:', authUrl);

// Test calendar fetch (after authenticating)
const events = await window.calendar.fetchTodayEvents();
console.log('Events:', events);
```

## 🐛 Troubleshooting

### "Supabase configuration missing"

**Solution**: Make sure `config.js` has `SUPABASE_URL` and `SUPABASE_ANON_KEY`

### "Failed to fetch calendar events"

**Solutions**:
1. Check if Google credentials are set in Supabase Dashboard → Secrets
2. Verify OAuth redirect URIs in Google Cloud Console
3. Check edge function logs: `supabase functions logs calendar-events`

### "Invalid authorization token"

**Solutions**:
1. Sign out and sign in again
2. Clear localStorage: `localStorage.clear()`
3. Check if Supabase session is valid

### Edge Function Not Working

**Solutions**:
1. Check function logs:
   ```bash
   supabase functions logs auth-google
   ```
2. Verify environment variables are set
3. Redeploy function:
   ```bash
   supabase functions deploy auth-google --no-verify-jwt
   ```

## 📚 Next Steps

1. ✅ Set up authentication
2. ✅ Deploy edge functions
3. ✅ Test calendar integration
4. 🔲 Add user profile management
5. 🔲 Implement caching for better performance
6. 🔲 Add export functionality (PDF, CSV)
7. 🔲 Deploy to production

## 🔗 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Google Calendar API](https://developers.google.com/calendar)
- [OAuth 2.0 Guide](https://oauth.net/2/)

## 💡 Tips

1. **Use environment variables** for all secrets
2. **Enable Row Level Security** on all tables
3. **Test locally first** before deploying to production
4. **Monitor edge function logs** for debugging
5. **Set up monitoring** with Supabase Dashboard analytics
