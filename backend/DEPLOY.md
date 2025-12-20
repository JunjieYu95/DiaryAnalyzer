# 🚀 Backend Deployment Guide

This guide covers deploying the Supabase Edge Functions for persistent Google OAuth with refresh tokens.

## Prerequisites

1. **Supabase CLI** installed:
   ```bash
   npm install -g supabase
   ```

2. **Supabase Project** created at [supabase.com](https://supabase.com)

3. **Google Cloud Project** with OAuth 2.0 credentials

## Step 1: Configure Google OAuth

### A. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client ID**
5. Select **Web application**
6. Add **Authorized redirect URIs**:
   ```
   http://localhost:8000
   http://localhost:8000/
   https://your-app-domain.com
   https://your-app-domain.com/
   ```
   
   > ⚠️ **Important**: The redirect URI must EXACTLY match `window.location.origin + window.location.pathname` from your app.

7. Copy the **Client ID** and **Client Secret**

### B. Enable Required APIs

In Google Cloud Console, enable:
- Google Calendar API
- Google+ API (for user info)

## Step 2: Set Up Supabase

### A. Link Your Project

```bash
cd backend
supabase init  # If not already initialized
supabase link --project-ref YOUR_PROJECT_REF
```

Find your project ref in Supabase Dashboard → Project Settings → General.

### B. Run Database Migrations

```bash
supabase db push
```

This creates:
- `user_tokens` table with columns for storing Google tokens

### C. Set Environment Secrets

In Supabase Dashboard → Project Settings → Edge Functions → Secrets, add:

| Secret Name | Value |
|-------------|-------|
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret |

Or via CLI:
```bash
supabase secrets set GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
supabase secrets set GOOGLE_CLIENT_SECRET=your-client-secret
```

## Step 3: Deploy Edge Functions

```bash
cd backend

# Deploy all functions
supabase functions deploy auth-google --no-verify-jwt
supabase functions deploy calendar-proxy --no-verify-jwt
```

> Note: `--no-verify-jwt` is used because we're doing our own auth via the API key.

### Verify Deployment

Check Supabase Dashboard → Edge Functions to confirm:
- `auth-google` - Active
- `calendar-proxy` - Active

## Step 4: Update Frontend Config

Update `config.js` with your Supabase URLs:

```javascript
const CONFIG = {
    // Supabase Configuration
    SUPABASE_URL: 'https://YOUR-PROJECT-REF.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key',
    
    // Edge Function URLs
    AUTH_FUNCTION_URL: 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/auth-google',
    CALENDAR_PROXY_URL: 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/calendar-proxy',
    
    // Google OAuth
    GOOGLE_CLIENT_ID: 'your-client-id.apps.googleusercontent.com',
    
    // Enable backend proxy
    USE_BACKEND_PROXY: true,
    
    // ... rest of config
};
```

## Step 5: Test the Flow

1. Start local server:
   ```bash
   python3 -m http.server 8000
   ```

2. Open http://localhost:8000

3. Click "Sign in with Google"

4. Complete Google OAuth consent

5. You should be redirected back and see your calendar data

6. **Test persistence**: Close browser, wait > 1 hour, reopen → Should auto-refresh without re-auth!

## Troubleshooting

### "redirect_uri_mismatch" Error

The redirect URI in your request doesn't match Google's allowed list.

**Fix**: 
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth Client ID
3. Add the exact URI shown in the error to "Authorized redirect URIs"
4. Wait 5 minutes for changes to propagate

### "Token exchange failed" Error

**Check**:
1. Client ID and Secret are correct in Supabase secrets
2. Edge function is deployed and active
3. Check Edge Function logs: `supabase functions logs auth-google`

### "No refresh token" Warning

Google only sends refresh tokens on the first consent. To get a new one:
1. Go to [Google Account Permissions](https://myaccount.google.com/permissions)
2. Remove "Diary Analyzer" app
3. Sign in again with consent prompt

### Edge Function Errors

View logs:
```bash
supabase functions logs auth-google --follow
supabase functions logs calendar-proxy --follow
```

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Frontend      │     │  Supabase Edge   │     │   Google    │
│   (Browser)     │     │   Functions      │     │   OAuth     │
└────────┬────────┘     └────────┬─────────┘     └──────┬──────┘
         │                       │                      │
         │ 1. Click Sign In      │                      │
         │──────────────────────────────────────────────>│
         │                       │                      │
         │ 2. Redirect with code │                      │
         │<──────────────────────────────────────────────│
         │                       │                      │
         │ 3. POST /auth-google  │                      │
         │   {action: exchange}  │                      │
         │──────────────────────>│                      │
         │                       │ 4. Exchange code     │
         │                       │──────────────────────>│
         │                       │                      │
         │                       │ 5. Access + Refresh  │
         │                       │<──────────────────────│
         │                       │                      │
         │                       │ 6. Store in DB       │
         │                       │──────┐               │
         │                       │<─────┘               │
         │                       │                      │
         │ 7. Return tokens      │                      │
         │<──────────────────────│                      │
         │                       │                      │
    ─────┼───────────────────────┼──────────────────────┼─────
         │  LATER (token expired)│                      │
    ─────┼───────────────────────┼──────────────────────┼─────
         │                       │                      │
         │ 8. POST /auth-google  │                      │
         │   {action: refresh}   │                      │
         │──────────────────────>│                      │
         │                       │ 9. Use refresh token │
         │                       │──────────────────────>│
         │                       │                      │
         │                       │ 10. New access token │
         │                       │<──────────────────────│
         │                       │                      │
         │ 11. Fresh token!      │                      │
         │<──────────────────────│                      │
         │                       │                      │
```

## Security Notes

1. **Refresh tokens are stored server-side** in Supabase, never exposed to the browser
2. **Client Secret is server-side only** in Edge Function secrets
3. **Access tokens are short-lived** (1 hour) and refreshed automatically
4. **Row Level Security (RLS)** protects user data in the database
