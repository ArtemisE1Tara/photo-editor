/**
 * Simplified image processor focused on performance and stability
 */

interface FilterOptions {
  brightness: number;  // 0-2 (1 is normal)
  contrast: number;    // 0-2 (1 is normal)
  saturation: number;  // 0-2 (1 is normal)
  filter: string;      // 'none', 'grayscale', 'sepia', etc.
}

/**
 * Apply filters to an image with optimized performance
 * @param canvas The canvas with the image to process
 * @param options Filter options to apply
 * @returns Promise with data URL of processed image
 */
export async function applyImageFilters(
  canvas: HTMLCanvasElement, 
  options: FilterOptions
): Promise<string | null> {
  // Create a new canvas to avoid modifying the original
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = canvas.width;
  resultCanvas.height = canvas.height;
  
  const ctx = resultCanvas.getContext('2d', {
    willReadFrequently: false, // Better performance
    alpha: true
  });
  
  if (!ctx) return null;
  
  try {
    // First try to use CSS filters (much faster)
    if (supportsCanvasFilters()) {
      return applyWithCSSFilters(canvas, resultCanvas, ctx, options);
    } else {
      // Fall back to pixel manipulation if needed
      return applyWithPixelManipulation(canvas, resultCanvas, ctx, options);
    }
  } catch (error) {
    console.error('Error applying filters:', error);
    // Return the original image on error
    return canvas.toDataURL('image/png', 0.95);
  }
}

/**
 * Check if the browser supports canvas filter API
 */
function supportsCanvasFilters(): boolean {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  return ctx !== null && typeof ctx.filter !== 'undefined';
}

/**
 * Apply filters using CSS filter API (faster)
 */
function applyWithCSSFilters(
  sourceCanvas: HTMLCanvasElement,
  destCanvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  options: FilterOptions
): string {
  // Build CSS filter string
  let filterString = '';
  
  // Apply basic adjustments
  if (options.brightness !== 1) filterString += `brightness(${options.brightness}) `;
  if (options.contrast !== 1) filterString += `contrast(${options.contrast}) `;
  if (options.saturation !== 1) filterString += `saturate(${options.saturation}) `;
  
  // Apply named filter
  if (options.filter !== 'none') {
    filterString += getFilterString(options.filter);
  }
  
  // Apply the filters
  ctx.filter = filterString.trim() || 'none';
  ctx.drawImage(sourceCanvas, 0, 0);
  ctx.filter = 'none';
  
  // Convert to data URL
  return destCanvas.toDataURL('image/png', 0.95);
}

/**
 * Apply filters using pixel manipulation (slower but more compatible)
 */
async function applyWithPixelManipulation(
  sourceCanvas: HTMLCanvasElement,
  destCanvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  options: FilterOptions
): Promise<string> {
  // Draw the original image to the destination canvas
  ctx.drawImage(sourceCanvas, 0, 0);
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, destCanvas.width, destCanvas.height);
  const data = imageData.data;
  
  // Apply adjustments
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    
    // Apply brightness
    if (options.brightness !== 1) {
      r *= options.brightness;
      g *= options.brightness;
      b *= options.brightness;
    }
    
    // Apply contrast
    if (options.contrast !== 1) {
      const factor = (259 * (options.contrast * 255 + 255)) / (255 * (259 - options.contrast * 255));
      r = factor * (r - 128) + 128;
      g = factor * (g - 128) + 128;
      b = factor * (b - 128) + 128;
    }
    
    // Apply saturation
    if (options.saturation !== 1) {
      const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
      r = gray + options.saturation * (r - gray);
      g = gray + options.saturation * (g - gray);
      b = gray + options.saturation * (b - gray);
    }
    
    // Apply filter
    if (options.filter !== 'none') {
      [r, g, b] = applyFilterToPixel(options.filter, r, g, b);
    }
    
    // Store with clipping
    data[i] = Math.max(0, Math.min(255, Math.round(r)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
  }
  
  // Put the processed data back
  ctx.putImageData(imageData, 0, 0);
  
  return destCanvas.toDataURL('image/png', 0.95);
}

/**
 * Apply a filter to a single pixel
 */
function applyFilterToPixel(
  filter: string, 
  r: number, 
  g: number, 
  b: number
): [number, number, number] {
  switch (filter) {
    case 'grayscale':
      const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
      return [gray, gray, gray];
      
    case 'sepia':
      return [
        Math.min(255, r * 0.393 + g * 0.769 + b * 0.189),
        Math.min(255, r * 0.349 + g * 0.686 + b * 0.168),
        Math.min(255, r * 0.272 + g * 0.534 + b * 0.131)
      ];
      
    case 'invert':
      return [255 - r, 255 - g, 255 - b];
      
    case 'warm':
      return [
        Math.min(255, r * 1.1),
        Math.min(255, g * 1.05),
        Math.max(0, b * 0.9)
      ];
      
    case 'cool':
      return [
        Math.max(0, r * 0.9),
        Math.max(0, g * 0.95),
        Math.min(255, b * 1.1)
      ];
      
    case 'vintage':
      return [
        Math.min(255, r * 0.9 + 40),
        Math.min(255, g * 0.8 + 20),
        Math.min(255, b * 0.7 + 10)
      ];
      
    default:
      return [r, g, b];
  }
}

/**
 * Get CSS filter string for a named filter
 */
function getFilterString(filterName: string): string {
  switch (filterName) {
    case 'grayscale': return 'grayscale(1) ';
    case 'sepia': return 'sepia(1) ';
    case 'invert': return 'invert(1) ';
    case 'warm': return 'sepia(0.3) brightness(1.1) saturate(1.3) ';
    case 'cool': return 'hue-rotate(180deg) brightness(1.2) saturate(1.2) ';
    case 'vintage': return 'sepia(0.4) contrast(1.2) brightness(0.9) ';
    default: return '';
  }
}

/**
 * Create a downscaled version of an image for preview
 */
export function createPreviewImage(
  imageUrl: string, 
  maxWidth: number = 600
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      // Calculate new dimensions
      const aspectRatio = img.width / img.height;
      const width = Math.min(maxWidth, img.width);
      const height = Math.floor(width / aspectRatio);
      
      // Create canvas and draw scaled image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not create canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to data URL
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = imageUrl;
  });
}
