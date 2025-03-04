import { getAccessToken } from "@/utils/google-auth";

// Types
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
  createdTime?: string;
}

/**
 * Upload a file to Google Drive with robust error handling and retry capability
 */
export const uploadImageToGoogleDrive = async (
  file: File | Blob,
  filename: string,
  accessToken: string,
  retryCount: number = 1
): Promise<DriveFile> => {
  if (!accessToken) {
    throw new Error("No access token provided");
  }

  console.log(`Starting Drive upload: "${filename}" (Attempt ${retryCount})`);
  
  try {
    // Create a FormData object for the multipart request
    const formData = new FormData();
    
    // Metadata part
    const metadata = {
      name: filename,
      mimeType: file.type || 'image/png',
    };
    
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    
    // File part
    formData.append('file', file);
    
    // Upload to Google Drive
    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData,
        // Increase timeout for large files
        signal: AbortSignal.timeout(60000) // 1 minute timeout
      }
    );
    
    if (!uploadResponse.ok) {
      // Handle specific error cases
      if (uploadResponse.status === 401) {
        throw new Error("Authentication failed. Please sign in again.");
      }
      
      // Try to get the error message from the response
      let errorMessage;
      try {
        const errorData = await uploadResponse.json();
        errorMessage = errorData.error?.message || `Upload failed (${uploadResponse.status})`;
      } catch {
        errorMessage = `Upload failed with status ${uploadResponse.status}`;
      }
      
      throw new Error(errorMessage);
    }
    
    // Successfully uploaded, get the file data
    const fileData = await uploadResponse.json();
    console.log("Upload successful, file ID:", fileData.id);
    
    // Get additional file metadata (like webViewLink)
    let fileDetails: DriveFile = {
      id: fileData.id,
      name: fileData.name,
      mimeType: fileData.mimeType
    };
    
    try {
      // Get web view link and thumbnail in a separate request
      const detailsResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileData.id}?fields=webViewLink,thumbnailLink`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );
      
      if (detailsResponse.ok) {
        const detailsData = await detailsResponse.json();
        fileDetails = {
          ...fileDetails,
          webViewLink: detailsData.webViewLink,
          thumbnailLink: detailsData.thumbnailLink
        };
      }
    } catch (error) {
      // Not critical, we can continue without these details
      console.warn("Couldn't get additional file details:", error);
    }
    
    return fileDetails;
  } catch (error) {
    console.error(`Upload error (attempt ${retryCount}):`, error);
    
    // Retry logic for transient failures
    if (retryCount < 3) {
      console.log(`Retrying upload (attempt ${retryCount + 1})`);
      await new Promise(r => setTimeout(r, 1000)); // Wait 1 second before retry
      return uploadImageToGoogleDrive(file, filename, accessToken, retryCount + 1);
    }
    
    throw error;
  }
};

/**
 * List image files from Google Drive with improved error handling
 */
export const listFilesFromGoogleDrive = async (
  accessToken: string,
  retryCount: number = 1
): Promise<DriveFile[]> => {
  if (!accessToken) {
    throw new Error("No access token provided");
  }

  console.log(`Listing Drive images (Attempt ${retryCount})...`);
  
  try {
    // Query for image files only
    const query = "mimeType contains 'image/'";
    const fields = "files(id,name,mimeType,thumbnailLink,webViewLink,webContentLink,createdTime,imageMediaMetadata)";
    const orderBy = "createdTime desc";
    
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=${encodeURIComponent(orderBy)}&pageSize=50`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        // Set a reasonable timeout
        signal: AbortSignal.timeout(30000) // 30 second timeout
      }
    );
    
    if (!response.ok) {
      // Handle specific error cases
      if (response.status === 401) {
        throw new Error("Authentication failed. Please sign in again.");
      }
      
      throw new Error(`Failed to list files: ${response.statusText || response.status}`);
    }
    
    const data = await response.json();
    console.log(`Found ${data.files?.length || 0} images in Drive`);
    
    if (!data.files || !Array.isArray(data.files)) {
      console.warn("Unexpected response format:", data);
      return [];
    }
    
    return data.files.map((file: any) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      thumbnailLink: file.thumbnailLink,
      webViewLink: file.webViewLink,
      createdTime: file.createdTime
    }));
  } catch (error) {
    console.error(`List files error (attempt ${retryCount}):`, error);
    
    // Retry logic for transient failures
    if (retryCount < 3) {
      console.log(`Retrying list files (attempt ${retryCount + 1})`);
      await new Promise(r => setTimeout(r, 1000)); // Wait 1 second before retry
      return listFilesFromGoogleDrive(accessToken, retryCount + 1);
    }
    
    throw error;
  }
};

// Check if the token is still valid
export async function checkTokenValidity(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
    );
    
    return response.ok;
  } catch (error) {
    console.error("Error checking token validity:", error);
    return false;
  }
}

/**
 * Get a thumbnail or direct download URL for a Google Drive file
 */
export async function getFilePreviewUrl(
  fileId: string,
  accessToken: string
): Promise<string | null> {
  try {
    // First try to get the thumbnail
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink,webContentLink`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to get file preview: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Return thumbnail if available
    if (data.thumbnailLink) {
      // Use the highest resolution
      return data.thumbnailLink.replace('=s220', '=s400');
    }
    
    // Return direct download link as fallback
    if (data.webContentLink) {
      return data.webContentLink;
    }
    
    // Create a direct media URL as last resort
    return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  } catch (error) {
    console.error("Error getting file preview URL:", error);
    return null;
  }
}
