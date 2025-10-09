# 👋 Welcome to Diary Analyzer!

## 🎯 Quick Navigation

### 🚀 **Just Want to Get Started?**
→ **Run:** `./start-frontend.sh`  
→ **Open:** http://localhost:8000

---

### 📚 **Choose Your Path:**

#### 1. **First Time Setup** (15 minutes)
- [ ] Read: `QUICK-START.md` ⭐ **Start Here!**
- [ ] Add Google Client Secret to Supabase
- [ ] Update Google OAuth redirect URIs
- [ ] Test authentication

#### 2. **Migrate Existing Code** (30 minutes)
- [ ] Read: `MIGRATION-GUIDE.md`
- [ ] Move files to new structure
- [ ] Update app.js to use new APIs
- [ ] Test calendar functionality

#### 3. **Run the App** (2 minutes)
- [ ] Run: `./start-frontend.sh`
- [ ] Open: http://localhost:8000
- [ ] Sign in with Google
- [ ] View your calendar data!

#### 4. **Deploy to Production** (20 minutes)
- [ ] Read: `docs/SETUP-SUPABASE.md` (Deployment section)
- [ ] Deploy frontend to Vercel/Netlify
- [ ] Update production OAuth URIs
- [ ] Test live app

---

## 📁 **Important Files**

| File | Description | When to Read |
|------|-------------|--------------|
| **`QUICK-START.md`** ⭐ | **Start here!** Quick setup guide | First time |
| **`SCRIPTS-README.md`** | How to start servers | Every time you develop |
| **`SERVER-STATUS.md`** ✅ | **Scripts tested & working!** | Verify setup |
| `SUPABASE-SETUP-STATUS.md` | What's been configured | After setup |
| `MIGRATION-GUIDE.md` | How to migrate old code | During migration |
| `ARCHITECTURE.md` | How the system works | Understanding architecture |
| `docs/SETUP-SUPABASE.md` | Complete Supabase guide | Troubleshooting |

---

## 🚀 **Quick Commands**

### Start Development ✅ WORKING
```bash
./start-frontend.sh
```
**Status:** ✅ Tested and fully functional!

### Stop Servers
Press `Ctrl+C`

### View Logs
```bash
tail -f frontend.log
```

### Deploy Backend Changes
```bash
cd backend
supabase functions deploy function-name
```

### Verify Server is Running
```bash
lsof -i:8000
# Or open: http://localhost:8000
```

---

## ✅ **Current Setup Status**

### ✅ Completed
- [x] Supabase project created
- [x] Database schema deployed
- [x] Edge Functions deployed
- [x] Frontend configuration created
- [x] API client layer created
- [x] Start scripts created ✅ **TESTED & WORKING!**
- [x] Port cleanup automation
- [x] Intelligent directory detection

### ⚠️ **You Need To Do This:**
- [ ] **Add `GOOGLE_CLIENT_SECRET` to Supabase** (Required!)
  - Go: https://supabase.com/dashboard/project/kiddsrordcksmqbxyerv/settings/vault
  
- [ ] **Update Google OAuth redirect URIs** (Required!)
  - Add: `https://kiddsrordcksmqbxyerv.supabase.co/functions/v1/auth-google/callback`
  
- [ ] **Migrate existing code** (Optional if starting fresh)
  - Follow: `MIGRATION-GUIDE.md`

---

## 🔗 **Your Project URLs**

### Development
- Frontend: http://localhost:8000
- Supabase Dashboard: https://supabase.com/dashboard/project/kiddsrordcksmqbxyerv

### Production (After Deployment)
- Frontend: (You'll deploy to Vercel/Netlify)
- Backend API: https://kiddsrordcksmqbxyerv.supabase.co/functions/v1/
- Database: Managed by Supabase

---

## 🏗️ **Project Structure**

```
DairyAnalyzer/
├── 📱 frontend/              # Your web app
│   ├── public/              # HTML, CSS, assets
│   ├── src/                 # JavaScript code
│   │   ├── api/            # API client (Supabase)
│   │   └── app.js          # Main app logic
│   └── config.js           # Configuration ✅
│
├── 🔧 backend/              # Supabase backend
│   └── supabase/
│       ├── functions/       # Edge Functions ✅
│       └── migrations/      # Database schema ✅
│
├── 📚 docs/                 # Documentation
│   └── SETUP-SUPABASE.md   # Complete guide
│
├── 🚀 Scripts               # Convenience scripts
│   ├── start-frontend.sh   # Start frontend ⭐
│   └── clean-start.sh      # Start everything
│
└── 📖 Documentation
    ├── START-HERE.md        # This file! ⭐
    ├── QUICK-START.md       # Quick setup guide ⭐
    ├── MIGRATION-GUIDE.md   # Migration instructions
    └── ARCHITECTURE.md      # System architecture
```

---

## 💡 **Pro Tips**

1. **Always use `./start-frontend.sh`** - It handles port cleanup automatically!

2. **Backend is on Supabase** - No need to run it locally unless testing Edge Functions.

3. **Read `QUICK-START.md` first** - It has all the critical setup steps.

4. **Check `SCRIPTS-README.md`** - Learn about all available scripts.

5. **Bookmark Supabase Dashboard** - You'll use it for logs and debugging.

---

## 🐛 **Something Not Working?**

### Common Issues

**1. "Address already in use"**
→ Run: `./start-frontend.sh` (it auto-kills the port)

**2. "Google sign-in not working"**
→ Check: Did you add `GOOGLE_CLIENT_SECRET` to Supabase?

**3. "Failed to fetch calendar events"**
→ Check: Did you update Google OAuth redirect URIs?

**4. "Module not found"**
→ Check: Are you using `./start-frontend.sh` or `python3 -m http.server`?

**5. "Frontend directory not found"**
→ Check: Are you running the script from project root?

---

## 🆘 **Need Help?**

1. Check relevant documentation (see table above)
2. View logs: `tail -f frontend.log`
3. Check Supabase Dashboard for backend errors
4. Read troubleshooting section in `docs/SETUP-SUPABASE.md`

---

## 🎯 **Next Steps**

### Right Now:
1. **Read `QUICK-START.md`** ← Do this first!
2. **Add Google Client Secret** to Supabase
3. **Run `./start-frontend.sh`**
4. **Test the app!**

### Later:
1. Migrate existing code (if you have any)
2. Customize the frontend
3. Deploy to production
4. Add more features!

---

## 🎉 **You're Ready!**

Everything is set up and ready to go. Just complete the 2 critical steps in `QUICK-START.md` and you'll be coding!

**Happy coding! 🚀**

---

**Last Updated:** October 5, 2025  
**Supabase Project:** kiddsrordcksmqbxyerv  
**Frontend Port:** 8000
