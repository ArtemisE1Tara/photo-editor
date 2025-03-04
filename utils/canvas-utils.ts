/**
 * Canvas utility functions for performant image processing
 */

// Create offscreen canvas for better performance
export function createOffscreenCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  } 
  
  // Fallback to regular canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Get browser support info
export function getCanvasSupportInfo() {
  return {
    offscreenCanvasSupported: typeof OffscreenCanvas !== 'undefined',
    webglSupported: isWebGLSupported(),
    webgl2Supported: isWebGL2Supported(),
    canvasFilterSupported: isCSSFilterSupported()
  };
}

// Check if WebGL is supported
function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext && 
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

// Check if WebGL2 is supported
function isWebGL2Supported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
  } catch (e) {
    return false;
  }
}

// Check if CSS Filters are supported
function isCSSFilterSupported(): boolean {
  const el = document.createElement('div');
  el.style.cssText = 'filter: blur(1px)';
  return !!el.style.length;
}

// Image preprocessing for optimal editing
export async function prepareImageForEditing(
  source: string | Blob | HTMLImageElement
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (source instanceof HTMLImageElement && source.complete && source.naturalWidth) {
      resolve(source);
      return;
    }
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    
    if (typeof source === 'string') {
      img.src = source;
    } else if (source instanceof Blob) {
      img.src = URL.createObjectURL(source);
    }
  });
}

// Scale image for preview while maintaining aspect ratio
export function scaleImageForCanvas(
  img: HTMLImageElement | OffscreenCanvas | HTMLCanvasElement,
  maxWidth: number, 
  maxHeight: number
): { width: number; height: number } {
  let width, height;
  
  if (img instanceof HTMLImageElement) {
    width = img.naturalWidth;
    height = img.naturalHeight;
  } else {
    width = img.width;
    height = img.height;
  }
  
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height };
  }
  
  const ratio = Math.min(maxWidth / width, maxHeight / height);
  
  return {
    width: Math.floor(width * ratio),
    height: Math.floor(height * ratio)
  };
}

// Convert image to data URL with optional quality setting
export async function canvasToDataURL(
  canvas: HTMLCanvasElement | OffscreenCanvas, 
  type = 'image/png', 
  quality = 0.92
): Promise<string> {
  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type, quality });
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }
  
  return canvas.toDataURL(type, quality);
}
