"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useGoogleAuth } from "@/components/google-auth-provider";
import { AuthButton } from "@/components/auth-button";
import { listFilesFromGoogleDrive } from "@/utils/google-drive-api";
import { getSavedEdits, deleteSavedEdit } from "@/utils/editor-storage";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  RefreshCw,
  Trash2,
  Home,
  PencilRuler,
  ImageIcon,
  ExternalLink,
  AlertOctagon
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function GalleryPage() {
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [savedEdits, setSavedEdits] = useState<any[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { isAuthenticated, getAccessToken } = useGoogleAuth();

  // Fetch Google Drive images with improved error handling
  const fetchDriveFiles = useCallback(async () => {
    if (!isAuthenticated) {
      setDriveError("Please sign in to view your Google Drive images");
      return;
    }
    
    setDriveError(null); // Reset any previous errors
    
    try {
      setIsLoadingDrive(true);
      setDriveFiles([]); // Clear images while loading
      
      console.log("Fetching Google Drive files...");
      
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setDriveError("Failed to get access token. Please sign in again.");
        console.error("No access token available");
        return;
      }
      
      console.log("Got access token, requesting files...");
      
      const files = await listFilesFromGoogleDrive(accessToken);
      
      console.log(`Retrieved ${files?.length || 0} files from Drive`);
      console.log("Files sample:", files?.slice(0, 2));
      
      if (Array.isArray(files)) {
        setDriveFiles(files);
      } else {
        setDriveError("Invalid response from Google Drive API");
        console.error("Invalid files response:", files);
      }
    } catch (error: any) {
      console.error("Error fetching Drive files:", error);
      setDriveError(error.message || "Failed to load Google Drive images");
      toast({
        title: "Error Loading Images",
        description: `${error.message || "Unknown error"}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingDrive(false);
    }
  }, [isAuthenticated, getAccessToken, toast]);

  // Load saved edits from localStorage
  const loadSavedEdits = useCallback(() => {
    try {
      setIsLoadingLocal(true);
      const edits = getSavedEdits();
      setSavedEdits(edits);
    } catch (error) {
      console.error("Error loading saved edits:", error);
      toast({
        title: "Error",
        description: "Failed to load your local edits.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingLocal(false);
    }
  }, [toast]);

  // Load data when component mounts or auth state changes
  useEffect(() => {
    loadSavedEdits();
    
    if (isAuthenticated) {
      fetchDriveFiles();
    }
  }, [isAuthenticated, fetchDriveFiles, loadSavedEdits]);

  // Delete a saved edit
  const handleDeleteEdit = (id: string) => {
    try {
      deleteSavedEdit(id);
      loadSavedEdits(); // Refresh the list
      toast({
        title: "Edit deleted",
        description: "The saved edit has been deleted.",
      });
    } catch (error) {
      console.error("Error deleting edit:", error);
      toast({
        title: "Error",
        description: "Could not delete the edit.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-4">
      <header className="flex justify-between items-center mb-6 border-b pb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Image Gallery</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1">
              <Home className="h-4 w-4" /> Home
            </Button>
          </Link>
          <Link href="/editor">
            <Button variant="ghost" size="sm" className="gap-1">
              <PencilRuler className="h-4 w-4" /> Editor
            </Button>
          </Link>
          <AuthButton />
        </div>
      </header>

      <main>
        <Card>
          <CardHeader>
            <CardTitle>Your Images</CardTitle>
            <CardDescription>
              Browse your Google Drive and local images
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="cloud">
              <TabsList className="w-full grid grid-cols-2 mb-4">
                <TabsTrigger value="cloud">Google Drive</TabsTrigger>
                <TabsTrigger value="local">Local Edits</TabsTrigger>
              </TabsList>
              <TabsContent value="cloud" className="p-4 border rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Google Drive Images</h2>
                  {isAuthenticated && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      disabled={isLoadingDrive}
                      onClick={fetchDriveFiles}
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingDrive ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                  )}
                </div>
                
                {!isAuthenticated ? (
                  <div className="text-center p-8 border rounded-lg bg-muted/20">
                    <p className="text-muted-foreground mb-4">
                      Sign in to view your Google Drive images
                    </p>
                    <AuthButton />
                  </div>
                ) : isLoadingDrive ? (
                  <div className="flex justify-center items-center p-12">
                    <div className="flex flex-col items-center">
                      <RefreshCw className="h-8 w-8 animate-spin mb-2" />
                      <p>Loading your images...</p>
                    </div>
                  </div>
                ) : driveError ? (
                  <div className="text-center p-8 border rounded-lg bg-red-50">
                    <AlertOctagon className="h-8 w-8 text-red-500 mx-auto mb-2" />
                    <p className="text-red-600 font-medium mb-2">Error loading images</p>
                    <p className="text-muted-foreground mb-4">{driveError}</p>
                    <Button onClick={fetchDriveFiles}>Try Again</Button>
                  </div>
                ) : driveFiles.length === 0 ? (
                  <div className="text-center p-8 border rounded-lg bg-muted/20">
                    <p className="text-muted-foreground">
                      No images found in your Google Drive
                    </p>
                    <Link href="/editor">
                      <Button className="mt-4">Create Your First Image</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {driveFiles.map((file) => (
                      <div key={file.id} className="border rounded-lg overflow-hidden group">
                        <div className="relative h-40 bg-muted/50 flex items-center justify-center">
                          {file.thumbnailLink ? (
                            <ImageWithFallback 
                              src={processThumbnailUrl(file.thumbnailLink)}
                              alt={file.name}
                              fileId={file.id}
                              accessToken={getAccessToken}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="font-medium truncate text-sm" title={file.name}>
                            {file.name}
                          </h3>
                          <div className="flex justify-between items-center mt-2">
                            <p className="text-xs text-muted-foreground">
                              {file.createdTime ? new Date(file.createdTime).toLocaleDateString() : "No date"}
                            </p>
                            {file.webViewLink && (
                              <a 
                                href={file.webViewLink} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs flex items-center text-primary hover:underline"
                              >
                                Open <ExternalLink className="h-3 w-3 ml-1" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-4 p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                  <p>Tip: If you don't see your images, try refreshing or signing out and back in.</p>
                </div>
              </TabsContent>
              
              <TabsContent value="local" className="p-4 border rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Local Saved Edits</h2>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={isLoadingLocal}
                    onClick={loadSavedEdits}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoadingLocal ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                
                {isLoadingLocal ? (
                  <div className="flex justify-center items-center p-12">
                    <div className="flex flex-col items-center">
                      <RefreshCw className="h-8 w-8 animate-spin mb-2" />
                      <p>Loading your local edits...</p>
                    </div>
                  </div>
                ) : savedEdits.length === 0 ? (
                  <div className="text-center p-8 border rounded-lg bg-muted/20">
                    <p className="text-muted-foreground">
                      No saved edits found in your browser
                    </p>
                    <Link href="/editor">
                      <Button className="mt-4">Start Editing</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
                    {savedEdits.map((edit) => (
                      <div key={edit.id} className="border rounded-lg overflow-hidden">
                        <div className="relative h-40 bg-muted/50">
                          <img
                            src={edit.dataUrl}
                            alt={edit.name}
                            className="h-full w-full object-contain" 
                          />
                        </div>
                        <div className="p-3">
                          <div className="flex justify-between items-center">
                            <h3 className="font-medium truncate text-sm flex-1" title={edit.name}>
                              {edit.name}
                            </h3>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteEdit(edit.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground">
                              {new Date(edit.timestamp).toLocaleString()}
                            </p>
                            <Link href="/editor" className="text-xs text-primary hover:underline">
                              Edit in Editor
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// Helper function to process Google Drive thumbnail URLs for better compatibility
function processThumbnailUrl(url: string): string {
  // Remove any query parameters that might cause CORS issues
  return url.split('=')[0];
}

// Component to handle image loading with fallback
function ImageWithFallback({ 
  src, 
  alt, 
  fileId,
  accessToken
}: { 
  src: string; 
  alt: string; 
  fileId: string;
  accessToken: () => Promise<string | null>;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSrc, setImgSrc] = useState<string>(src);

  // Try to load the thumbnail directly first
  useEffect(() => {
    setIsLoading(true);
    setError(false);
  }, [src]);

  // Try to load the image directly from Google Drive if the thumbnail fails
  const loadDriveImageDirectly = useCallback(async () => {
    try {
      const token = await accessToken();
      if (!token || !fileId) {
        setError(true);
        return;
      }
      
      // Create an auth-enabled direct URL
      const directUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      
      // Pre-fetch to check if it works
      const response = await fetch(directUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        // Create a blob URL from the response
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setImgSrc(blobUrl);
        setError(false);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Failed to load image directly:", err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [fileId, accessToken]);

  return (
    <div className="w-full h-full relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      
      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/20 p-2">
          <AlertOctagon className="h-5 w-5 text-muted-foreground mb-1" />
          <p className="text-xs text-center text-muted-foreground">Cannot load preview</p>
        </div>
      ) : (
        <img
          ref={imgRef}
          src={imgSrc}
          alt={alt}
          className={cn(
            "w-full h-full object-contain transition-opacity",
            isLoading ? "opacity-0" : "opacity-100"
          )}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            // If normal thumbnail loading fails, try direct loading
            if (imgSrc === src) {
              loadDriveImageDirectly();
            } else {
              setError(true);
              setIsLoading(false);
            }
          }}
        />
      )}
    </div>
  );
}

