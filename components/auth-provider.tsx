"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { 
  getCurrentUser, 
  getAccessToken, 
  signIn as googleSignIn,
  signOut as googleSignOut,
  loadGoogleApi,
  type GoogleUser
} from "@/utils/google-auth";
import { useToast } from "@/components/ui/use-toast";

// Define context type
interface AuthContextType {
  user: GoogleUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Initialize auth on component mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try to load Google API
        await loadGoogleApi();
        
        // Check if user is already signed in
        const savedUser = getCurrentUser();
        if (savedUser) {
          // Verify token is still valid
          const token = await getAccessToken();
          if (token) {
            setUser(savedUser);
          } else {
            // Token invalid, clear user
            localStorage.removeItem('google_user');
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    initAuth();
  }, []);

  // Sign in function
  const signIn = async () => {
    try {
      setIsLoading(true);
      const newUser = await googleSignIn();
      setUser(newUser);
      toast({
        title: "Signed in successfully",
        description: `Welcome, ${newUser.name}`,
      });
    } catch (error: any) {
      console.error("Sign in error:", error);
      toast({
        title: "Sign in failed",
        description: error.message || "Could not sign in with Google",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      setIsLoading(true);
      await googleSignOut();
      setUser(null);
      toast({
        title: "Signed out successfully",
      });
    } catch (error) {
      console.error("Sign out error:", error);
      toast({
        title: "Sign out failed",
        description: "Could not sign out properly",
        variant: "destructive",
      });
      
      // Force sign out anyway
      localStorage.removeItem('google_user');
      localStorage.removeItem('google_access_token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to get token for API calls
  const getToken = async () => {
    return await getAccessToken();
  };

  // Prepare context value
  const contextValue: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signIn,
    signOut,
    getToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  return context;
}
