#!/usr/bin/env node
/**
 * One-Time Setup Script for Google OAuth Refresh Token
 * 
 * This script helps you obtain a refresh token for the Diary Analyzer MCP.
 * Run this once, then store the refresh token in your environment variables.
 * 
 * Prerequisites:
 * 1. Go to Google Cloud Console: https://console.cloud.google.com/
 * 2. Create or select a project
 * 3. Enable the Google Calendar API
 * 4. Create OAuth 2.0 credentials (Desktop app type)
 * 5. Download the credentials JSON or note the Client ID and Client Secret
 * 
 * Usage:
 *   node scripts/get-refresh-token.js
 * 
 * You will need to provide:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * 
 * The script will open a browser for authorization and output the refresh token.
 */

import http from 'http';
import { URL } from 'url';
import { exec } from 'child_process';
import readline from 'readline';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

const REDIRECT_PORT = 3847;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' 
    ? `open "${url}"`
    : process.platform === 'win32'
    ? `start "${url}"`
    : `xdg-open "${url}"`;
  
  exec(cmd, (err) => {
    if (err) {
      console.log('\n⚠️  Could not open browser automatically.');
      console.log('Please open this URL manually:\n');
      console.log(url);
    }
  });
}

async function waitForAuthCode() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      
      if (url.pathname === '/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        
        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 2rem; text-align: center;">
                <h1>❌ Authorization Failed</h1>
                <p>Error: ${error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
          server.close();
          reject(new Error(error));
          return;
        }
        
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; padding: 2rem; text-align: center;">
                <h1>✅ Authorization Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);
          server.close();
          resolve(code);
          return;
        }
      }
      
      res.writeHead(404);
      res.end('Not found');
    });
    
    server.listen(REDIRECT_PORT, () => {
      console.log(`\n🔄 Waiting for authorization on port ${REDIRECT_PORT}...`);
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authorization timeout'));
    }, 5 * 60 * 1000);
  });
}

async function exchangeCodeForTokens(code, clientId, clientSecret) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
  }
  
  return response.json();
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     Google OAuth Refresh Token Setup for Diary Analyzer      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log();
  
  // Check for existing environment variables
  let clientId = process.env.GOOGLE_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!clientId) {
    console.log('📝 Enter your Google OAuth credentials:');
    console.log('   (Get these from Google Cloud Console > APIs & Services > Credentials)\n');
    clientId = await prompt('GOOGLE_CLIENT_ID: ');
  } else {
    console.log(`✅ Using GOOGLE_CLIENT_ID from environment: ${clientId.substring(0, 20)}...`);
  }
  
  if (!clientSecret) {
    clientSecret = await prompt('GOOGLE_CLIENT_SECRET: ');
  } else {
    console.log('✅ Using GOOGLE_CLIENT_SECRET from environment');
  }
  
  if (!clientId || !clientSecret) {
    console.error('\n❌ Error: Both Client ID and Client Secret are required.');
    process.exit(1);
  }
  
  // Build authorization URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent'); // Force consent to get refresh token
  
  console.log('\n🌐 Opening browser for Google authorization...');
  console.log('   Please sign in and grant calendar access.\n');
  
  openBrowser(authUrl.toString());
  
  try {
    const code = await waitForAuthCode();
    console.log('\n✅ Authorization code received!');
    console.log('🔄 Exchanging code for tokens...\n');
    
    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret);
    
    if (!tokens.refresh_token) {
      console.error('❌ No refresh token received.');
      console.error('   This usually means you already authorized this app before.');
      console.error('   Go to https://myaccount.google.com/permissions and revoke access,');
      console.error('   then run this script again.\n');
      process.exit(1);
    }
    
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    ✅ SUCCESS!                               ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log();
    console.log('📋 Add these environment variables to your Vercel project:\n');
    console.log('┌─────────────────────────────────────────────────────────────┐');
    console.log(`│ GOOGLE_CLIENT_ID=${clientId}`);
    console.log(`│ GOOGLE_CLIENT_SECRET=${clientSecret}`);
    console.log(`│ GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('└─────────────────────────────────────────────────────────────┘');
    console.log();
    console.log('🔧 To set in Vercel:');
    console.log('   1. Go to your project on vercel.com');
    console.log('   2. Settings > Environment Variables');
    console.log('   3. Add each variable above');
    console.log();
    console.log('Or use the Vercel CLI:');
    console.log('   vercel env add GOOGLE_CLIENT_ID');
    console.log('   vercel env add GOOGLE_CLIENT_SECRET');
    console.log('   vercel env add GOOGLE_REFRESH_TOKEN');
    console.log();
    console.log('⚠️  Keep your refresh token secure! Never commit it to git.');
    console.log();
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
