# 📊 Diary Analyzer

Beautiful time series visualization for your Google Calendar diary entries.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🎯 Overview

Diary Analyzer is a web application that connects to your Google Calendar and provides beautiful visualizations of your time usage. Track productivity, analyze patterns, and gain insights into how you spend your time.

### ✨ Features

- **📅 Multiple Time Ranges**: View data by day, week, month, quarter, or year
- **📊 Multiple Visualizations**:
  - Distribution charts showing time allocation
  - Timeline view of daily events
  - Advanced analytics with trend analysis
- **🎨 Category-Based Analysis**: Automatically categorizes events (Production, Non-Production, Admin & Rest, Other)
- **🔐 Secure OAuth 2.0**: Direct Google Calendar API integration with proper access tokens
- **⚡ Real-time Updates**: Instant data refresh and navigation
- **📱 Responsive Design**: Works on desktop and mobile devices

## 🚀 Quick Start

### Prerequisites

- Node.js 14+ or Python 3.6+
- Google Cloud Console project with Calendar API enabled
- Modern web browser

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable **Google Calendar API**
4. Create **OAuth 2.0 Client ID** (Web application)
5. Add authorized JavaScript origins:
   ```
   http://localhost:8000
   http://127.0.0.1:8000
   ```
6. Add authorized redirect URIs:
   ```
   http://localhost:8000
   http://localhost:8000/auth/callback
   ```

### 2. Configuration

1. Copy `config.example.js` to `config.js`:
   ```bash
   cp config.example.js config.js
   ```

2. Update `config.js` with your Google Client ID:
   ```javascript
   const CONFIG = {
       GOOGLE_CLIENT_ID: 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com',
       API_BASE_URL: 'http://localhost:8787', // match backend server
       // ... other settings
   };
   ```

### 3. Secure Auth Server

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Fill in:
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from Google Cloud Console
   - `FRONTEND_ORIGIN` (defaults to `http://localhost:8000`)
   - `SESSION_SECRET` (generate a long random string)
3. Start the backend service:
   ```bash
   npm run start:backend
   ```
   The service listens on port `8787` by default and must be reachable from the browser.

### 4. Run Locally

Using the provided script (recommended):
```bash
./start-frontend.sh
```

Or manually with Python:
```bash
python3 -m http.server 8000
```

Or with Node.js:
```bash
npx http-server -p 8000
```

Then open: http://localhost:8000

## 🏗️ Architecture

### Secure SPA + Auth Service

Diary Analyzer now ships as a static SPA **plus** a lightweight Node/Express auth service that:
- Uses Google Identity Services Authorization Code Flow with refresh tokens
- Stores refresh tokens server-side and issues short-lived access tokens to the browser via HTTP-only cookies
- Allows the frontend to call the Google Calendar API directly with tokens that can be refreshed silently

### Key Components

```
DairyAnalyzer/
├── index.html          # Main HTML entry point + OAuth glue
├── app.js              # Core application logic
├── styles.css          # Styling and layout
├── config.js           # Frontend configuration (create from config.example.js)
├── backend/server.js   # Secure auth + token exchange service
├── .env.example        # Backend environment template
├── chart.js            # Chart.js library for visualizations
└── start-frontend.sh   # Quick start script
```

### Data Flow

1. **Authentication**: Browser requests an authorization code (GIS Code Client)
2. **Secure Exchange**: Backend exchanges the code for access + refresh tokens and stores the refresh token
3. **Session Tokens**: Backend issues short-lived access tokens via HTTP-only cookie-backed sessions
4. **Data Fetching**: Frontend fetches Google Calendar data directly with the issued access token
5. **Processing & Visualization**: Client-side aggregation + Chart.js visualizations

## 🔒 Security

### What's Secure ✅

- **OAuth 2.0 Code Flow + PKCE**: Authorization codes exchanged on the backend only
- **Refresh Tokens**: Stored server-side inside the auth service, never exposed to the browser
- **Access Tokens**: Short-lived tokens scoped to Calendar access and delivered via HTTP-only cookies
- **Client-Side Analytics**: All calendar processing/visualization still happens in your browser

### Important Security Notes ⚠️

1. **Client ID is Public**: The Google Client ID in `config.js` is meant to be public - it's not a secret
2. **Backend Secrets**: Keep `GOOGLE_CLIENT_SECRET` and `SESSION_SECRET` in `.env` (never commit them)
3. **Scope Control**: App requests read + write scopes only when you use features (events/highlights) that need them
4. **Token Expiration**: Access tokens expire after ~1 hour and are refreshed silently by the backend

### For Production Deployment

When deploying to production:

1. **Add Production URLs** to Google Cloud Console:
   - Authorized JavaScript origins: `https://yourdomain.com`
   - Authorized redirect URIs: `https://yourdomain.com`, `https://yourdomain.com/auth/callback`

2. **Deploy the Secure Auth Service**:
   - Host `backend/server.js` on your preferred platform (Render, Fly.io, Vercel serverless, etc.)
   - Set `FRONTEND_ORIGIN` to your production domain
   - Update `CONFIG.API_BASE_URL` to the deployed backend URL

3. **Use Environment Variables** (recommended):
   ```javascript
   const CONFIG = {
       GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'fallback-client-id'
   };
   ```

4. **Enable HTTPS**: Always use HTTPS in production

## 📱 Deployment

### Deploy to Vercel (Recommended)

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Deploy:
   ```bash
   vercel
   ```

3. Configure:
   - Add your domain to Google Cloud Console
   - Update `config.js` or use environment variables

### Deploy to Netlify

1. Drag and drop your project folder to [Netlify Drop](https://app.netlify.com/drop)
2. Or use Netlify CLI:
   ```bash
   npm i -g netlify-cli
   netlify deploy
   ```

### Deploy to GitHub Pages

1. Push to GitHub repository
2. Enable GitHub Pages in repository settings
3. Select branch and root directory
4. Add GitHub Pages URL to Google Cloud Console

## 🎨 Customization

### Calendar Categories

Edit the categorization logic in `app.js`:

```javascript
function getCalendarKey(calendarName) {
    if (!calendarName) return 'other';
    
    const name = calendarName.toLowerCase();
    if (name.includes('prod') && !name.includes('nonprod')) return 'prod';
    if (name.includes('nonprod')) return 'nonprod';
    if (name.includes('admin') || name.includes('rest')) return 'admin';
    return 'other';
}
```

### Colors and Styling

Modify `styles.css` to change:
- Color scheme
- Layout and spacing
- Fonts and typography
- Responsive breakpoints

### Chart Configuration

Customize Chart.js options in `app.js`:
- Chart types
- Animation settings
- Tooltips and legends
- Data aggregation

## 🐛 Troubleshooting

### "401 Unauthorized" Error

**Cause**: OAuth origin mismatch or invalid token

**Solution**:
1. Check Google Cloud Console has correct origins/redirect URIs
2. Clear your secure session cookies (Sign out, then reload the page)

### Button Not Appearing

**Cause**: Google Sign-In library not loaded

**Solution**:
1. Check browser console for errors
2. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
3. Check network tab for failed requests

### Controls Not Working

**Cause**: Browser cache loading old JavaScript

**Solution**:
1. Hard refresh: `Ctrl+Shift+R`
2. Clear cache in DevTools
3. Or use Incognito mode

### No Calendar Data

**Cause**: No events in selected time range

**Solution**:
1. Try different time range (e.g., "This Month")
2. Check your Google Calendar has events
3. Verify calendar name matches categorization logic

## 📊 Technical Stack

- **Frontend**: Vanilla JavaScript (ES6+)
- **Charts**: Chart.js 4.x
- **Authentication**: Google Identity Services
- **API**: Google Calendar API v3
- **Styling**: Pure CSS3 with Flexbox/Grid
- **Server**: Static file server (any)

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Google Calendar API for data access
- Chart.js for beautiful visualizations
- Google Identity Services for OAuth 2.0

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check the troubleshooting section above
- Review Google Calendar API documentation

---

**Made with ❤️ for productivity enthusiasts**

Version 2.0.0 - October 2025