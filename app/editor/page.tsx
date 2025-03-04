"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useGoogleAuth } from "@/components/google-auth-provider";
import { AuthButton } from "@/components/auth-button";
import { uploadImageToGoogleDrive } from "@/utils/google-drive-api"; 
import { 
  saveEditToLocalStorage,
  getSavedEdits, 
  deleteSavedEdit,
  downloadImage 
} from "@/utils/editor-storage";
import { compressImage } from "@/utils/image-utils";
import { ImageEditorTools } from "@/components/image-editor-tools";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  Download, 
  Save, 
  Trash2, 
  Upload, 
  RefreshCw,
  CloudUpload,
  Image as ImageIcon,
  Home,
  Grid,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function EditorPage() {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [savedEdits, setSavedEdits] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingEdits, setIsLoadingEdits] = useState(false);
  const [isShowingSavedDialog, setIsShowingSavedDialog] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingError, setEditingError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const { toast } = useToast();
  const { isAuthenticated, getAccessToken } = useGoogleAuth();

  // Load saved edits from localStorage
  const loadSavedEdits = () => {
    try {
      setIsLoadingEdits(true);
      const edits = getSavedEdits();
      setSavedEdits(edits);
    } catch (error) {
      console.error("Error loading saved edits:", error);
    } finally {
      setIsLoadingEdits(false);
    }
  };

  // Load saved edits on mount
  useEffect(() => {
    loadSavedEdits();
  }, []);

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageDataUrl(result);
      setOriginalImage(result);
    };
    reader.readAsDataURL(file);
  };

  // Handle image change from editor tools
  const handleImageChange = (newImageDataUrl: string) => {
    try {
      console.log("Received updated image from editor tools");
      setImageDataUrl(newImageDataUrl);
      setEditingError(null);
    } catch (error) {
      console.error("Error updating image:", error);
      setEditingError(`Error applying edits: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Reset to original image
  const handleResetImage = () => {
    if (originalImage) {
      setImageDataUrl(originalImage);
    }
  };

  // Save current edit to localStorage
  const saveToLocalStorage = async () => {
    if (!imageDataUrl) {
      toast({
        title: "No image to save",
        description: "Please select or edit an image first.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Show saving indicator
      toast({
        title: "Saving locally...",
        description: "Compressing image for storage",
      });
      
      const editName = imageName || `Edit ${new Date().toLocaleString()}`;
      
      // Save with compression to avoid quota issues
      await saveEditToLocalStorage(imageDataUrl, editName, { 
        quality: 0.8, 
        maxSize: 1200 
      });
      
      loadSavedEdits(); // Refresh the list
      
      // Success message
      toast({
        title: "Saved locally",
        description: "Your edit has been saved to your browser.",
      });
    } catch (error) {
      console.error("Error saving edit locally:", error);
      
      // More specific error message based on the type
      if (error instanceof DOMException && 
          (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        toast({
          title: "Storage space full",
          description: "Try deleting some saved edits to make space.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Could not save your edit locally.",
          variant: "destructive",
        });
      }
    }
  };

  // Download current image to device
  const handleDownload = () => {
    if (!imageDataUrl) {
      toast({
        title: "No image to download",
        description: "Please select or edit an image first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const filename = imageName || `edited-image-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
      downloadImage(imageDataUrl, filename);
      toast({
        title: "Download started",
        description: "Your image is being downloaded.",
      });
    } catch (error) {
      console.error("Error downloading:", error);
      toast({
        title: "Download failed",
        description: "Could not download the image.",
        variant: "destructive",
      });
    }
  };

  // Load a saved edit
  const loadSavedEdit = (edit: any) => {
    setImageDataUrl(edit.dataUrl);
    setOriginalImage(edit.dataUrl);
    setImageName(edit.name);
    setIsShowingSavedDialog(false);
    
    // Success message with proper handling in case dataUrl is very large
    toast({
      title: "Edit loaded",
      description: `Loaded: ${edit.name}`,
      duration: 2000,
    });
  };

  // Delete a saved edit
  const handleDeleteEdit = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Prevent triggering the parent click handler
    }
    
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

  // Save edited image to Google Drive
  const handleSaveToGoogleDrive = async () => {
    if (!imageDataUrl) {
      toast({
        title: "No image to save",
        description: "Please select or edit an image first",
        variant: "destructive",
      });
      return;
    }
  
    if (!isAuthenticated) {
      toast({
        title: "Sign in required",
        description: "You need to sign in with Google to save to Drive",
        variant: "destructive",
      });
      return;
    }
    
    setIsSaving(true);
    setUploadError(null);
    
    try {
      console.log("Starting save to Google Drive process...");
      
      // Step 1: Get the access token
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Failed to get access token. Please sign in again.");
      }
      
      console.log("Got access token, preparing image...");
      
      // Step 2: Convert data URL to blob with proper type
      const dataUrlParts = imageDataUrl.split(',');
      const mimeMatch = dataUrlParts[0].match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      
      const blobData = atob(dataUrlParts[1]);
      const arrayBuffer = new ArrayBuffer(blobData.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      
      for (let i = 0; i < blobData.length; i++) {
        uint8Array[i] = blobData.charCodeAt(i);
      }
      
      const blob = new Blob([arrayBuffer], { type: mimeType });
      
      // Step 3: Generate a filename
      const filename = imageName || `pixelvault-image-${new Date().toISOString().substring(0, 19).replace(/[-:T]/g, '')}.png`;
      
      console.log(`Uploading image as "${filename}"...`);
      
      // Step 4: Upload to Google Drive
      const result = await uploadImageToGoogleDrive(blob, filename, accessToken);
      
      console.log("Upload successful!", result);
      
      // Show success message
      toast({
        title: "Saved to Google Drive",
        description: `Image saved as "${filename}"`,
      });
      
      // Also save locally as backup
      await saveToLocalStorage();
    } catch (error: any) {
      const errorMessage = error.message || "Unknown error occurred";
      setUploadError(errorMessage);
      
      console.error("Upload failed:", error);
      
      // Show error message to user
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Save locally as fallback
      try {
        await saveToLocalStorage();
        toast({
          title: "Saved locally instead",
          description: "Your image was saved to browser storage as a backup",
        });
      } catch (e) {
        console.error("Failed to save locally as fallback:", e);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handle drag and drop
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        setImageName(file.name);
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setImageDataUrl(result);
          setOriginalImage(result);
        };
        reader.readAsDataURL(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select an image file (JPEG, PNG, etc.)",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="container mx-auto p-4">
      <header className="flex justify-between items-center mb-6 border-b pb-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Photo Editor</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1">
              <Home className="h-4 w-4" /> Home
            </Button>
          </Link>
          <Link href="/gallery">
            <Button variant="ghost" size="sm" className="gap-1">
              <Grid className="h-4 w-4" /> Gallery
            </Button>
          </Link>
          <AuthButton />
        </div>
      </header>

      <main>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Image Editor Panel */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Image Editor</CardTitle>
              <CardDescription>Upload, edit, and save your images</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                className={`border-2 rounded-lg ${isDragging ? 'border-primary border-dashed' : 'border-muted'} p-4 bg-muted/10 min-h-[400px] flex items-center justify-center transition-colors`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {imageDataUrl ? (
                  <div className="relative w-full">
                    <img 
                      src={imageDataUrl} 
                      alt="Selected" 
                      className="mx-auto rounded-md object-contain max-h-[400px]" 
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full w-full py-12 transition-all">
                    <div className={`bg-muted/30 rounded-full p-6 mb-4 ${isDragging ? 'bg-primary/20' : ''}`}>
                      <ImageIcon className={`h-12 w-12 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <h3 className="text-xl font-medium mb-2">
                      {isDragging ? 'Drop Image Here' : 'Select an Image to Edit'}
                    </h3>
                    <p className="text-muted-foreground text-center mb-6 max-w-md">
                      {isDragging ? 'Release to upload' : 'Choose an image from your device to start editing. Supported formats: JPG, PNG, WEBP, GIF'}
                    </p>
                    {!isDragging && (
                      <div className="flex flex-col sm:flex-row gap-3 items-center">
                        <Button 
                          size="lg"
                          onClick={() => document.getElementById("file-input")?.click()}
                          className="gap-2"
                        >
                          <Upload className="h-5 w-5" /> Upload Image
                        </Button>
                        <input
                          id="file-input"
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <p className="text-xs text-muted-foreground mt-2 sm:mt-0 sm:ml-2">
                          or drag and drop an image file here
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {imageDataUrl && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="image-name" className="w-24">Image Name:</Label>
                    <Input 
                      id="image-name" 
                      value={imageName} 
                      onChange={(e) => setImageName(e.target.value)} 
                      placeholder="Enter a name for your image"
                      className="flex-1"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => document.getElementById("file-input")?.click()}>
                      <Upload className="mr-2 h-4 w-4" /> Select New Image
                    </Button>
                    
                    <Button onClick={saveToLocalStorage} variant="secondary">
                      <Save className="mr-2 h-4 w-4" /> Save to Browser
                    </Button>
                    
                    <Button onClick={handleDownload} variant="secondary">
                      <Download className="mr-2 h-4 w-4" /> Save to Device
                    </Button>
                    
                    <Button 
                      onClick={handleSaveToGoogleDrive} 
                      disabled={!isAuthenticated || isSaving}
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <CloudUpload className="mr-2 h-4 w-4" />
                          Save to Google Drive
                        </>
                      )}
                    </Button>

                    <Dialog open={isShowingSavedDialog} onOpenChange={setIsShowingSavedDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <ImageIcon className="mr-2 h-4 w-4" /> Open Saved Edits
                        </Button>
                      </DialogTrigger>
                      <DialogContent 
                        className="sm:max-w-[425px]" 
                        aria-describedby="saved-edits-description"
                      >
                        <DialogHeader>
                          <DialogTitle>Saved Edits</DialogTitle>
                          <p id="saved-edits-description" className="text-sm text-muted-foreground">
                            Your locally saved image edits.
                          </p>
                        </DialogHeader>
                        <div className="grid gap-4 max-h-[60vh] overflow-y-auto py-4">
                          {savedEdits.length > 0 ? (
                            savedEdits.map((edit) => (
                              <div
                                key={edit.id}
                                className="flex items-center gap-2 p-2 border rounded cursor-pointer hover:bg-muted/50"
                                onClick={() => loadSavedEdit(edit)}
                              >
                                <div className="h-16 w-16 border rounded overflow-hidden">
                                  <img
                                    src={edit.thumbnail || edit.dataUrl}
                                    alt={edit.name}
                                    className="h-full w-full object-cover" 
                                  />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{edit.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(edit.timestamp).toLocaleString()}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => handleDeleteEdit(edit.id, e)}
                                  aria-label={`Delete ${edit.name}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))
                          ) : (
                            <p className="text-center text-muted-foreground">
                              No saved edits found.
                            </p>
                          )}
                        </div>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">Close</Button>
                          </DialogClose>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Editing Tools Panel */}
          <div className="space-y-4">
            {imageDataUrl && (
              <Card>
                <CardHeader>
                  <CardTitle>Editing Tools</CardTitle>
                  <CardDescription>Adjust and enhance your image</CardDescription>
                </CardHeader>
                <CardContent>
                  {editingError && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{editingError}</AlertDescription>
                    </Alert>
                  )}
                  <ImageEditorTools 
                    imageDataUrl={originalImage || imageDataUrl}
                    onImageChange={handleImageChange}
                    onReset={handleResetImage}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}