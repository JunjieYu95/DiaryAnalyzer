# Detailed Setup Guide for Dairy Analyzer Chrome Extension

## Prerequisites

- Google account with access to Google Calendar
- Chrome browser
- Google Cloud Platform account (free tier is sufficient)

## Step-by-Step Setup

### 1. Google Cloud Console Setup

1. **Create a new project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Click "Select a project" → "New Project"
   - Name your project (e.g., "Dairy Analyzer")
   - Click "Create"

2. **Enable Google Calendar API:**
   - In the left sidebar, go to "APIs & Services" → "Library"
   - Search for "Google Calendar API"
   - Click on "Google Calendar API" from the results
   - Click "Enable"

3. **Create OAuth 2.0 Credentials:**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - If prompted, configure the OAuth consent screen:
     - Choose "External" (unless you have a Google Workspace account)
     - Fill in the required fields:
       - App name: "Dairy Analyzer"
       - User support email: your email
       - Developer contact information: your email
     - Click "Save and Continue"
     - Skip scopes (click "Save and Continue")
     - Add test users if needed (your own email)
     - Click "Save and Continue"
   - Now create the OAuth client ID:
     - Application type: "Web application"
     - Name: "Dairy Analyzer Extension"
     - Authorized JavaScript origins: `chrome-extension://[EXTENSION_ID]`
     - Authorized redirect URIs: `https://[EXTENSION_ID].chromiumapp.org/`
   - Click "Create"
   - **Important:** Save the Client ID - you'll need it for the next step

### 2. Extension Configuration

1. **Get your extension ID:**
   - Load the extension as unpacked in Chrome
   - Go to `chrome://extensions/`
   - Find "Dairy Analyzer" and copy the extension ID

2. **Update Google Cloud Console:**
   - Go back to your OAuth credentials
   - Click the edit button (pencil icon)
   - Update the authorized origins and redirect URIs with your actual extension ID:
     - `chrome-extension://[YOUR_ACTUAL_EXTENSION_ID]`
     - `https://[YOUR_ACTUAL_EXTENSION_ID].chromiumapp.org/`

3. **Update manifest.json:**
   - Open `manifest.json` in your extension folder
   - Replace `YOUR_CLIENT_ID_HERE` with your actual Client ID from Google Cloud Console

### 3. Install and Test

1. **Load the extension:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select your DairyAnalyzer folder

2. **Test the extension:**
   - Click the extension icon in Chrome toolbar
   - Click "Connect Calendar"
   - You should see a Google OAuth popup
   - Grant permissions to read your calendar
   - Your calendar events should appear in the timeline

## Common Issues and Solutions

### "Authorization Error" or "Access Denied"

**Problem:** OAuth configuration is incorrect

**Solution:**
1. Double-check your extension ID in Google Cloud Console
2. Ensure the OAuth client ID in manifest.json matches exactly
3. Make sure you've added the correct redirect URIs

### "Calendar API not enabled"

**Problem:** Google Calendar API is not enabled for your project

**Solution:**
1. Go to Google Cloud Console
2. Navigate to "APIs & Services" → "Library"
3. Search for "Google Calendar API" and enable it

### "No events showing"

**Problem:** No calendar events or wrong calendar selected

**Solution:**
1. Check that you have events in your primary Google Calendar
2. Ensure you're viewing the correct date range
3. Try the refresh button in the extension

### Extension won't load

**Problem:** Manifest or file issues

**Solution:**
1. Check that all files are in the correct locations
2. Verify manifest.json syntax is valid
3. Look for errors in Chrome extension console

## Development Tips

### Testing with Different Calendars

The extension currently uses the primary calendar. To test with other calendars:
1. Modify the API call in `popup.js`
2. Change `calendars/primary/events` to `calendars/[CALENDAR_ID]/events`

### Adding More Event Categories

To add new event categories:
1. Update the `categorizeEvent()` function in `popup.js`
2. Add corresponding CSS classes in `popup.css`
3. The format is `.category-[name]` with background and color properties

### Debugging

1. Right-click the extension icon → "Inspect popup"
2. Check the console for error messages
3. Use `console.log()` to debug API responses
4. Check network tab for failed API calls

## Security Notes

- Never commit your Client ID to public repositories
- The extension only requests read-only calendar access
- Tokens are stored locally in Chrome's storage
- No data is sent to external servers

## Next Steps

After basic setup, you can:
1. Customize the categorization logic for your specific activities
2. Add more statistics and insights
3. Improve the UI with additional features
4. Add export functionality for your data

## Support

If you encounter issues:
1. Check the Chrome extension console for errors
2. Verify your Google Cloud Console configuration
3. Ensure all files are present and properly formatted
4. Try removing and re-adding the extension 