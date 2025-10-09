# ⚡ Quick Start Guide

## 🚨 **CRITICAL: Complete These 2 Steps NOW**

### Step 1: Add Google Client Secret to Supabase (2 minutes)

1. **Get your Client Secret:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Find OAuth Client ID: `1025050561840-jedvsb3bce3gjvj5k081l5afia5h0mnq`
   - View or download the secret

2. **Add to Supabase:**
   - Go to: https://supabase.com/dashboard/project/kiddsrordcksmqbxyerv/settings/vault
   - Click "New secret"
   - Add both:
     - `GOOGLE_CLIENT_ID` = `1025050561840-jedvsb3bce3gjvj5k081l5afia5h0mnq.apps.googleusercontent.com`
     - `GOOGLE_CLIENT_SECRET` = `your-secret-here`

### Step 2: Update Google OAuth Redirect URIs (1 minute)

1. Go to: https://console.cloud.google.com/apis/credentials
2. Edit your OAuth 2.0 Client
3. Add to **"Authorized redirect URIs"**:
   ```
   https://kiddsrordcksmqbxyerv.supabase.co/functions/v1/auth-google/callback
   http://localhost:8000/auth/callback
   ```
4. Save

---

## 🧪 **Test Your Setup (5 minutes)**

### Test 1: Edge Function Works
Open in browser:
```
https://kiddsrordcksmqbxyerv.supabase.co/functions/v1/auth-google
```
✅ Should return JSON with `authUrl`

### Test 2: Frontend Loads
```bash
cd frontend
python3 -m http.server 8000
```
Open: http://localhost:8000

---

## 📁 **File Structure Overview**

```
Your Current State:
├── frontend/
│   ├── config.js           ✅ CREATED - Has Supabase credentials
│   ├── src/api/            ✅ CREATED - API client layer
│   └── public/             📝 TODO - Move your HTML/CSS here
│
├── backend/
│   └── supabase/
│       ├── functions/      ✅ DEPLOYED to Supabase
│       └── migrations/     ✅ APPLIED to database
│
└── Your existing files:    📝 TODO - Need to migrate
    ├── index.html
    ├── app.js
    └── styles.css
```

---

## 🔄 **Migrate Your Existing Code (30 minutes)**

Follow: `MIGRATION-GUIDE.md`

**Quick version:**

1. **Move files:**
   ```bash
   mv index.html frontend/public/
   mv styles.css frontend/public/
   mv app.js frontend/src/
   ```

2. **Update `index.html`** to load Supabase:
   ```html
   <script src="../config.js"></script>
   <script type="module">
     import { supabase } from '../src/api/supabase.js';
     import * as auth from '../src/api/auth.js';
     import * as calendar from '../src/api/calendar.js';
     window.supabase = supabase;
     window.auth = auth;
     window.calendar = calendar;
   </script>
   <script src="../src/app.js"></script>
   ```

3. **Update `app.js`** authentication:
   ```javascript
   // OLD (remove this):
   // google.accounts.id.initialize(...)
   
   // NEW (use this):
   async function authenticateUser() {
       const authUrl = await window.auth.initiateGoogleAuth();
       window.location.href = authUrl;
   }
   ```

4. **Update `app.js`** calendar fetching:
   ```javascript
   // OLD (remove this):
   // fetch('https://www.googleapis.com/calendar/...')
   
   // NEW (use this):
   async function loadCalendarData() {
       const events = await window.calendar.fetchCalendarEvents({
           timeMin: getDateRangeStart().toISOString(),
           timeMax: getDateRangeEnd().toISOString()
       });
       allEvents = events;
       // ... rest of your code
   }
   ```

---

## 🐛 **Troubleshooting**

### "Failed to fetch calendar events"
**Fix:** Check that `GOOGLE_CLIENT_SECRET` is added to Supabase secrets

### "OAuth redirect URI mismatch"
**Fix:** Add redirect URI to Google Cloud Console (see Step 2 above)

### "Module not found"
**Fix:** Use `python3 -m http.server` to serve files (don't just open HTML)

### View Logs
```bash
export SUPABASE_ACCESS_TOKEN="sbp_a4b0d874131035bbf241493ef2d5a41bb5acc378"
supabase functions logs auth-google
supabase functions logs calendar-events
```

---

## 📚 **Full Documentation**

- `SUPABASE-SETUP-STATUS.md` - Setup status and next steps
- `MIGRATION-GUIDE.md` - Detailed migration instructions
- `docs/SETUP-SUPABASE.md` - Complete setup guide
- `ARCHITECTURE.md` - System architecture

---

## ✅ **Checklist**

- [ ] Added `GOOGLE_CLIENT_SECRET` to Supabase
- [ ] Updated Google OAuth redirect URIs
- [ ] Tested edge functions work
- [ ] Moved frontend files to new structure
- [ ] Updated `app.js` to use new API
- [ ] Updated `index.html` to load modules
- [ ] Tested authentication flow
- [ ] Tested calendar data fetching

---

## 🎯 **What You Get**

✅ **Proper OAuth 2.0** - No more token errors!
✅ **Secure tokens** - Stored in database, not localStorage
✅ **Auto refresh** - Tokens refresh automatically
✅ **Production ready** - Scalable architecture
✅ **No client secret exposure** - Backend handles security

---

## 🚀 **You're Almost Done!**

Just complete the 2 critical steps at the top, then follow the migration guide!

**Questions?** Check `SUPABASE-SETUP-STATUS.md` for detailed info.
