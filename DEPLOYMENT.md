# 🚀 Deployment Guide

## Prerequisites

Before deploying, make sure you have:
- ✅ Google Cloud Console project set up
- ✅ OAuth 2.0 Client ID created
- ✅ Google Calendar API enabled
- ✅ `config.js` created from `config.example.js`

## Deploy to Vercel (Recommended)

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Deploy

```bash
vercel
```

Follow the prompts:
- Set up and deploy: `Y`
- Scope: Select your account
- Link to existing project: `N` (first time)
- Project name: `diary-analyzer` (or your choice)
- Directory: `./` (current directory)
- Override settings: `N`

### 3. Configure Environment (Optional)

If you want to use environment variables instead of `config.js`:

```bash
vercel env add GOOGLE_CLIENT_ID
```

Then update `config.js` to:
```javascript
const CONFIG = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID'
};
```

### 4. Update Google Cloud Console

After deployment, add your Vercel URL to Google Cloud Console:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID
3. Add to **Authorized JavaScript origins**:
   ```
   https://your-app.vercel.app
   ```
4. Add to **Authorized redirect URIs**:
   ```
   https://your-app.vercel.app
   https://your-app.vercel.app/auth/callback
   ```
5. Click **Save**

### 5. Test

Visit your Vercel URL and test:
- Sign in with Google ✅
- View calendar data ✅
- Change time periods ✅
- Navigate dates ✅

## Deploy to Netlify

### 1. Via Netlify Drop (Easiest)

1. Go to: https://app.netlify.com/drop
2. Drag and drop your project folder
3. Wait for deployment to complete
4. Update Google Cloud Console with Netlify URL

### 2. Via Netlify CLI

```bash
npm i -g netlify-cli
netlify login
netlify deploy
```

Follow prompts:
- Create new site: `Y`
- Team: Select your team
- Site name: `diary-analyzer`
- Publish directory: `.` (current directory)

Then:
```bash
netlify deploy --prod
```

### 3. Update Google Cloud Console

Add your Netlify URL (same as Vercel instructions above).

## Deploy to GitHub Pages

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/diary-analyzer.git
git push -u origin main
```

### 2. Enable GitHub Pages

1. Go to repository settings
2. Pages section
3. Source: Deploy from branch
4. Branch: `main`, folder: `/ (root)`
5. Save

### 3. Update Google Cloud Console

Add your GitHub Pages URL:
```
https://yourusername.github.io/diary-analyzer
```

## Deploy to Custom Server

### 1. Build (if needed)

No build step needed - this is a static site!

### 2. Upload Files

Upload these files to your web server:
- `index.html`
- `app.js`
- `styles.css`
- `config.js`
- `chart.js`
- Any other assets

### 3. Configure Web Server

**Apache (.htaccess):**
```apache
# Enable HTTPS redirect
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Security headers
Header set X-Content-Type-Options "nosniff"
Header set X-Frame-Options "DENY"
Header set X-XSS-Protection "1; mode=block"
```

**Nginx:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    # HTTPS redirect
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;
    
    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Security headers
    add_header X-Content-Type-Options "nosniff";
    add_header X-Frame-Options "DENY";
    add_header X-XSS-Protection "1; mode=block";
    
    root /var/www/diary-analyzer;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
}
```

## Security Checklist

Before going to production:

- [ ] **HTTPS enabled** (required for OAuth)
- [ ] **config.js not in git** (check `.gitignore`)
- [ ] **Google Cloud Console updated** with production URLs
- [ ] **Security headers configured** (see examples above)
- [ ] **Test OAuth flow** on production URL
- [ ] **Test all features** (time periods, views, navigation)
- [ ] **Check browser console** for errors

## Environment Variables (Optional)

For better security, use environment variables:

### Vercel
```bash
vercel env add GOOGLE_CLIENT_ID production
```

### Netlify
```bash
netlify env:set GOOGLE_CLIENT_ID your-client-id
```

### GitHub Pages
Use GitHub Secrets and build step (requires build process).

## Troubleshooting

### "OAuth Error: redirect_uri_mismatch"

**Problem**: Production URL not added to Google Cloud Console

**Solution**: 
1. Check exact URL in error message
2. Add to Google Cloud Console → Authorized redirect URIs
3. Wait 5 minutes for changes to propagate

### "Configuration error"

**Problem**: `config.js` not deployed or CLIENT_ID missing

**Solution**:
- Make sure `config.js` is uploaded to server
- Check `config.js` has correct CLIENT_ID
- For Vercel/Netlify: use environment variables

### HTTPS Issues

**Problem**: OAuth requires HTTPS in production

**Solution**:
- Vercel/Netlify automatically provide HTTPS ✅
- Custom server: Get SSL certificate (Let's Encrypt)
- Never use `http://` in production

## Performance Optimization

### 1. Enable Compression

**Vercel/Netlify**: Automatic ✅

**Custom server**: Enable gzip in Nginx/Apache

### 2. Cache Static Assets

Add cache headers for `.js`, `.css`, `.svg` files.

### 3. Use CDN

Vercel and Netlify include global CDN automatically.

## Monitoring

### Check Deployment Status

**Vercel**:
```bash
vercel ls
```

**Netlify**:
```bash
netlify status
```

### View Logs

**Vercel**:
```bash
vercel logs
```

**Netlify**:
Check Netlify dashboard → Functions → Logs

## Rollback

### Vercel
```bash
vercel rollback
```

### Netlify
Netlify dashboard → Deploys → Select previous → Publish

## Support

For deployment issues:
- Vercel: https://vercel.com/support
- Netlify: https://www.netlify.com/support/
- GitHub Pages: https://docs.github.com/pages

---

**Happy deploying! 🚀**
