/**
 * Storage utilities for image editing with compression and quota management
 */

import { v4 as uuidv4 } from 'uuid';
import { compressImage } from '@/utils/image-utils';

// Storage keys
const SAVED_EDITS_KEY = 'savedEdits';
const MAX_EDITS = 20; // Maximum number of saved edits

// Interface for SavedEdit
export interface SavedEdit {
  id: string;
  name: string;
  dataUrl: string;
  timestamp: number;
  thumbnail?: string; // Smaller version for listing
}

/**
 * Get all saved edits from localStorage with error handling
 */
export function getSavedEdits(): SavedEdit[] {
  try {
    const savedEditsJson = localStorage.getItem(SAVED_EDITS_KEY);
    if (!savedEditsJson) return [];
    
    const savedEdits = JSON.parse(savedEditsJson);
    if (!Array.isArray(savedEdits)) return [];
    
    return savedEdits;
  } catch (error) {
    console.error("Error retrieving saved edits:", error);
    return [];
  }
}

/**
 * Save an edit to localStorage with compression and quota management
 */
export async function saveEditToLocalStorage(
  dataUrl: string, 
  name: string,
  options: { maxSize?: number; quality?: number } = {}
): Promise<string> {
  try {
    // Generate ID
    const id = uuidv4();
    
    // Compress the image to reduce storage usage
    const compressedDataUrl = await compressImage(dataUrl, {
      maxWidth: options.maxSize || 1600,
      quality: options.quality || 0.8
    });
    
    // Create a smaller thumbnail for listings
    const thumbnailDataUrl = await compressImage(dataUrl, {
      maxWidth: 200,
      quality: 0.5
    });
    
    // Create new edit object
    const newEdit: SavedEdit = {
      id,
      name,
      dataUrl: compressedDataUrl,
      thumbnail: thumbnailDataUrl,
      timestamp: Date.now()
    };
    
    // Get existing edits
    let savedEdits = getSavedEdits();
    
    try {
      // Add new edit (at start for most recent first)
      savedEdits = [newEdit, ...savedEdits];
      
      // Keep only a max number of edits to avoid storage issues
      if (savedEdits.length > MAX_EDITS) {
        savedEdits = savedEdits.slice(0, MAX_EDITS);
      }
      
      // Attempt to save
      localStorage.setItem(SAVED_EDITS_KEY, JSON.stringify(savedEdits));
    } catch (storageError) {
      // If quota exceeded, try removing older items
      if (storageError instanceof DOMException && 
          (storageError.name === 'QuotaExceededError' || 
           storageError.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
        
        console.warn("Storage quota exceeded, removing older items");
        
        // Keep only recent items
        if (savedEdits.length > 5) {
          savedEdits = savedEdits.slice(0, 5);
          try {
            localStorage.setItem(SAVED_EDITS_KEY, JSON.stringify(savedEdits));
          } catch (e) {
            // If still failing, just save the new item alone
            localStorage.setItem(SAVED_EDITS_KEY, JSON.stringify([newEdit]));
          }
        } else {
          // If we have very few items but still failing, just save the new one
          localStorage.setItem(SAVED_EDITS_KEY, JSON.stringify([newEdit]));
        }
      } else {
        throw storageError; // Re-throw other errors
      }
    }
    
    return id;
  } catch (error) {
    console.error("Error saving edit locally:", error);
    throw error;
  }
}

/**
 * Delete a saved edit by ID
 */
export function deleteSavedEdit(id: string): boolean {
  try {
    const savedEdits = getSavedEdits().filter(edit => edit.id !== id);
    localStorage.setItem(SAVED_EDITS_KEY, JSON.stringify(savedEdits));
    return true;
  } catch (error) {
    console.error("Error deleting saved edit:", error);
    return false;
  }
}

/**
 * Download an image from a data URL
 */
export function downloadImage(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Clear all saved edits (for cleanup)
 */
export function clearAllSavedEdits(): boolean {
  try {
    localStorage.removeItem(SAVED_EDITS_KEY);
    return true;
  } catch (error) {
    console.error("Error clearing saved edits:", error);
    return false;
  }
}
