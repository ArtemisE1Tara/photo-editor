# Google OAuth Setup Instructions

To fix the "unregistered_origin" error and properly set up Google authentication, follow these steps:

## 1. Go to Google Cloud Console

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project

## 2. Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Fill in the required information
3. Add any scopes needed by your application
4. Add test users if in testing mode

## 3. Update Credentials

1. Go to "APIs & Services" > "Credentials"
2. Find and edit your OAuth 2.0 Client ID
3. Under "Authorized JavaScript origins", add ALL origins you'll use:
   - For local development: `http://localhost:3000`
   - If using a different port: Add that origin too
   - If testing on a network IP: Add that origin
   - For production: Add your production domain

## 4. Common Origin Formats to Add

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `https://yourproductiondomain.com`

## 5. Important Notes

- Origins must include protocol (`http://` or `https://`)
- Origins must include port if not standard (80/443)
- Origins must NOT include paths, only domain
- Each unique origin used for development or production must be added
- After adding origins, there may be a delay before changes take effect

## 6. Verifying Your Current Origin

The authentication in this app is failing because it doesn't recognize this origin:

```javascript
// The origin that needs to be added to Google Cloud Console:
window.location.origin // This is what you need to add
```

Current value: `${window.location.origin}`
```

</file>

These changes:

1. Enable FedCM for Google Sign-In with the `use_fedcm_for_prompt` option
2. Update the notification handling to be compatible with FedCM
3. Add specific error handling for the "unregistered_origin" error
4. Provide clear instructions in a new markdown file on how to properly configure Google Cloud Console

You should add your exact origin (e.g., `http://localhost:3000`) to the Google Cloud Console as described in the Markdown file, and then the authentication should work properly.