/**
 * Simplified Google Drive API utility
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webViewLink?: string;
  createdTime?: string;
}

// Upload a file to Google Drive
export async function uploadToDrive(
  file: File | Blob,
  filename: string,
  accessToken: string
): Promise<DriveFile> {
  try {
    console.log(`Uploading file to Drive: ${filename}`);
    
    if (!accessToken) {
      throw new Error("Not authenticated");
    }
    
    // Create metadata
    const metadata = {
      name: filename,
      mimeType: file.type,
    };
    
    // Create form data
    const formData = new FormData();
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    formData.append('file', file);
    
    // Make upload request
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Drive upload error: ${response.status}`, errorText);
      throw new Error(`Upload failed: ${response.status}`);
    }
    
    // Get upload result
    const data = await response.json();
    
    try {
      // Get web view link
      const fileResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${data.id}?fields=webViewLink`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      
      if (fileResponse.ok) {
        const linkData = await fileResponse.json();
        data.webViewLink = linkData.webViewLink;
      }
    } catch (error) {
      // Continue even if getting the link fails
      console.warn("Could not get web view link:", error);
    }
    
    return data;
  } catch (error) {
    console.error("Error uploading file to Drive:", error);
    throw error;
  }
}

// List image files from Google Drive
export async function listDriveImages(accessToken: string): Promise<DriveFile[]> {
  try {
    if (!accessToken) {
      throw new Error("Not authenticated");
    }
    
    // Query parameters
    const query = "mimeType contains 'image/'";
    const fields = "files(id,name,mimeType,thumbnailLink,webViewLink,createdTime)";
    const orderBy = "createdTime desc";
    
    // Make API request
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=${encodeURIComponent(orderBy)}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Drive list error: ${response.status}`, errorText);
      throw new Error(`List failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error("Error listing Drive files:", error);
    throw error;
  }
}
