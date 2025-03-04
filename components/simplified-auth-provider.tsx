"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useToast } from "@/components/ui/use-toast";
import { GoogleAuthButton, type GoogleUser } from "./google-auth-button";

interface AuthContextType {
  user: GoogleUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signOut: () => void;
  getAccessToken: () => string | null;
  AuthButton: () => JSX.Element;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SimplifiedAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Check for existing auth on mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem("googleUser");
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.error("Error loading saved auth:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAuthSuccess = (user: GoogleUser) => {
    setUser(user);
    toast({
      title: "Signed in successfully",
      description: `Welcome, ${user.name}`,
    });
  };

  const handleAuthFailure = (error: Error) => {
    toast({
      title: "Sign in failed",
      description: error.message,
      variant: "destructive",
    });
  };

  const signOut = () => {
    localStorage.removeItem("googleUser");
    setUser(null);
    toast({
      title: "Signed out successfully",
    });
  };

  const getAccessToken = () => {
    return user?.accessToken || null;
  };

  // Provide the auth button component
  const AuthButton = () => {
    if (user) {
      return (
        <button onClick={signOut} className="text-blue-500 hover:underline">
          Sign Out ({user.name})
        </button>
      );
    }
    
    return (
      <GoogleAuthButton
        onSuccess={handleAuthSuccess}
        onFailure={handleAuthFailure}
      />
    );
  };

  // The auth context value
  const authContextValue: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signOut,
    getAccessToken,
    AuthButton,
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSimplifiedAuth() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useSimplifiedAuth must be used within a SimplifiedAuthProvider");
  }
  
  return context;
}
