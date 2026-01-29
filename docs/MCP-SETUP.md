# DiaryAnalyzer MCP Setup Guide

This guide explains how to set up the DiaryAnalyzer MCP endpoint for seamless Google Calendar integration with Yukie.

## Overview

The MCP endpoint allows Yukie to log activities directly to your Google Calendar without requiring you to authenticate each time. This is achieved by storing a **refresh token** that automatically obtains new access tokens when needed.

## One-Time Setup

### Step 1: Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose **"Desktop app"** as the application type
   - Give it a name (e.g., "Diary Analyzer MCP")
   - Click "Create"
5. Note down your **Client ID** and **Client Secret**

### Step 2: Get Refresh Token

Run the setup script to obtain your refresh token:

```bash
cd /Users/junjieyu/Projects/DiaryAnalyzer
npm run setup:auth
```

Or directly:

```bash
node scripts/get-refresh-token.js
```

The script will:
1. Ask for your Client ID and Client Secret (if not in environment)
2. Open a browser for Google authorization
3. Output the refresh token to store

### Step 3: Configure Environment Variables

Add these to your Vercel project:

```bash
# Via Vercel CLI
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET
vercel env add GOOGLE_REFRESH_TOKEN

# Or via Vercel Dashboard
# Go to: Project Settings > Environment Variables
```

Required variables:
- `GOOGLE_CLIENT_ID` - Your OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Your OAuth client secret
- `GOOGLE_REFRESH_TOKEN` - The refresh token from Step 2

### Step 4: Deploy

```bash
vercel --prod
```

## MCP Endpoint

The MCP endpoint is available at:
```
https://your-project.vercel.app/api/mcp
```

## Available Tools

### diary.log
Log an activity to Google Calendar.

```json
{
  "title": "Working on project",
  "description": "Implementing new feature",
  "calendar": "Actual Diary",
  "startTime": "now",
  "duration": 60
}
```

### diary.logHighlight
Log a highlight or milestone (all-day event).

```json
{
  "title": "Launched new version",
  "type": "milestone",
  "date": "2024-01-15",
  "calendar": "Highlights"
}
```

### diary.listCalendars
List available calendars.

### diary.queryEvents
Query events for a date or date range.

```json
{
  "date": "2024-01-15"
}
```

## Yukie Configuration

Add this MCP to your Yukie configuration:

```json
{
  "mcps": [
    {
      "name": "diary-analyzer",
      "url": "https://diary-analyzer.vercel.app/api/mcp",
      "scopes": ["diary:read", "diary:write"]
    }
  ]
}
```

## Security Notes

- **Never commit your refresh token to git**
- The refresh token grants long-term access to your Google Calendar
- If compromised, revoke it at https://myaccount.google.com/permissions
- Consider using a dedicated Google account if security is a concern

## Troubleshooting

### "Missing Google OAuth credentials" error
Ensure all three environment variables are set in Vercel.

### "Failed to refresh access token" error
Your refresh token may have expired or been revoked. Run `npm run setup:auth` again.

### Events not appearing in expected calendar
Check that the calendar name matches exactly. Use `diary.listCalendars` to see available calendars.
