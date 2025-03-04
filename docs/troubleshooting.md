# PixelVault Troubleshooting Guide

## Google Authentication Issues

### Common Problems and Solutions

#### "Authentication failed" or Sign-in doesn't complete

1. **Check Browser Console**: Look for errors related to Google authentication
2. **Verify Client ID**: Ensure your Google Client ID in `.env.local` is correct
3. **Check Authorized Origins**: Make sure your domain (like `http://localhost:3000`) is added to the authorized JavaScript origins in the Google Cloud Console
4. **Try Incognito Mode**: Sometimes browser extensions can interfere with authentication
5. **Clear Local Storage**: Open Developer Tools → Application → Local Storage and clear the storage for your site

#### "Failed to upload to Google Drive"

1. **Check Authentication**: Make sure you're signed in successfully
2. **Verify Permissions**: The app needs drive.file scope permissions
3. **Check File Size**: Very large images might fail to upload
4. **Try a Different Image**: Some image formats might cause issues
5. **Network Issues**: Check your internet connection

## Setup Google Cloud Console Correctly

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select your project
3. Go to "APIs & Services" → "Credentials"
4. Create an OAuth 2.0 Client ID or edit your existing one
5. Make sure you add your development URL to "Authorized JavaScript origins":
   - For local development: `http://localhost:3000`
   - For production: Your actual domain
6. Under "Authorized redirect URIs" add:
   - `http://localhost:3000`
   - `http://localhost:3000/auth/callback`
7. Save changes and wait a few minutes for them to take effect

## Debugging Steps

If you're still having issues, try these steps:

1. **Enable Verbose Logging**:
   - Open browser console
   - Set localStorage.debug = 'pixelvault:*' in the console
   - Refresh the page

2. **Check Network Requests**:
   - Open Developer Tools → Network tab
   - Filter for "google" or "googleapis"
   - Look for 401 or 403 errors

3. **Verify Token**:
   - Get your token from localStorage
   - Test it using the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)

4. **Reset Everything**:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   ```
   Then refresh the page and try again.

## Getting Further Help

If you're still experiencing issues:

1. Create a bug report with:
   - Browser and version
   - Screenshots of the console errors
   - Steps to reproduce the problem
   - URL where the issue occurs

2. Check if there are any Google OAuth changes or deprecations announced that might affect the app.
