"use client"

import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { useToast } from "@/components/ui/use-toast";
import * as GoogleAuth from "@/utils/google-auth";

// Define context types
interface AuthContextType {
  user: GoogleAuth.GoogleUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

// Create context with undefined default
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleAuth.GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { toast } = useToast();

  // Initialize auth on component mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Try to load Google API first
        await GoogleAuth.loadGoogleApi();
        
        // Check for existing user
        const savedUser = GoogleAuth.getCurrentUser();
        
        if (savedUser) {
          // Validate the token
          const token = await GoogleAuth.getAccessToken();
          if (token && await GoogleAuth.validateToken(token)) {
            setUser(savedUser);
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        toast({
          title: "Authentication error",
          description: "Could not initialize Google authentication",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [toast]);

  // Sign in function
  const signIn = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const newUser = await GoogleAuth.signIn();
      setUser(newUser);
      toast({
        title: "Signed in",
        description: `Welcome, ${newUser.name}!`,
      });
    } catch (error) {
      console.error("Sign in error:", error);
      toast({
        title: "Sign in failed",
        description: error instanceof Error ? error.message : "Could not sign in with Google",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out function
  const signOut = async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await GoogleAuth.signOut();
      setUser(null);
      toast({
        title: "Signed out",
        description: "You have been signed out successfully",
      });
    } catch (error) {
      console.error("Sign out error:", error);
      // Still clear local user even if remote sign out fails
      setUser(null);
      toast({
        title: "Sign out issue",
        description: "Signed out locally, but there was an issue with Google",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Function to get token for API calls
  const getAccessToken = async () => {
    return GoogleAuth.getAccessToken();
  };

  // Create context value
  const contextValue: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signIn,
    signOut,
    getAccessToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use the auth context
export function useGoogleAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useGoogleAuth must be used within a GoogleAuthProvider");
  }
  
  return context;
}

// Simple hook to get just the sign-in state
export function useGoogleAuthState() {
  const context = useContext(AuthContext)
  return {
    isAuthenticated: context ? !!context.user : false,
    isLoading: context ? context.isLoading : true
  }
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
    tokenClient: any;
  }
}

