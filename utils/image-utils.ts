/**
 * Image utilities for compression and manipulation
 */

interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Convert a data URL to an Image element
 */
export function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Compress an image data URL to reduce file size
 */
export async function compressImage(
  dataUrl: string, 
  options: CompressOptions = {}
): Promise<string> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.8
  } = options;
  
  try {
    // Load image
    const img = await dataUrlToImage(dataUrl);
    
    // Calculate dimensions while maintaining aspect ratio
    let width = img.width;
    let height = img.height;
    
    if (width > maxWidth || height > maxHeight) {
      const aspectRatio = width / height;
      
      if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
      }
      
      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }
    }
    
    // Create canvas for resizing
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    
    // Draw and resize image
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    ctx.drawImage(img, 0, 0, width, height);
    
    // Get the image type from the original data URL
    let outputType = 'image/jpeg';
    if (dataUrl.startsWith('data:image/png')) {
      outputType = 'image/png';
    }
    
    // For JPEGs, use quality parameter
    // For PNGs, ignore quality (not applicable)
    const compressionQuality = outputType === 'image/jpeg' ? quality : undefined;
    
    // Get compressed data URL
    return canvas.toDataURL(outputType, compressionQuality);
  } catch (error) {
    console.error('Error compressing image:', error);
    // Return original if compression fails
    return dataUrl;
  }
}

/**
 * Create a thumbnail from a data URL
 */
export async function createThumbnail(
  dataUrl: string,
  maxSize: number = 200
): Promise<string> {
  return compressImage(dataUrl, {
    maxWidth: maxSize,
    maxHeight: maxSize,
    quality: 0.6
  });
}

/**
 * Calculate image file size in bytes (approximate)
 */
export function calculateImageSize(dataUrl: string): number {
  // Remove the data URL prefix
  const base64 = dataUrl.split(',')[1];
  // Calculate size in bytes (each base64 character represents 6 bits)
  return Math.ceil((base64.length * 6) / 8);
}
