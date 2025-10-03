# Setup Guide for Diary Analyzer Web App

## Quick Setup (5 minutes)

### 1. Google Cloud Console Setup

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**
2. **Create a new project** (or select existing one)
3. **Enable APIs:**
   - Go to "APIs & Services" → "Library"
   - Search for "Google Calendar API" and enable it
   - Search for "Google Identity Services API" and enable it

4. **Create OAuth 2.0 Credentials:**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Choose "Web application"
   - Add authorized origins: `http://localhost:8000`
   - Copy the **Client ID**

5. **Create API Key:**
   - In "Credentials" section
   - Click "Create Credentials" → "API key"
   - Copy the **API Key**

### 2. Configure the Application

1. **Copy the example config:**
   ```bash
   cp config.example.js config.js
   ```

2. **Edit `config.js`:**
   ```javascript
   const CONFIG = {
       GOOGLE_CLIENT_ID: 'your-actual-client-id-here',
       GOOGLE_API_KEY: 'your-actual-api-key-here',
       // ... other settings
   };
   ```

3. **Update `index.html`:**
   - Replace `YOUR_GOOGLE_CLIENT_ID_HERE` with your actual Client ID

### 3. Run the Application

```bash
# Using Python (recommended)
python -m http.server 8000

# Or using Node.js
npm run serve

# Or using any other local server
```

4. **Open your browser:**
   - Go to `http://localhost:8000`
   - Click "Sign in with Google"
   - Grant calendar permissions
   - Start using the app!

## Troubleshooting

### "Authentication failed"
- Check that your Client ID is correct in both `config.js` and `index.html`
- Verify that `http://localhost:8000` is added to authorized origins
- Make sure Google Calendar API is enabled

### "No events showing"
- Check that you have events in your Google Calendar
- Verify the date range selection
- Try refreshing the data

### "API errors"
- Ensure Google Calendar API is enabled
- Check that your API key is correct
- Verify OAuth consent screen is configured

## Production Deployment

For production deployment:

1. **Update OAuth settings:**
   - Add your production domain to authorized origins
   - Update redirect URIs

2. **Use HTTPS:**
   - Google OAuth requires HTTPS in production
   - Update your server configuration

3. **Environment variables:**
   - Store credentials securely
   - Use environment variables instead of config files

## Need Help?

- Check the browser console for error messages
- Review the main README-WEB-APP.md for detailed documentation
- Open an issue on GitHub if you encounter problems