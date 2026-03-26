# FiscusFilms - Supabase Authentication Setup Guide

This guide explains how to properly configure Supabase for Facebook OAuth and Email authentication.

## Current Configuration
- **Supabase Project URL**: `https://eotvmsheeitniegagrby.supabase.co`
- **App Deployments**: 
  - GitHub Pages: `https://mrfiscus.github.io/Fiscusfilms/`
  - Local Development: `http://localhost:3000` (or your local URL)

---

## 1. Facebook OAuth Setup

### Step 1: Create a Facebook App
1. Go to [Meta Developers](https://developers.facebook.com/)
2. Log in with your Facebook account
3. Click "My Apps" → "Create App"
4. Choose "Consume" as the app type
5. Fill in the App Name (e.g., "FiscusFilms")
6. Complete the setup wizard

### Step 2: Enable Facebook Login Product
1. In your app dashboard, click "Add Product"
2. Find "Facebook Login" and click "Set Up"
3. Choose "Web" as your platform
4. Skip the quickstart and go to "Settings" → "Basic"

### Step 3: Configure Redirect URIs
In your Facebook App settings, add these URLs to **Valid OAuth Redirect URIs**:
```
https://eotvmsheeitniegagrby.supabase.co/auth/v1/callback?provider=facebook
https://mrfiscus.github.io/Fiscusfilms/
https://mrfiscus.github.io/Fiscusfilms/login.html
```

For local testing, also add:
```
http://localhost:5500/
http://localhost:5500/login.html
http://localhost:3000/
http://localhost:3000/login.html
```

### Step 4: Get Your Credentials
1. Go to "Settings" → "Basic" in your Facebook App
2. Copy your:
   - **App ID**
   - **App Secret** (keep this private!)

### Step 5: Configure in Supabase
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project: `eotvmsheeitniegagrby`
3. Navigate to **Authentication** → **Providers**
4. Find "Facebook" and enable it
5. Paste your **App ID** and **App Secret**
6. Click "Save"

---

## 2. Email Authentication & Verification

### ⚠️ Important: Email Configuration Required
Currently, **email verification is not working** because Supabase email sending is not configured. You have three options:

### Option A: Use Supabase Built-in Email (Recommended for Development)
1. Go to **Authentication** → **Providers** → **Email**
2. Enable "Email Links" for password recovery
3. Note: Built-in email is limited and for development only

### Option B: Configure Custom Email Provider (Production)
Supabase supports multiple email providers. Here's how:

#### Using SendGrid (Recommended)
1. Sign up at [SendGrid](https://sendgrid.com/)
2. Create an API key
3. In Supabase: **Settings** → **Email**
4. Click "Use custom SMTP"
5. Enter SendGrid SMTP Details:
   - **Host**: `smtp.sendgrid.net`
   - **Port**: `587`
   - **Username**: `apikey`
   - **Password**: Your SendGrid API Key
   - **From Email**: Your verified sender email

#### Using Mailgun
1. Sign up at [Mailgun](https://www.mailgun.com/)
2. Get your SMTP credentials from domain settings
3. In Supabase: **Settings** → **Email**
4. Click "Use custom SMTP"
5. Enter Mailgun details from your dashboard

#### Using Gmail (For Testing)
⚠️ Not recommended for production, but works for testing:
1. Set "Allow less secure apps" on your Google Account
2. Use your Gmail address and an [App Password](https://support.google.com/accounts/answer/185833)
3. SMTP Host: `smtp.gmail.com`, Port: `587`

### Step 3: Enable Email Verification
1. In Supabase: **Authentication** → **Providers** → **Email**
2. Enable "Email Confirmations"
3. Set "Redirect URL after email confirmation" to:
   ```
   https://mrfiscus.github.io/Fiscusfilms/login.html
   ```
4. Save changes

---

## 3. Redirect URL Configuration

### GitHub Pages Deployment
Add to **Authentication** → **URL Configuration**:
```
https://mrfiscus.github.io/Fiscusfilms/
https://mrfiscus.github.io/Fiscusfilms/login.html
https://mrfiscus.github.io/Fiscusfilms/profile.html
```

### Local Development
Add these temporary URLs (remove after testing):
```
http://localhost:5500/
http://localhost:5500/login.html
http://localhost:5500/profile.html
http://localhost:3000/
http://localhost:3000/login.html
http://localhost:3000/profile.html
```

---

## 4. Testing

### Testing Facebook Login
1. Go to login page
2. Click "Facebook" button
3. You'll be redirected to Facebook to authorize
4. After authorizing, you should automatically redirect to profile.html
5. If you don't see the redirect, check:
   - Browser console for errors
   - Supabase Redirect URLs include the current domain

### Testing Email Login
1. Go to login page
2. Create account with email/password
3. You should receive a verification email within 2-3 minutes
4. Click the link in the email
5. Return to login page and sign in
6. If you don't receive an email:
   - Check spam folder
   - Verify email provider is configured in Supabase
   - Check SMTP credentials are correct
   - Try resend verification button

---

## 5. Troubleshooting

### Facebook Login Not Working
- **Issue**: Redirect loops or "Invalid OAuth state"
  - **Fix**: Ensure redirect URLs match exactly in both Facebook App and Supabase
  
- **Issue**: "App not configured for this URL"
  - **Fix**: Add current domain to Facebook App's Valid OAuth Redirect URIs

### Email Not Received
- **Issue**: Verification emails not arriving
  - **Causes**: 
    - Email provider not configured in Supabase
    - Email caught in spam folder
    - Sending limit exceeded (free SendGrid tier)
  - **Fix**: Check Supabase email logs in **Settings**

### Redirect After OAuth
- **Issue**: Not redirected to profile after Facebook login
  - **Fix**: This is now handled by the callback script in login.html

---

## 6. Environment Variables (Optional)

If you want to use environment variables instead of hardcoding:

Create `.env` (never commit this!):
```
VITE_SUPABASE_URL=https://eotvmsheeitniegagrby.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

Then update `supabase-config.js`:
```javascript
window.SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || "https://eotvmsheeitniegagrby.supabase.co",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGc...",
  redirectTo: "https://mrfiscus.github.io/Fiscusfilms/"
};
```

---

## 7. Quick Checklist

- [ ] Facebook App created with App ID and Secret
- [ ] Facebook Valid OAuth Redirect URIs configured
- [ ] Supabase Facebook provider enabled with credentials
- [ ] Email provider configured (SendGrid, Mailgun, etc.)
- [ ] Supabase Email Confirmations enabled
- [ ] Redirect URLs configured in Supabase for all domains
- [ ] Tested Facebook login on GitHub Pages
- [ ] Tested Email signup and verification
- [ ] Tested Email login with existing account

---

**Need Help?**
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Authentication Guide](https://supabase.com/docs/guides/auth)
- [Facebook Login Setup](https://developers.facebook.com/docs/facebook-login)
