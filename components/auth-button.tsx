"use client";

import Image from "next/image"; // Add this import
import { Button } from "@/components/ui/button";
import { useGoogleAuth } from "@/components/google-auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar"; // Remove AvatarImage
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";

export function AuthButton() {
  const { user, isAuthenticated, isLoading, signIn, signOut } = useGoogleAuth();

  if (isLoading) {
    return (
      <Button disabled>
        <User className="mr-2 h-4 w-4" /> Loading...
      </Button>
    );
  }

  if (isAuthenticated && user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <Avatar className="h-8 w-8 relative">
              {/* Replace AvatarImage with Next Image */}
              {user.avatar && (
                <div className="absolute inset-0">
                  <Image 
                    src={user.avatar} 
                    alt={user.name}
                    fill
                    sizes="32px"
                    unoptimized={true}
                  />
                </div>
              )}
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{user.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Button onClick={() => signIn()} variant="outline">
      <User className="mr-2 h-4 w-4" /> Sign in with Google
    </Button>
  );
}
