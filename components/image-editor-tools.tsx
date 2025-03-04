"use client";

import { useState, useEffect, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  RotateCw, RotateCcw, FlipHorizontal, FlipVertical, 
  SunMedium, Contrast, Filter, Undo, Redo, RefreshCw,
  Droplets, Palette, ImageIcon
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { applyImageFilters } from "@/utils/simple-image-processor";

interface ImageEditorToolsProps {
  imageDataUrl: string;
  onImageChange: (newImageDataUrl: string) => void;
  onReset?: () => void;
}

export function ImageEditorTools({
  imageDataUrl,
  onImageChange,
  onReset
}: ImageEditorToolsProps) {
  // UI state
  const [activeTab, setActiveTab] = useState<string>("basic");
  const [isRealtime, setIsRealtime] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // History state
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Adjustment values
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [filter, setFilter] = useState<string>("none");
  const [rotation, setRotation] = useState<number>(0);
  const [isFlippedX, setIsFlippedX] = useState<boolean>(false);
  const [isFlippedY, setIsFlippedY] = useState<boolean>(false);

  // References
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const queuedUpdatesRef = useRef<any>(null);
  const isFirstRenderRef = useRef<boolean>(true);
  const pendingOpRef = useRef<boolean>(false);

  // Load original image when source changes
  useEffect(() => {
    if (!imageDataUrl) return;
    
    const img = new Image();
    img.onload = () => {
      originalImageRef.current = img;
      
      // Initialize history with original image
      setHistory([imageDataUrl]);
      setHistoryIndex(0);

      // Reset all settings
      setBrightness(100);
      setContrast(100);
      setSaturation(100);
      setFilter("none");
      setRotation(0);
      setIsFlippedX(false);
      setIsFlippedY(false);
      
      isFirstRenderRef.current = true;
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  // Apply changes when controls are modified
  useEffect(() => {
    // Skip the first render to avoid double processing
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    // Don't process if we're already processing or no image loaded
    if (isProcessing || !originalImageRef.current || pendingOpRef.current) {
      return;
    }

    // For non-realtime mode, do nothing until explicitly applied
    if (!isRealtime) return;

    // Clear any queued updates
    if (queuedUpdatesRef.current) {
      clearTimeout(queuedUpdatesRef.current);
    }

    // Queue a new update with debouncing
    queuedUpdatesRef.current = setTimeout(() => {
      applyChanges();
    }, 300);

    return () => {
      if (queuedUpdatesRef.current) {
        clearTimeout(queuedUpdatesRef.current);
      }
    };
  }, [brightness, contrast, saturation, filter, rotation, isFlippedX, isFlippedY, isRealtime]);

  // Apply changes to the image
  const applyChanges = async () => {
    if (!originalImageRef.current || isProcessing || pendingOpRef.current) return;
    
    setIsProcessing(true);
    pendingOpRef.current = true;

    try {
      // Process on the next animation frame for better UI responsiveness
      await new Promise(resolve => requestAnimationFrame(resolve));

      // Create a canvas element if we don't have a reference yet
      if (!canvasRef.current) {
        canvasRef.current = document.createElement("canvas");
      }
      
      const canvas = canvasRef.current;
      const img = originalImageRef.current;
      
      // Set canvas dimensions
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      // Get canvas context
      const ctx = canvas.getContext("2d", { 
        alpha: true, 
        willReadFrequently: false
      });
      
      if (!ctx) return;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Apply transformations
      ctx.save();
      
      // Handle rotation and flipping
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(isFlippedX ? -1 : 1, isFlippedY ? -1 : 1);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      
      // Draw the original image
      ctx.drawImage(img, 0, 0);
      
      ctx.restore();
      
      // Apply simplified filters for better performance
      const result = await applyImageFilters(canvas, {
        brightness: brightness / 100,
        contrast: contrast / 100,
        saturation: saturation / 100,
        filter
      });
      
      if (!result) return;
      
      // Update history
      const newImageDataUrl = result;
      setHistory(prev => {
        const newHistory = [...prev.slice(0, historyIndex + 1), newImageDataUrl];
        // Limit history size
        return newHistory.length > 10 ? newHistory.slice(-10) : newHistory;
      });
      setHistoryIndex(prev => prev + 1);
      
      // Send back to parent component
      onImageChange(newImageDataUrl);
    } finally {
      setIsProcessing(false);
      pendingOpRef.current = false;
    }
  };

  // Handle undo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevImage = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      onImageChange(prevImage);
    }
  };

  // Handle redo
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextImage = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      onImageChange(nextImage);
    }
  };

  // Reset all adjustments
  const handleReset = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setFilter("none");
    setRotation(0);
    setIsFlippedX(false);
    setIsFlippedY(false);
    
    if (onReset && history.length > 0) {
      onReset();
    }
  };

  // Basic slider component with optimized rendering
  const AdjustmentSlider = ({ 
    label, icon, value, setValue, min, max, step 
  }: { 
    label: string;
    icon?: React.ReactNode;
    value: number;
    setValue: (value: number) => void;
    min: number;
    max: number;
    step: number;
  }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="flex items-center gap-2">
          {icon}
          {label}
        </Label>
        <span className="text-xs text-muted-foreground">{value}</span>
      </div>
      <Slider 
        value={[value]} 
        onValueChange={(values) => setValue(values[0])} 
        min={min} 
        max={max} 
        step={step}
        disabled={isProcessing}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <div className="flex gap-1.5">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleUndo} 
            disabled={historyIndex <= 0 || isProcessing}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRedo} 
            disabled={historyIndex >= history.length - 1 || isProcessing}
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Switch
            checked={isRealtime}
            onCheckedChange={setIsRealtime}
            id="auto-update"
          />
          <Label htmlFor="auto-update" className="text-xs cursor-pointer">
            Auto-update
          </Label>
          
          <Button 
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isProcessing}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      {!isRealtime && (
        <Button 
          variant="secondary" 
          className="w-full" 
          onClick={applyChanges}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <ImageIcon className="mr-2 h-4 w-4" />
              Apply Changes
            </>
          )}
        </Button>
      )}

      <Tabs defaultValue="basic" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="filters">Filters</TabsTrigger>
          <TabsTrigger value="transform">Transform</TabsTrigger>
        </TabsList>
        
        <TabsContent value="basic" className="space-y-4 pt-2">
          <AdjustmentSlider
            label="Brightness"
            icon={<SunMedium className="h-4 w-4" />}
            value={brightness}
            setValue={setBrightness}
            min={0}
            max={200}
            step={5}
          />
          
          <AdjustmentSlider
            label="Contrast"
            icon={<Contrast className="h-4 w-4" />}
            value={contrast}
            setValue={setContrast}
            min={0}
            max={200}
            step={5}
          />
          
          <AdjustmentSlider
            label="Saturation"
            icon={<Droplets className="h-4 w-4" />}
            value={saturation}
            setValue={setSaturation}
            min={0}
            max={200}
            step={5}
          />
        </TabsContent>
        
        <TabsContent value="filters" className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="flex items-center mb-2">
              <Filter className="h-4 w-4 mr-2" /> Filters
            </Label>
            <Select 
              value={filter} 
              onValueChange={setFilter}
              disabled={isProcessing}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Filter</SelectItem>
                <SelectItem value="grayscale">Grayscale</SelectItem>
                <SelectItem value="sepia">Sepia</SelectItem>
                <SelectItem value="invert">Invert</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="cool">Cool</SelectItem>
                <SelectItem value="vintage">Vintage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Button
              variant={filter === "none" ? "secondary" : "outline"}
              onClick={() => setFilter("none")}
              className="h-16 text-xs"
              disabled={isProcessing}
            >
              Original
            </Button>
            <Button
              variant={filter === "grayscale" ? "secondary" : "outline"}
              onClick={() => setFilter("grayscale")}
              className="h-16 text-xs"
              disabled={isProcessing}
            >
              B&W
            </Button>
            <Button
              variant={filter === "vintage" ? "secondary" : "outline"}
              onClick={() => setFilter("vintage")}
              className="h-16 text-xs"
              disabled={isProcessing}
            >
              Vintage
            </Button>
          </div>
        </TabsContent>
        
        <TabsContent value="transform" className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label className="block mb-2">Rotate & Flip</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotation(r => (r - 90) % 360)}
                disabled={isProcessing}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" /> Left
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotation(r => (r + 90) % 360)}
                disabled={isProcessing}
              >
                <RotateCw className="mr-1.5 h-4 w-4" /> Right
              </Button>
              <Button
                variant={isFlippedX ? "secondary" : "outline"}
                size="sm"
                onClick={() => setIsFlippedX(f => !f)}
                disabled={isProcessing}
              >
                <FlipHorizontal className="mr-1.5 h-4 w-4" /> Flip H
              </Button>
              <Button
                variant={isFlippedY ? "secondary" : "outline"}
                size="sm"
                onClick={() => setIsFlippedY(f => !f)}
                disabled={isProcessing}
              >
                <FlipVertical className="mr-1.5 h-4 w-4" /> Flip V
              </Button>
            </div>
          </div>
          
          <div className="text-sm text-center text-muted-foreground mt-4">
            Current rotation: {rotation}°
          </div>
        </TabsContent>
      </Tabs>

      {isProcessing && (
        <div className="flex justify-center items-center py-2 bg-muted/20 rounded-md">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Processing...</span>
        </div>
      )}
    </div>
  );
}
