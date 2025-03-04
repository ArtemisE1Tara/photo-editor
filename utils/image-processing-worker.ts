/**
 * Web Worker for image processing operations
 * This file will be used to create a web worker at runtime
 */

// Define worker function as a string to be converted to a Blob
export const workerFunctionString = `
// Image processing worker

// Handle messages from main thread
self.onmessage = function(e) {
  const { action, imageData, params, id } = e.data;
  
  try {
    let result;
    
    switch (action) {
      case 'basic-adjustments':
        result = applyBasicAdjustments(imageData, params);
        break;
        
      case 'color-adjustments':
        result = applyColorAdjustments(imageData, params);
        break;
        
      case 'effects':
        result = applyEffects(imageData, params);
        break;
        
      default:
        throw new Error('Unknown action: ' + action);
    }
    
    // Return the result to main thread
    self.postMessage({ 
      success: true, 
      result,
      id
    }, [result.data.buffer]); // Transfer the buffer back for better performance
  } catch (error) {
    self.postMessage({ 
      success: false, 
      error: error.message,
      id
    });
  }
};

/**
 * Apply basic adjustments like brightness, contrast, clarity
 */
function applyBasicAdjustments(imageData, params) {
  const { brightness, contrast, clarity, sharpen } = params;
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Create adjusted copy of the data
  const result = new ImageData(
    new Uint8ClampedArray(data),
    width,
    height
  );
  const resultData = result.data;
  
  // Convert params to usable values
  const brightnessValue = brightness / 100;
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  
  // Process each pixel
  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    // Apply brightness
    let r = resultData[i] * brightnessValue;
    let g = resultData[i + 1] * brightnessValue;
    let b = resultData[i + 2] * brightnessValue;
    
    // Apply contrast
    r = (contrastFactor * (r - 128)) + 128;
    g = (contrastFactor * (g - 128)) + 128;
    b = (contrastFactor * (b - 128)) + 128;
    
    // Apply clarity (local contrast enhancement)
    if (clarity !== 0) {
      const clarityAmount = clarity / 100;
      const avgColor = (r + g + b) / 3;
      r += (r - avgColor) * clarityAmount;
      g += (g - avgColor) * clarityAmount;
      b += (b - avgColor) * clarityAmount;
    }
    
    // Store results with clipping
    resultData[i] = Math.max(0, Math.min(255, Math.round(r)));
    resultData[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
    resultData[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
  }
  
  // Apply sharpening if needed
  if (sharpen > 0) {
    applyUnsharpMask(result, sharpen / 100);
  }
  
  return result;
}

/**
 * Apply Unsharp Mask algorithm for sharpening
 */
function applyUnsharpMask(imageData, amount) {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;
  
  // Create a blurred version for comparison
  const blurredData = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i++) {
    blurredData[i] = data[i];
  }
  
  // Apply simple blur
  applyBoxBlur(blurredData, width, height, 1);
  
  // Apply unsharp mask formula: original + amount * (original - blurred)
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const idx = i + c;
      const orig = data[idx];
      const blur = blurredData[idx];
      const diff = orig - blur;
      data[idx] = Math.max(0, Math.min(255, orig + amount * diff));
    }
  }
}

/**
 * Apply a simple box blur
 */
function applyBoxBlur(data, width, height, radius) {
  const size = width * height * 4;
  const tempData = new Uint8ClampedArray(size);
  
  // Copy original data
  for (let i = 0; i < size; i++) {
    tempData[i] = data[i];
  }
  
  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      
      // Sample the surrounding pixels
      for (let i = -radius; i <= radius; i++) {
        const cx = Math.min(width - 1, Math.max(0, x + i));
        const idx = (y * width + cx) * 4;
        
        r += tempData[idx];
        g += tempData[idx + 1];
        b += tempData[idx + 2];
        a += tempData[idx + 3];
        count++;
      }
      
      // Write back the average values
      const idx = (y * width + x) * 4;
      data[idx] = r / count;
      data[idx + 1] = g / count;
      data[idx + 2] = b / count;
      data[idx + 3] = a / count;
    }
  }
  
  // Copy current data
  for (let i = 0; i < size; i++) {
    tempData[i] = data[i];
  }
  
  // Vertical pass
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      
      // Sample the surrounding pixels
      for (let i = -radius; i <= radius; i++) {
        const cy = Math.min(height - 1, Math.max(0, y + i));
        const idx = (cy * width + x) * 4;
        
        r += tempData[idx];
        g += tempData[idx + 1];
        b += tempData[idx + 2];
        a += tempData[idx + 3];
        count++;
      }
      
      // Write back the average values
      const idx = (y * width + x) * 4;
      data[idx] = r / count;
      data[idx + 1] = g / count;
      data[idx + 2] = b / count;
      data[idx + 3] = a / count;
    }
  }
}

/**
 * Apply color adjustments like saturation, vibrance, etc
 */
function applyColorAdjustments(imageData, params) {
  const { saturation, vibrance, hue, temperature } = params;
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Create adjusted copy of the data
  const result = new ImageData(
    new Uint8ClampedArray(data),
    width,
    height
  );
  const resultData = result.data;
  
  // Convert params to usable values
  const saturationValue = saturation / 100;
  const vibranceValue = vibrance / 100;
  const tempAdjust = temperature / 100; // Range: -1 to 1
  
  // Process each pixel
  const len = data.length;
  for (let i = 0; i < len; i += 4) {
    let r = resultData[i];
    let g = resultData[i + 1];
    let b = resultData[i + 2];
    
    // Apply temperature (blue-yellow balance)
    if (tempAdjust !== 0) {
      // Warmer (yellow-orange)
      if (tempAdjust > 0) {
        r += tempAdjust * 25;
        g += tempAdjust * 15;
        b -= tempAdjust * 25;
      } 
      // Cooler (blue)
      else {
        r += tempAdjust * 15;
        g += tempAdjust * 10;
        b -= tempAdjust * 25;
      }
    }
    
    // Convert RGB to HSL for hue and saturation adjustments
    const hsl = rgbToHsl(r, g, b);
    
    // Apply hue rotation
    if (hue !== 0) {
      hsl[0] = (hsl[0] + hue / 360) % 1;
    }
    
    // Apply saturation
    if (saturation !== 100) {
      // Regular saturation adjustment
      hsl[1] *= saturationValue;
    }
    
    // Apply vibrance (non-linear saturation)
    if (vibrance !== 0) {
      // Calculate how saturated the color already is
      const sat = hsl[1];
      // Apply more vibrance to less saturated colors
      const adjustmentFactor = 1 + vibranceValue * (1 - sat);
      hsl[1] = Math.max(0, Math.min(1, sat * adjustmentFactor));
    }
    
    // Convert back to RGB
    const rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
    
    // Store results with clipping
    resultData[i] = Math.max(0, Math.min(255, Math.round(rgb[0])));
    resultData[i + 1] = Math.max(0, Math.min(255, Math.round(rgb[1])));
    resultData[i + 2] = Math.max(0, Math.min(255, Math.round(rgb[2])));
  }
  
  return result;
}

/**
 * Apply various effects like filters, vignette, etc
 */
function applyEffects(imageData, params) {
  const { filterType, vignette, noise, blur } = params;
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Create adjusted copy of the data
  const result = new ImageData(
    new Uint8ClampedArray(data),
    width,
    height
  );
  const resultData = result.data;
  
  // Apply preset filter effects
  if (filterType && filterType !== 'none') {
    applyFilterPreset(result, filterType);
  }
  
  // Apply vignette effect
  if (vignette > 0) {
    applyVignetteEffect(result, vignette / 100);
  }
  
  // Apply noise
  if (noise > 0) {
    applyNoiseEffect(result, noise / 100);
  }
  
  // Apply blur
  if (blur > 0) {
    const blurRadius = Math.max(1, Math.floor(blur / 20));
    applyBoxBlur(resultData, width, height, blurRadius);
  }
  
  return result;
}

/**
 * Apply a filter preset
 */
function applyFilterPreset(imageData, filterType) {
  const data = imageData.data;
  
  // Define filter presets
  const filters = {
    grayscale: () => {
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        data[i] = data[i + 1] = data[i + 2] = avg;
      }
    },
    sepia: () => {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
        data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
        data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
      }
    },
    invert: () => {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 255 - data[i];         // R
        data[i + 1] = 255 - data[i + 1]; // G
        data[i + 2] = 255 - data[i + 2]; // B
      }
    },
    vintage: () => {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Sepia-like effect
        data[i] = Math.min(255, (r * 0.5) + (g * 0.4) + (b * 0.19) + 40);
        data[i + 1] = Math.min(255, (r * 0.3) + (g * 0.4) + (b * 0.16) + 20);
        data[i + 2] = Math.min(255, (r * 0.2) + (g * 0.3) + (b * 0.26));
      }
    },
    cool: () => {
      for (let i = 0; i < data.length; i += 4) {
        // Enhance blue channel, adjust others
        data[i] = Math.max(0, data[i] * 0.9);     // R
        data[i + 1] = Math.max(0, data[i + 1]);   // G
        data[i + 2] = Math.min(255, data[i + 2] * 1.2); // B
      }
    },
    warm: () => {
      for (let i = 0; i < data.length; i += 4) {
        // Enhance red and green channels
        data[i] = Math.min(255, data[i] * 1.1 + 15);    // R
        data[i + 1] = Math.min(255, data[i + 1] * 1.05); // G
        data[i + 2] = Math.max(0, data[i + 2] * 0.9);    // B
      }
    },
    dramatic: () => {
      // Increase contrast and saturation
      for (let i = 0; i < data.length; i += 4) {
        const hsl = rgbToHsl(data[i], data[i + 1], data[i + 2]);
        hsl[1] = Math.min(1, hsl[1] * 1.3); // Increase saturation
        
        // Add contrast
        hsl[2] = hsl[2] > 0.5 
          ? hsl[2] + (hsl[2] - 0.5) * 0.2
          : hsl[2] - (0.5 - hsl[2]) * 0.2;
        
        const rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
      }
    },
    noir: () => {
      // High contrast black and white
      for (let i = 0; i < data.length; i += 4) {
        let avg = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
        // Enhance contrast
        avg = avg < 127 ? avg * 0.8 : avg * 1.2;
        avg = Math.max(0, Math.min(255, avg));
        data[i] = data[i + 1] = data[i + 2] = avg;
      }
    },
    fade: () => {
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Flatten contrast and add brightness
        data[i] = Math.min(255, r * 0.9 + 20);
        data[i + 1] = Math.min(255, g * 0.9 + 20);
        data[i + 2] = Math.min(255, b * 0.9 + 30);
      }
    }
  };
  
  // Apply the selected filter
  if (filters[filterType]) {
    filters[filterType]();
  }
}

/**
 * Apply vignette effect
 */
function applyVignetteEffect(imageData, amount) {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Calculate distance from center (normalized)
      const dx = (x - centerX) / centerX;
      const dy = (y - centerY) / centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Apply vignette effect based on distance from center
      if (distance > 0.5) {
        const idx = (y * width + x) * 4;
        
        // Calculate vignette factor
        const factor = 1 - Math.min(1, amount * Math.pow((distance - 0.5) * 2, 2));
        
        // Darken pixels
        data[idx] = Math.floor(data[idx] * factor);
        data[idx + 1] = Math.floor(data[idx + 1] * factor);
        data[idx + 2] = Math.floor(data[idx + 2] * factor);
      }
    }
  }
}

/**
 * Apply noise effect
 */
function applyNoiseEffect(imageData, amount) {
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    if (Math.random() < 0.5) continue; // Add noise to only some pixels
    
    // Calculate noise value
    const noise = (Math.random() - 0.5) * amount * 50;
    
    // Apply noise to RGB channels
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  
  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    
    h /= 6;
  }
  
  return [h, s, l];
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h, s, l) {
  let r, g, b;
  
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  
  return [r * 255, g * 255, b * 255];
}
`;

// Create a worker from the script
export function createImageProcessingWorker(): Worker {
  const blob = new Blob([workerFunctionString], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  return new Worker(url);
}

// Helper to send commands to the worker
export function executeImageOperation(
  worker: Worker,
  action: string,
  imageData: ImageData,
  params: any
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const operationId = Date.now().toString();
    
    const handleMessage = (e: MessageEvent) => {
      const { id, success, result, error } = e.data;
      
      if (id === operationId) {
        worker.removeEventListener('message', handleMessage);
        
        if (success) {
          resolve(result);
        } else {
          reject(new Error(error || 'Unknown error in image processing'));
        }
      }
    };
    
    worker.addEventListener('message', handleMessage);
    worker.postMessage({
      action,
      imageData,
      params,
      id: operationId
    }, [imageData.data.buffer]); // Transfer the buffer for performance
  });
}
