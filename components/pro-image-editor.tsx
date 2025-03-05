"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ReactCrop, { centerCrop, makeAspectCrop, Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Slider } from "../components/ui/slider";
import { Button } from "../components/ui/button";
import { useDebouncedCallback } from 'use-debounce';
import {
  CropIcon,
  SlidersHorizontal,
  Palette,
  PencilLine,
  Undo2,
  Redo2,
  Save,
  X,
  Image,
  Minimize,
  Maximize,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Circle,
  Square
} from "lucide-react";

interface ProImageEditorProps {
  imageUrl: string | null;
  onSave: (editedImageUrl: string, imageFile: File) => void;
  onCancel: () => void;
}

// Available filter presets
const FILTERS = [
  { id: 'none', name: 'Normal', filter: '' },
  { id: 'grayscale', name: 'Grayscale', filter: 'grayscale(100%)' },
  { id: 'sepia', name: 'Sepia', filter: 'sepia(100%)' },
  { id: 'invert', name: 'Invert', filter: 'invert(100%)' },
  { id: 'warm', name: 'Warm', filter: 'sepia(50%) hue-rotate(-30deg) saturate(140%)' },
  { id: 'cool', name: 'Cool', filter: 'hue-rotate(180deg) saturate(70%)' },
  { id: 'vintage', name: 'Vintage', filter: 'sepia(30%) contrast(110%) brightness(110%) saturate(85%)' },
  { id: 'dramatic', name: 'Dramatic', filter: 'contrast(150%) brightness(90%) saturate(120%)' },
  { id: 'muted', name: 'Muted', filter: 'saturate(60%) brightness(105%) contrast(85%)' },
  { id: 'high-contrast', name: 'High Contrast', filter: 'contrast(180%) brightness(100%) saturate(110%)' }
];

// Aspect ratio presets for cropping
const ASPECT_RATIOS = [
  { id: 'free', name: 'Free', value: null },
  { id: '1:1', name: '1:1', value: 1 },
  { id: '4:3', name: '4:3', value: 4/3 },
  { id: '16:9', name: '16:9', value: 16/9 },
  { id: '3:4', name: '3:4', value: 3/4 },
  { id: '9:16', name: '9:16', value: 9/16 }
];

export function ProImageEditor({ imageUrl, onSave, onCancel }: ProImageEditorProps) {
  // Core state
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [isSliding, setIsSliding] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1);
  const [isImageLoaded, setIsImageLoaded] = useState<boolean>(false);
  
  // Basic adjustments
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  
  // Advanced adjustments
  const [blurStrength, setBlurStrength] = useState<number>(0);
  const [sharpness, setSharpness] = useState<number>(0); 
  const [vignette, setVignette] = useState<number>(0);
  const [filter, setFilter] = useState<string>('none');
  
  // Transformations
  const [isFlippedX, setIsFlippedX] = useState<boolean>(false);
  const [isFlippedY, setIsFlippedY] = useState<boolean>(false);
  
  // Canvas and history
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const vignetteCanvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<Array<string>>([]);
  const historyIndexRef = useRef<number>(-1);
  const requestIdRef = useRef<number>();

  // Open editor when image URL is provided
  useEffect(() => {
    if (imageUrl) {
      setIsOpen(true);
      setIsImageLoaded(false); // Reset image loaded state
      // Reset all adjustments
      setCrop(undefined);
      setCompletedCrop(undefined);
      setAspect(undefined);
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setRotation(0);
      setBlurStrength(0);
      setSharpness(0);
      setVignette(0);
      setFilter('none');
      setScale(1);
      setIsFlippedX(false);
      setIsFlippedY(false);
      historyRef.current = [];
      historyIndexRef.current = -1;
    } else {
      setIsOpen(false);
    }
  }, [imageUrl]);

  // Apply vignette effect
  const applyVignette = useCallback((ctx: CanvasRenderingContext2D, amount: number) => {
    const canvas = ctx.canvas;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    if (amount <= 0) return; // Skip if no vignette
    
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, Math.sqrt(Math.pow(canvas.width / 2, 2) + Math.pow(canvas.height / 2, 2))
    );
    
    // Black vignette with transparency based on amount
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)'); // Start darkening at 70%
    gradient.addColorStop(1, `rgba(0, 0, 0, ${amount / 100 * 0.7})`); // Max 70% opacity
    
    ctx.fillStyle = gradient;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Apply sharpness using convolution
  const applySharpness = useCallback((ctx: CanvasRenderingContext2D, amount: number) => {
    if (amount <= 0) return; // Skip if no sharpness
    
    // We'll use a simple CSS filter for this until we implement a proper convolution shader
    const normalizedAmount = amount / 100 * 0.5; // Limit sharpness to prevent artifacts
    ctx.filter = `${ctx.filter || ''} contrast(${100 + amount * 0.3}%) brightness(${100 + amount * 0.1}%)`;
  }, []);

  // Create a preview canvas for real-time updates
  const updatePreview = useCallback(() => {
    if (!isImageLoaded || !imageRef.current || !previewCanvasRef.current) {
      return; // Don't try to draw if image isn't loaded yet
    }
    
    const canvas = previewCanvasRef.current;
    const image = imageRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) return;

    // Check for valid image
    if (image.naturalWidth === 0 || image.naturalHeight === 0) {
      console.warn('Image not fully loaded yet');
      return;
    }

    try {
      // Match the canvas size to the displayed image size for better performance
      canvas.width = image.width;
      canvas.height = image.height;
      
      ctx.save();
      
      // Clear the canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Handle rotation if needed
      if (rotation !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }
      
      // Handle flips if needed
      if (isFlippedX || isFlippedY) {
        ctx.scale(isFlippedX ? -1 : 1, isFlippedY ? -1 : 1);
        if (isFlippedX) {
          ctx.translate(-canvas.width, 0);
        }
        if (isFlippedY) {
          ctx.translate(0, -canvas.height);
        }
      }
      
      // Apply basic adjustments
      let filterString = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      
      // Apply blur if set
      if (blurStrength > 0) {
        filterString += ` blur(${blurStrength / 10}px)`;
      }
      
      // Apply preset filter if selected
      const selectedFilter = FILTERS.find(f => f.id === filter);
      if (selectedFilter && selectedFilter.id !== 'none') {
        filterString += ` ${selectedFilter.filter}`;
      }
      
      ctx.filter = filterString;
      
      // Draw the entire image for preview (cropping will be applied on save)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      
      // Apply sharpness effect (needs to be done after drawing the image)
      if (sharpness > 0) {
        applySharpness(ctx, sharpness);
      }
      
      // Apply vignette effect
      if (vignette > 0) {
        applyVignette(ctx, vignette);
      }
      
      ctx.restore();
    } catch (error) {
      console.error('Error updating preview:', error);
    }
  }, [
    isImageLoaded, brightness, contrast, saturation, rotation, blurStrength, 
    sharpness, vignette, filter, isFlippedX, isFlippedY, applyVignette, applySharpness
  ]);
  
  // Apply current edits to high-quality canvas for saving
  const applyEdits = useCallback(() => {
    if (!isImageLoaded || !imageRef.current || !canvasRef.current) {
      return; // Don't try to draw if image isn't loaded
    }
    
    const canvas = canvasRef.current;
    const image = imageRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) return;

    // Check for valid image
    if (image.naturalWidth === 0 || image.naturalHeight === 0) {
      console.warn('Image not fully loaded yet');
      return;
    }

    try {
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      
      // Set canvas dimensions based on crop or full image with original resolution
      if (completedCrop) {
        canvas.width = completedCrop.width * scaleX;
        canvas.height = completedCrop.height * scaleY;
      } else {
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
      }
      
      ctx.save();
      
      // Handle rotation if needed
      if (rotation !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }
      
      // Handle flips if needed
      if (isFlippedX || isFlippedY) {
        ctx.scale(isFlippedX ? -1 : 1, isFlippedY ? -1 : 1);
        if (isFlippedX) {
          ctx.translate(-canvas.width, 0);
        }
        if (isFlippedY) {
          ctx.translate(0, -canvas.height);
        }
      }
      
      // Apply basic adjustments
      let filterString = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      
      // Apply blur if set
      if (blurStrength > 0) {
        filterString += ` blur(${blurStrength / 10}px)`;
      }
      
      // Apply preset filter if selected
      const selectedFilter = FILTERS.find(f => f.id === filter);
      if (selectedFilter && selectedFilter.id !== 'none') {
        filterString += ` ${selectedFilter.filter}`;
      }
      
      ctx.filter = filterString;
      
      // Draw the image with crop if applicable
      if (completedCrop) {
        ctx.drawImage(
          image,
          completedCrop.x * scaleX,
          completedCrop.y * scaleY,
          completedCrop.width * scaleX,
          completedCrop.height * scaleY,
          0,
          0,
          canvas.width,
          canvas.height
        );
      } else {
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      }
      
      // Apply sharpness effect (needs to be done after drawing the image)
      if (sharpness > 0) {
        applySharpness(ctx, sharpness);
      }
      
      // Apply vignette effect
      if (vignette > 0) {
        applyVignette(ctx, vignette);
      }
      
      ctx.restore();
    } catch (error) {
      console.error('Error applying edits:', error);
    }
  }, [
    isImageLoaded, completedCrop, brightness, contrast, saturation, rotation,
    blurStrength, sharpness, vignette, filter,
    isFlippedX, isFlippedY, applyVignette, applySharpness
  ]);

  // Debounced save to history to prevent too many history states
  const debouncedSaveToHistory = useDebouncedCallback(() => {
    saveToHistory();
    setIsSliding(false);
  }, 300);

  // Save current state to history
  const saveToHistory = useCallback(() => {
    applyEdits(); // Apply edits to the high-quality canvas
    
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      
      // Remove any future history if we're not at the latest point
      if (historyIndexRef.current < historyRef.current.length - 1) {
        historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      }
      
      historyRef.current.push(dataUrl);
      historyIndexRef.current = historyRef.current.length - 1;
    }
  }, [applyEdits]);

  // Add image to history when first loaded
  useEffect(() => {
    if (imageUrl && imageRef.current) {
      const img = imageRef.current;
      
      const handleImageLoad = () => {
        setIsImageLoaded(true);
        // Must wait for image to load before saving first history state
        requestAnimationFrame(() => {
          saveToHistory();
          // Initialize the preview
          updatePreview();
        });
      };
      
      // Set up the load handler
      img.onload = handleImageLoad;
      
      // If the image is already loaded (happens with cached images)
      if (img.complete) {
        handleImageLoad();
      }
      
      // Cleanup handler
      return () => {
        img.onload = null;
      };
    }
  }, [imageUrl, saveToHistory, updatePreview]);

  // Set center crop when aspect ratio changes
  const centerAspectCrop = useCallback(
    (mediaWidth: number, mediaHeight: number, aspect: number) => {
      return centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: 90,
          },
          aspect,
          mediaWidth,
          mediaHeight
        ),
        mediaWidth,
        mediaHeight
      );
    },
    []
  );

  // Handle aspect ratio changes
  const handleAspectChange = useCallback((newAspect: number | null) => {
    if (imageRef.current) {
      const { width, height } = imageRef.current;
      
      if (newAspect) {
        setAspect(newAspect);
        setCrop(centerAspectCrop(width, height, newAspect));
      } else {
        setAspect(undefined);
        setCrop(undefined);
      }
    }
  }, [centerAspectCrop]);

  // Handle slider changes with real-time updates
  const handleSliderChange = useCallback((setter: Function, value: number) => {
    // Set the state immediately for UI update
    setter(value);
    setIsSliding(true);
    
    // Cancel any in-progress animation frame
    if (requestIdRef.current) {
      cancelAnimationFrame(requestIdRef.current);
    }
    
    // Schedule an update to the preview canvas
    requestIdRef.current = requestAnimationFrame(() => {
      updatePreview();
    });
    
    // Schedule saving to history (debounced)
    debouncedSaveToHistory();
  }, [updatePreview, debouncedSaveToHistory]);

  // Handle rotation by increments
  const handleRotateBy = useCallback((degrees: number) => {
    setRotation(prev => (prev + degrees) % 360);
    
    // Update preview immediately
    requestAnimationFrame(() => {
      updatePreview();
    });
    
    // Save to history
    debouncedSaveToHistory();
  }, [updatePreview, debouncedSaveToHistory]);

  // Handle flip actions
  const handleFlip = useCallback((axis: 'x' | 'y') => {
    if (axis === 'x') {
      setIsFlippedX(prev => !prev);
    } else {
      setIsFlippedY(prev => !prev);
    }
    
    // Update preview immediately
    requestAnimationFrame(() => {
      updatePreview();
    });
    
    // Save to history
    debouncedSaveToHistory();
  }, [updatePreview, debouncedSaveToHistory]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const prevState = historyRef.current[historyIndexRef.current];
      
      if (prevState) {
        // Load the previous state into the image and display it
        const img = document.createElement('img');
        img.onload = () => {
          if (canvasRef.current && previewCanvasRef.current) {
            // Update both canvases
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              canvasRef.current.width = img.width;
              canvasRef.current.height = img.height;
              ctx.drawImage(img, 0, 0);
            }
            
            // Also update preview canvas to show change immediately
            const previewCtx = previewCanvasRef.current.getContext('2d');
            if (previewCtx) {
              previewCanvasRef.current.width = imageRef.current?.width || img.width;
              previewCanvasRef.current.height = imageRef.current?.height || img.height;
              previewCtx.drawImage(img, 0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
            }
          }
        };
        img.src = prevState;
      }
    }
  }, []);

  // Redo function
  const handleRedo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current++;
      const nextState = historyRef.current[historyIndexRef.current];
      
      if (nextState) {
        // Load the next state into the image and display it
        const img = document.createElement('img');
        img.onload = () => {
          if (canvasRef.current && previewCanvasRef.current) {
            // Update both canvases
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              canvasRef.current.width = img.width;
              canvasRef.current.height = img.height;
              ctx.drawImage(img, 0, 0);
            }
            
            // Also update preview canvas to show change immediately
            const previewCtx = previewCanvasRef.current.getContext('2d');
            if (previewCtx) {
              previewCanvasRef.current.width = imageRef.current?.width || img.width;
              previewCanvasRef.current.height = imageRef.current?.height || img.height;
              previewCtx.drawImage(img, 0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height);
            }
          }
        };
        img.src = nextState;
      }
    }
  }, []);

  // Handle save
  const handleSave = useCallback(() => {
    // Make sure we apply all edits to high quality canvas
    applyEdits();
    
    if (canvasRef.current) {
      const editedImageUrl = canvasRef.current.toDataURL('image/png');
      
      // Convert base64 to File object
      const byteString = atob(editedImageUrl.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([ab], { type: 'image/png' });
      const file = new File([blob], 'edited-image.png', { type: 'image/png' });
      
      // Invoke the callback with edited image URL and file
      onSave(editedImageUrl, file);
      
      // Close the editor
      setIsOpen(false);
    }
  }, [applyEdits, onSave]);
  
  // Handle close
  const handleClose = useCallback(() => {
    setIsOpen(false);
    onCancel();
  }, [onCancel]);

  // Resize image
  const handleResize = useCallback((size: 'small' | 'large') => {
    const newScale = size === 'small' ? Math.max(0.5, scale - 0.1) : Math.min(2, scale + 0.1);
    setScale(newScale);
    
    // Update the preview immediately
    requestAnimationFrame(() => {
      updatePreview();
    });
    
    // Save to history (debounced)
    debouncedSaveToHistory();
  }, [scale, updatePreview, debouncedSaveToHistory]);

  // Update canvas when crop changes
  const handleCropComplete = useCallback((c: PixelCrop) => {
    setCompletedCrop(c);
    debouncedSaveToHistory();
  }, [debouncedSaveToHistory]);

  // Fix filters requiring double-click with a more direct approach
  const handleFilterChange = useCallback((filterId: string) => {
    // Apply the filter value immediately to internal state
    setFilter(filterId);
    
    // Apply the filter directly without waiting for state update
    const selectedFilter = FILTERS.find(f => f.id === filterId);
    
    // Force the preview to update immediately with the new filter
    if (imageRef.current && previewCanvasRef.current) {
      const canvas = previewCanvasRef.current;
      const image = imageRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx || !isImageLoaded) return;
      
      try {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        
        // Apply transformations
        if (rotation !== 0) {
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate((rotation * Math.PI) / 180);
          ctx.translate(-canvas.width / 2, -canvas.height / 2);
        }
        
        if (isFlippedX || isFlippedY) {
          ctx.scale(isFlippedX ? -1 : 1, isFlippedY ? -1 : 1);
          if (isFlippedX) ctx.translate(-canvas.width, 0);
          if (isFlippedY) ctx.translate(0, -canvas.height);
        }
        
        // Apply basic adjustments and the new filter immediately
        let filterString = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
        if (blurStrength > 0) filterString += ` blur(${blurStrength / 10}px)`;
        if (selectedFilter && selectedFilter.id !== 'none') filterString += ` ${selectedFilter.filter}`;
        
        ctx.filter = filterString;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        
        if (sharpness > 0) applySharpness(ctx, sharpness);
        if (vignette > 0) applyVignette(ctx, vignette);
        
        ctx.restore();
      } catch (error) {
        console.error('Error applying filter:', error);
      }
    }
    
    // Save to history
    saveToHistory();
  }, [
    brightness, contrast, saturation, rotation, blurStrength, 
    sharpness, vignette, isFlippedX, isFlippedY, 
    applySharpness, applyVignette, isImageLoaded, saveToHistory
  ]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (requestIdRef.current) {
        cancelAnimationFrame(requestIdRef.current);
      }
    };
  }, []);

  // Don't render anything if no image URL is provided
  if (!imageUrl || !isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">Edit Image</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleUndo} disabled={historyIndexRef.current <= 0}>
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleRedo} disabled={historyIndexRef.current >= historyRef.current.length - 1}>
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button variant="default" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          <div className="w-64 border-r p-4 flex flex-col overflow-y-auto">
            <Tabs defaultValue="adjust">
              <TabsList className="grid w-full grid-cols-5 mb-4">
                <TabsTrigger value="adjust" className="flex flex-col items-center px-1 py-2">
                  <SlidersHorizontal className="h-4 w-4 mb-1" />
                  <span className="text-xs">Adjust</span>
                </TabsTrigger>
                <TabsTrigger value="filters" className="flex flex-col items-center px-1 py-2">
                  <Palette className="h-4 w-4 mb-1" />
                  <span className="text-xs">Filters</span>
                </TabsTrigger>
                <TabsTrigger value="crop" className="flex flex-col items-center px-1 py-2">
                  <CropIcon className="h-4 w-4 mb-1" />
                  <span className="text-xs">Crop</span>
                </TabsTrigger>
                <TabsTrigger value="transform" className="flex flex-col items-center px-1 py-2">
                  <RotateCw className="h-4 w-4 mb-1" />
                  <span className="text-xs">Transform</span>
                </TabsTrigger>
                <TabsTrigger value="effects" className="flex flex-col items-center px-1 py-2">
                  <Image className="h-4 w-4 mb-1" />
                  <span className="text-xs">Effects</span>
                </TabsTrigger>
              </TabsList>
              
              {/* Basic adjustments tab */}
              <TabsContent value="adjust" className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">
                    Brightness: {brightness}% {isSliding ? "(adjusting...)" : ""}
                  </label>
                  <Slider 
                    value={[brightness]} 
                    min={0} 
                    max={200} 
                    step={1}
                    onValueChange={(v) => handleSliderChange(setBrightness, v[0])}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">
                    Contrast: {contrast}% {isSliding ? "(adjusting...)" : ""}
                  </label>
                  <Slider 
                    value={[contrast]} 
                    min={0} 
                    max={200} 
                    step={1}
                    onValueChange={(v) => handleSliderChange(setContrast, v[0])}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">
                    Saturation: {saturation}% {isSliding ? "(adjusting...)" : ""}
                  </label>
                  <Slider 
                    value={[saturation]} 
                    min={0} 
                    max={200} 
                    step={1}
                    onValueChange={(v) => handleSliderChange(setSaturation, v[0])}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">
                    Sharpness: {sharpness} {isSliding ? "(adjusting...)" : ""}
                  </label>
                  <Slider 
                    value={[sharpness]} 
                    min={0} 
                    max={100} 
                    step={1}
                    onValueChange={(v) => handleSliderChange(setSharpness, v[0])}
                  />
                </div>
              </TabsContent>
              
              {/* Filters tab */}
              <TabsContent value="filters" className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {FILTERS.map((filterOption) => (
                    <Button 
                      key={filterOption.id}
                      variant={filter === filterOption.id ? "default" : "outline"}
                      onClick={() => handleFilterChange(filterOption.id)}
                      className="capitalize"
                    >
                      {filterOption.name}
                    </Button>
                  ))}
                </div>
              </TabsContent>
              
              {/* Crop tab */}
              <TabsContent value="crop" className="space-y-4">
                <div className="mb-4">
                  <h3 className="text-sm font-medium mb-2">Aspect Ratio</h3>
                  <div className="flex flex-wrap gap-2">
                    {ASPECT_RATIOS.map((option) => (
                      <Button 
                        key={option.id}
                        size="sm"
                        variant={
                          (option.value === null && aspect === undefined) || 
                          (option.value !== null && aspect === option.value) 
                            ? "default" 
                            : "outline"
                        }
                        onClick={() => handleAspectChange(option.value || null)}
                      >
                        {option.name}
                      </Button>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      setCrop(undefined);
                      setCompletedCrop(undefined);
                    }}
                  >
                    Reset Crop
                  </Button>
                </div>
              </TabsContent>
              
              {/* Transform tab */}
              <TabsContent value="transform" className="space-y-4">
                <div className="flex justify-center gap-2">
                  <Button onClick={() => handleRotateBy(-90)} variant="outline" size="sm">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Rotate Left
                  </Button>
                  <Button onClick={() => handleRotateBy(90)} variant="outline" size="sm">
                    <RotateCw className="h-4 w-4 mr-2" />
                    Rotate Right
                  </Button>
                </div>
                <div className="flex justify-center gap-2">
                  <Button onClick={() => handleFlip('x')} variant="outline" size="sm">
                    <FlipHorizontal className="h-4 w-4 mr-2" />
                    Flip Horizontal
                  </Button>
                  <Button onClick={() => handleFlip('y')} variant="outline" size="sm">
                    <FlipVertical className="h-4 w-4 mr-2" />
                    Flip Vertical
                  </Button>
                </div>
              </TabsContent>
              
              {/* Effects tab */}
              <TabsContent value="effects" className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">
                    Blur: {blurStrength} {isSliding ? "(adjusting...)" : ""}
                  </label>
                  <Slider 
                    value={[blurStrength]} 
                    min={0} 
                    max={100} 
                    step={1}
                    onValueChange={(v) => handleSliderChange(setBlurStrength, v[0])}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">
                    Vignette: {vignette} {isSliding ? "(adjusting...)" : ""}
                  </label>
                  <Slider 
                    value={[vignette]} 
                    min={0} 
                    max={100} 
                    step={1}
                    onValueChange={(v) => handleSliderChange(setVignette, v[0])}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="flex-1 p-4 overflow-auto flex items-center justify-center bg-gray-100">
            <div className="relative">
              <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                onComplete={handleCropComplete}
                aspect={aspect}
              >
                {/* Stack the canvas over the original image for real-time preview */}
                <div className="relative">
                  <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Editing"
                    onLoad={() => setIsImageLoaded(true)}
                    onError={() => console.error("Image failed to load")}
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '65vh',
                      transform: `scale(${scale})`,
                      transformOrigin: 'center',
                      display: 'block',
                      visibility: 'hidden',
                      position: 'relative',
                      zIndex: 1
                    }}
                  />
                  {isImageLoaded && (
                    <canvas
                      ref={previewCanvasRef}
                      style={{
                        maxWidth: '100%', 
                        maxHeight: '65vh',
                        transform: `scale(${scale})`,
                        transformOrigin: 'center',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        zIndex: 2
                      }}
                    />
                  )}
                </div>
              </ReactCrop>
              {/* Hidden canvas for high-quality rendering when saving */}
              <canvas
                ref={canvasRef}
                style={{ display: 'none' }}
              />
              
              {!isImageLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-70">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-2">Loading image...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
