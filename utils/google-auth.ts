/**
 * Reliable Google authentication helper with clear error messages
 */

// Define Google user type
export interface GoogleUser {
  id: string;
  name: string;
  email: string;
  avatar: string; // profile picture URL
}

// Storage keys
const USER_STORAGE_KEY = 'google_user';
const TOKEN_STORAGE_KEY = 'google_access_token';
const TOKEN_EXPIRY_KEY = 'google_token_expiry';

// Get client ID from environment variable
const getClientId = () => {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error('Google client ID is not configured');
    throw new Error('Google authentication is not configured properly');
  }
  return clientId;
};

/**
 * Load the Google Identity Services script
 */
export const loadGoogleApi = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Skip if already loaded
    if (typeof window !== 'undefined' && window.google?.accounts) {
      console.log('Google API already loaded');
      return resolve();
    }
    
    try {
      console.log('Loading Google Identity script...');
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.id = 'google-identity-script';
      
      script.onload = () => {
        console.log('Google Identity script loaded successfully');
        
        // Check if accounts is available
        if (window.google?.accounts) {
          resolve();
        } else {
          // Sometimes the API needs a moment to initialize
          setTimeout(() => {
            if (window.google?.accounts) {
              resolve();
            } else {
              reject(new Error('Google Identity Services not available after script load'));
            }
          }, 1000);
        }
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Google Identity Services script'));
      };
      
      document.body.appendChild(script);
    } catch (error) {
      console.error('Error loading Google script:', error);
      reject(error);
    }
  });
};

/**
 * Get the currently stored user
 */
export const getCurrentUser = (): GoogleUser | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const userData = localStorage.getItem(USER_STORAGE_KEY);
    if (!userData) return null;
    
    return JSON.parse(userData);
  } catch (error) {
    console.error('Error retrieving user data from storage:', error);
    return null;
  }
};

/**
 * Get access token with auto-refresh capability
 */
export const getAccessToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined') return null;
  
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const expiryStr = localStorage.getItem(TOKEN_EXPIRY_KEY);
    
    if (!token) return null;
    
    // Check if token is expired
    if (expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      
      // If token expires in less than 5 minutes, we should refresh it
      if (Date.now() > expiry - 5 * 60 * 1000) {
        console.log('Token expired or expiring soon, refreshing...');
        await refreshToken();
        return localStorage.getItem(TOKEN_STORAGE_KEY);
      }
    }
    
    return token;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
};

/**
 * Sign in with Google
 */
export const signIn = async (): Promise<GoogleUser> => {
  // Ensure the API is loaded
  await loadGoogleApi();
  
  return new Promise((resolve, reject) => {
    try {
      console.log('Initializing Google sign-in process...');
      const clientId = getClientId();
      
      if (!window.google?.accounts?.oauth2) {
        throw new Error('Google API not loaded properly');
      }
      
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file',
        prompt: 'consent',
        callback: async (response: any) => {
          if (response.error) {
            console.error('Google auth error:', response);
            return reject(new Error(`Authentication failed: ${response.error}`));
          }
          
          try {
            // Store the token and expiry
            const expiresIn = response.expires_in || 3600;
            const expiryTime = Date.now() + expiresIn * 1000;
            
            localStorage.setItem(TOKEN_STORAGE_KEY, response.access_token);
            localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
            
            // Fetch user info
            const userResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: {
                Authorization: `Bearer ${response.access_token}`
              }
            });
            
            if (!userResponse.ok) {
              const errorText = await userResponse.text();
              console.error('Failed to get user info:', errorText);
              throw new Error('Could not retrieve your Google profile');
            }
            
            const userData = await userResponse.json();
            
            // Create and store user object
            const user: GoogleUser = {
              id: userData.sub,
              name: userData.name,
              email: userData.email,
              avatar: userData.picture
            };
            
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
            resolve(user);
          } catch (error) {
            console.error('Error during sign in flow:', error);
            reject(error);
          }
        }
      });
      
      // Request token with all consents
      tokenClient.requestAccessToken({prompt: 'consent'});
    } catch (error) {
      console.error('Sign in error:', error);
      reject(error);
    }
  });
};

/**
 * Attempt to refresh the access token
 */
const refreshToken = async (): Promise<void> => {
  // This is a simplified version - in a real app you'd use refresh tokens
  // For this demo, we'll just clear the token and force a new sign-in
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
};

/**
 * Sign out
 */
export const signOut = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  
  try {
    // Clear all stored auth data
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    
    // If Google API is loaded, also revoke the token
    if (window.google?.accounts) {
      // Optional: revoke access
      const token = await getAccessToken();
      if (token) {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
      }
    }
  } catch (error) {
    console.error('Error during sign out:', error);
    // Proceed with sign out anyway by clearing storage
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  }
};

/**
 * Check if the token is valid by making a test API call
 */
export const validateToken = async (token: string): Promise<boolean> => {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/tokeninfo', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `access_token=${token}`
    });
    
    return response.ok;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
};
