/**
 * High-performance image processor with optimized algorithms
 */
import { createOffscreenCanvas, canvasToDataURL, scaleImageForCanvas } from './canvas-utils';
import { createImageProcessingWorker, executeImageOperation } from './image-processing-worker';

// Store the worker instance for reuse
let worker: Worker | null = null;

// Initialize the worker
function getWorker(): Worker {
  if (!worker) {
    try {
      worker = createImageProcessingWorker();
    } catch (e) {
      console.error('Failed to create image processing worker:', e);
      throw new Error('Could not initialize image processor');
    }
  }
  return worker;
}

// Interface for all adjustment parameters
export interface ImageAdjustments {
  // Basic adjustments
  brightness: number; // 0-200 (100 is normal)
  contrast: number;   // 0-200 (100 is normal)
  clarity: number;    // -100 to 100 (0 is normal)
  sharpen: number;    // 0-100

  // Color adjustments
  saturation: number; // 0-200 (100 is normal)
  vibrance: number;   // -100 to 100 (0 is normal)
  hue: number;        // 0-360 degrees
  temperature: number; // -100 to 100 (0 is normal)

  // Effects
  blur: number;       // 0-100
  vignette: number;   // 0-100
  noise: number;      // 0-100
  filterType: string; // 'none', 'grayscale', 'sepia', etc.
  
  // Transforms
  rotation: number;   // 0, 90, 180, 270 degrees
  flipX: boolean;     // horizontal flip
  flipY: boolean;     // vertical flip
}

// Default adjustment values
export const defaultAdjustments: ImageAdjustments = {
  brightness: 100,
  contrast: 100,
  clarity: 0,
  sharpen: 0,
  saturation: 100,
  vibrance: 0,
  hue: 0,
  temperature: 0,
  blur: 0,
  vignette: 0,
  noise: 0,
  filterType: 'none',
  rotation: 0,
  flipX: false,
  flipY: false
};

// Main ImageProcessor class
export class ImageProcessor {
  private sourceImage: HTMLImageElement | null = null;
  private canvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private editCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
  private originalWidth = 0;
  private originalHeight = 0;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private qualityFactor = 1; // 1 for full quality, <1 for preview
  private worker: Worker | null = null;
  private adjustments: ImageAdjustments = { ...defaultAdjustments };
  private processingPromise: Promise<any> | null = null;

  // Clean up resources
  private cleanup(): void {
    this.sourceImage = null;
    this.canvas = null;
    this.editCanvas = null;
    this.ctx = null;
    this.originalWidth = 0;
    this.originalHeight = 0;
  }
  
  // Load image from data URL
  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  }

  // Get the canvas context
  private getContext(canvas: HTMLCanvasElement | OffscreenCanvas): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
    return canvas.getContext('2d', {
      alpha: true,
      desynchronized: true,
      willReadFrequently: false
    });
  }

  // Initialize the processor with an image
  async initialize(imageDataUrl: string, previewQuality = 'medium'): Promise<void> {
    // Clean up existing resources
    this.cleanup();
    
    // Set quality factor based on preview quality
    this.qualityFactor = previewQuality === 'low' ? 0.5 : 
                         previewQuality === 'medium' ? 0.75 : 1;
    
    // Initialize worker
    try {
      this.worker = getWorker();
    } catch (e) {
      console.warn('Web worker initialization failed, falling back to main thread processing', e);
    }
    
    // Reset adjustments
    this.adjustments = { ...defaultAdjustments };
    
    // Load the image
    this.sourceImage = await this.loadImage(imageDataUrl);
    this.originalWidth = this.sourceImage.naturalWidth;
    this.originalHeight = this.sourceImage.naturalHeight;
    
    // Create canvas for rendering
    const scaledWidth = Math.round(this.originalWidth * this.qualityFactor);
    const scaledHeight = Math.round(this.originalHeight * this.qualityFactor);
    
    this.canvas = createOffscreenCanvas(scaledWidth, scaledHeight);
    this.editCanvas = createOffscreenCanvas(scaledWidth, scaledHeight);
    
    // Initialize the context and draw the image
    this.ctx = this.getContext(this.canvas);
    if (this.ctx) {
      this.ctx.clearRect(0, 0, scaledWidth, scaledHeight);
      this.ctx.drawImage(this.sourceImage, 0, 0, scaledWidth, scaledHeight);
    } else {
      throw new Error('Failed to create canvas context');
    }
  }

  // Update adjustments and apply changes
  async updateAdjustments(newAdjustments: Partial<ImageAdjustments>): Promise<string | null> {
    // Update only the provided adjustments
    this.adjustments = { ...this.adjustments, ...newAdjustments };
    
    // Apply the changes
    return this.processImage();
  }
  
  // Reset all adjustments to default
  async resetAdjustments(): Promise<string | null> {
    this.adjustments = { ...defaultAdjustments };
    return this.processImage();
  }
  
  // Get the current adjustments
  getAdjustments(): ImageAdjustments {
    return { ...this.adjustments };
  }

  // Process the image with current adjustments
  async processImage(): Promise<string | null> {
    if (!this.sourceImage || !this.canvas || !this.ctx) {
      return null;
    }
    
    // If there's an ongoing processing, wait for it to complete
    if (this.processingPromise) {
      await this.processingPromise;
    }
    
    // Create a new processing promise
    this.processingPromise = this._doProcessImage();
    
    try {
      return await this.processingPromise;
    } finally {
      this.processingPromise = null;
    }
  }
  
  // Actual implementation of image processing
  private async _doProcessImage(): Promise<string | null> {
    if (!this.sourceImage || !this.canvas || !this.ctx) {
      return null;
    }
    
    const scaledWidth = Math.round(this.originalWidth * this.qualityFactor);
    const scaledHeight = Math.round(this.originalHeight * this.qualityFactor);
    
    // Apply geometric transformations first (rotation, flip)
    this.ctx.clearRect(0, 0, scaledWidth, scaledHeight);
    this.ctx.save();
    
    // Handle rotation and flipping
    this.ctx.translate(scaledWidth / 2, scaledHeight / 2);
    this.ctx.rotate((this.adjustments.rotation * Math.PI) / 180);
    this.ctx.scale(
      this.adjustments.flipX ? -1 : 1, 
      this.adjustments.flipY ? -1 : 1
    );
    this.ctx.drawImage(
      this.sourceImage, 
      -scaledWidth / 2, 
      -scaledHeight / 2, 
      scaledWidth, 
      scaledHeight
    );
    this.ctx.restore();
    
    // Get image data for pixel manipulation
    let imageData = this.ctx.getImageData(0, 0, scaledWidth, scaledHeight);
    
    // Process the image using the web worker if available
    if (this.worker) {
      try {
        // Basic adjustments (brightness, contrast, clarity, sharpen)
        imageData = await executeImageOperation(
          this.worker,
          'basic-adjustments',
          imageData,
          {
            brightness: this.adjustments.brightness,
            contrast: this.adjustments.contrast,
            clarity: this.adjustments.clarity,
            sharpen: this.adjustments.sharpen
          }
        );
        
        // Color adjustments (saturation, vibrance, hue, temperature)
        imageData = await executeImageOperation(
          this.worker,
          'color-adjustments',
          imageData,
          {
            saturation: this.adjustments.saturation,
            vibrance: this.adjustments.vibrance,
            hue: this.adjustments.hue,
            temperature: this.adjustments.temperature
          }
        );
        
        // Effects (filter, vignette, noise, blur)
        if (
          this.adjustments.filterType !== 'none' || 
          this.adjustments.vignette > 0 || 
          this.adjustments.noise > 0 ||
          this.adjustments.blur > 0
        ) {
          imageData = await executeImageOperation(
            this.worker,
            'effects',
            imageData,
            {
              filterType: this.adjustments.filterType,
              vignette: this.adjustments.vignette,
              noise: this.adjustments.noise,
              blur: this.adjustments.blur
            }
          );
        }
        
        // Draw the processed image data back to the canvas
        this.ctx.putImageData(imageData, 0, 0);
      } catch (error) {
        console.error('Worker processing failed, falling back to main thread:', error);
        // Fall back to main thread processing on worker failure
        return this.processImageOnMainThread();
      }
    } else {
      // Process on main thread if worker is not available
      return this.processImageOnMainThread();
    }
    
    // Return the final image as data URL
    return canvasToDataURL(this.canvas, 'image/png', 0.95);
  }
  
  // Main thread fallback for image processing
  private async processImageOnMainThread(): Promise<string | null> {
    if (!this.sourceImage || !this.canvas || !this.editCanvas || !this.ctx) {
      return null;
    }
    
    // Get contexts for both canvases
    const editCtx = this.getContext(this.editCanvas);
    if (!editCtx) {
      return null;
    }
    
    const scaledWidth = this.canvas.width;
    const scaledHeight = this.canvas.height;
    
    // Copy the image to the edit canvas for processing
    editCtx.clearRect(0, 0, scaledWidth, scaledHeight);
    editCtx.drawImage(this.canvas, 0, 0);
    
    // Get image data for pixel manipulation
    let imageData = editCtx.getImageData(0, 0, scaledWidth, scaledHeight);
    const data = imageData.data;
    
    // Apply brightness and contrast
    const brightness = this.adjustments.brightness / 100;
    const contrastFactor = (259 * (this.adjustments.contrast + 255)) / (255 * (259 - this.adjustments.contrast));
    
    // Process pixels
    for (let i = 0; i < data.length; i += 4) {
      // Apply brightness
      let r = data[i] * brightness;
      let g = data[i + 1] * brightness;
      let b = data[i + 2] * brightness;
      
      // Apply contrast
      r = (contrastFactor * (r - 128)) + 128;
      g = (contrastFactor * (g - 128)) + 128;
      b = (contrastFactor * (b - 128)) + 128;
      
      // Apply clarity
      if (this.adjustments.clarity !== 0) {
        const clarityAmount = this.adjustments.clarity / 100;
        const avgColor = (r + g + b) / 3;
        r += (r - avgColor) * clarityAmount;
        g += (g - avgColor) * clarityAmount;
        b += (b - avgColor) * clarityAmount;
      }
      
      // Apply saturation
      if (this.adjustments.saturation !== 100) {
        const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
        const satFactor = this.adjustments.saturation / 100;
        r = gray + satFactor * (r - gray);
        g = gray + satFactor * (g - gray);
        b = gray + satFactor * (b - gray);
      }
      
      // Store final values with clipping
      data[i] = Math.max(0, Math.min(255, Math.round(r)));
      data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }
    
    // Put the processed data back
    editCtx.putImageData(imageData, 0, 0);
    
    // Apply filter effects
    if (this.adjustments.filterType !== 'none') {
      this.applyFilter(editCtx, this.adjustments.filterType);
    }
    
    // Apply vignette effect
    if (this.adjustments.vignette > 0) {
      this.applyVignette(editCtx, this.adjustments.vignette / 100);
    }
    
    // Copy the processed image back to the main canvas
    this.ctx.clearRect(0, 0, scaledWidth, scaledHeight);
    this.ctx.drawImage(this.editCanvas, 0, 0);
    
    // Return the final image as data URL
    return canvasToDataURL(this.canvas, 'image/png', 0.95);
  }
  
  // Apply a filter effect
  private applyFilter(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, filterType: string): void {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    // Create a copy of the canvas content
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    switch (filterType) {
      case 'grayscale':
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
          data[i] = data[i + 1] = data[i + 2] = avg;
        }
        break;
        
      case 'sepia':
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
          data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
          data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
        }
        break;
      
      case 'invert':
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
        break;
      
      // Add more filter types as needed
    }
    
    ctx.putImageData(imageData, 0, 0);
  }
  
  // Apply vignette effect
  private applyVignette(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, 
    amount: number
  ): void {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    ctx.save();
    
    // Create radial gradient for vignette
    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2))
    );
    
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, `rgba(0,0,0,${amount * 0.7})`);
    
    // Apply the gradient
    ctx.fillStyle = gradient;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillRect(0, 0, width, height);
    
    ctx.restore();
  }
  
  // Generate a high-quality output image
  async generateFinalImage(): Promise<string | null> {
    if (!this.sourceImage) return null;
    
    // Create a canvas at original resolution
    const finalCanvas = createOffscreenCanvas(this.originalWidth, this.originalHeight);
    const finalCtx = this.getContext(finalCanvas);
    
    if (!finalCtx) return null;
    
    // Save the current quality factor
    const oldQualityFactor = this.qualityFactor;
    
    try {
      // Set to full quality for final rendering
      this.qualityFactor = 1;
      
      // Resize the canvases
      if (this.canvas) {
        this.canvas.width = this.originalWidth;
        this.canvas.height = this.originalHeight;
      }
      
      if (this.editCanvas) {
        this.editCanvas.width = this.originalWidth;
        this.editCanvas.height = this.originalHeight;
      }
      
      // Process the image at full resolution
      const fullQualityDataUrl = await this.processImage();
      
      // Return the high-quality result
      return fullQualityDataUrl;
    } finally {
      // Restore the previous quality factor
      this.qualityFactor = oldQualityFactor;
      
      // Restore canvas sizes
      if (this.canvas) {
        this.canvas.width = Math.round(this.originalWidth * this.qualityFactor);
        this.canvas.height = Math.round(this.originalHeight * this.qualityFactor);
      }
      
      if (this.editCanvas) {
        this.editCanvas.width = Math.round(this.originalWidth * this.qualityFactor);
        this.editCanvas.height = Math.round(this.originalHeight * this.qualityFactor);
      }
      
      // Redraw at preview quality
      if (this.ctx && this.sourceImage) {
        this.ctx.drawImage(
          this.sourceImage, 
          0, 0, 
          Math.round(this.originalWidth * this.qualityFactor),
          Math.round(this.originalHeight * this.qualityFactor)
        );
      }
    }
  }
  
  // Destroy the processor and release resources
  destroy(): void {
    this.cleanup();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
