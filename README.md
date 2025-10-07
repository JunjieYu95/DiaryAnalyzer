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
       // ... other settings
   };
   ```

### 3. Run Locally

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

### Frontend-Only Design

This is a **frontend-only** web application that uses:
- **Google OAuth 2.0 Token Client** for authentication
- **Direct Google Calendar API calls** via fetch
- **Client-side rendering** with vanilla JavaScript
- **No backend required** for basic functionality

### Key Components

```
DairyAnalyzer/
├── index.html          # Main HTML entry point
├── app.js              # Core application logic
├── styles.css          # Styling and layout
├── config.js           # Configuration (create from config.example.js)
├── chart.js            # Chart.js library for visualizations
└── start-frontend.sh   # Quick start script
```

### Data Flow

1. **Authentication**: OAuth 2.0 flow requests access token from Google
2. **Authorization**: Access token grants permission to read calendar data
3. **Data Fetching**: Direct API calls to Google Calendar v3 API
4. **Processing**: Client-side categorization and aggregation
5. **Visualization**: Chart.js renders interactive charts

## 🔒 Security

### What's Secure ✅

- **OAuth 2.0 Flow**: Industry-standard authentication
- **Access Tokens**: Properly scoped (calendar.readonly only)
- **No Backend**: No server-side storage of credentials
- **Client-Side Only**: All processing happens in your browser

### Important Security Notes ⚠️

1. **Client ID is Public**: The Google Client ID in `config.js` is meant to be public - it's not a secret
2. **Access Tokens in Browser**: Tokens are stored in `localStorage` - this is standard for SPAs
3. **Read-Only Access**: App only requests `calendar.readonly` scope
4. **Token Expiration**: Access tokens expire after 1 hour

### For Production Deployment

When deploying to production:

1. **Add Production URLs** to Google Cloud Console:
   - Authorized JavaScript origins: `https://yourdomain.com`
   - Authorized redirect URIs: `https://yourdomain.com`, `https://yourdomain.com/auth/callback`

2. **Use Environment Variables** (recommended):
   ```javascript
   const CONFIG = {
       GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'fallback-client-id'
   };
   ```

3. **Enable HTTPS**: Always use HTTPS in production

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
2. Clear `localStorage` and sign in again:
   ```javascript
   localStorage.clear();
   location.reload();
   ```

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