"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { User } from "lucide-react";

// Define user type
export interface GoogleUser {
  id: string;
  name: string;
  email: string;
  picture: string;
  accessToken: string;
}

interface GoogleAuthButtonProps {
  onSuccess?: (user: GoogleUser) => void;
  onFailure?: (error: Error) => void;
  buttonText?: string;
  className?: string;
}

export function GoogleAuthButton({
  onSuccess,
  onFailure,
  buttonText = "Sign in with Google",
  className = "",
}: GoogleAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Initialize Google Identity Services
  useEffect(() => {
    const initializeGoogleAuth = async () => {
      try {
        if (document.getElementById("google-identity-script")) {
          if (window.google?.accounts) {
            setIsLoading(false);
          }
          return;
        }

        const script = document.createElement("script");
        script.id = "google-identity-script";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        
        script.onload = () => {
          // Need to check if the google object is available
          if (window.google?.accounts) {
            setIsLoading(false);
          } else {
            // Wait a bit and check again
            setTimeout(() => {
              if (window.google?.accounts) {
                setIsLoading(false);
              } else {
                console.error("Google Identity Services not available after loading script");
                if (onFailure) {
                  onFailure(new Error("Google Identity Services not available"));
                }
              }
            }, 1000);
          }
        };

        script.onerror = (error) => {
          console.error("Error loading Google Identity script:", error);
          setIsLoading(false);
          if (onFailure) {
            onFailure(new Error("Failed to load Google authentication script"));
          }
        };

        document.body.appendChild(script);
      } catch (error) {
        console.error("Error setting up Google authentication:", error);
        setIsLoading(false);
        if (onFailure) {
          onFailure(error instanceof Error ? error : new Error("Unknown error occurred"));
        }
      }
    };

    initializeGoogleAuth();
  }, [onFailure]);

  // Handle sign in
  const handleSignIn = useCallback(() => {
    if (!window.google?.accounts) {
      toast({
        title: "Authentication Error",
        description: "Google authentication is not available. Please try again later.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      if (!clientId) {
        throw new Error("Google Client ID is not configured");
      }

      // Configure OAuth2 client
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive.file",
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            console.error("OAuth error:", tokenResponse);
            if (onFailure) {
              onFailure(new Error(tokenResponse.error));
            }
            return;
          }

          try {
            // Get user information using the access token
            const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
              headers: {
                Authorization: `Bearer ${tokenResponse.access_token}`
              }
            });
            
            if (!userResponse.ok) {
              throw new Error(`Failed to get user info: ${userResponse.statusText}`);
            }
            
            const userData = await userResponse.json();
            
            // Create user object
            const user: GoogleUser = {
              id: userData.id,
              name: userData.name,
              email: userData.email,
              picture: userData.picture,
              accessToken: tokenResponse.access_token,
            };
            
            // Store in localStorage
            localStorage.setItem("googleUser", JSON.stringify(user));
            
            // Call onSuccess callback
            if (onSuccess) {
              onSuccess(user);
            }
          } catch (error) {
            console.error("Error getting user data:", error);
            if (onFailure) {
              onFailure(error instanceof Error ? error : new Error("Unknown error occurred"));
            }
          }
        }
      });

      // Request access token
      tokenClient.requestAccessToken();
    } catch (error) {
      console.error("Sign in error:", error);
      toast({
        title: "Authentication Error",
        description: error instanceof Error ? error.message : "Failed to sign in with Google",
        variant: "destructive",
      });
      if (onFailure) {
        onFailure(error instanceof Error ? error : new Error("Unknown error occurred"));
      }
    }
  }, [onSuccess, onFailure, toast]);

  return (
    <Button 
      onClick={handleSignIn} 
      disabled={isLoading} 
      className={className} 
      variant="outline"
    >
      <User className="mr-2 h-4 w-4" />
      {isLoading ? "Loading..." : buttonText}
    </Button>
  );
}

// Add TypeScript global declarations
declare global {
  interface Window {
    google?: {
      accounts: {
        id: any;
        oauth2: {
          initTokenClient: Function;
        };
      }
    }
  }
}
