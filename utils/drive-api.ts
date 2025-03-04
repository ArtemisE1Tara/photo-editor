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

// Upload a file to Google Drive
export const uploadFileToDrive = async (
  file: File | Blob, 
  filename: string
): Promise<DriveFile> => {
  try {
    console.log(`Uploading file to Drive: ${filename}`);
    
    // Get a valid token
    const accessToken = await getAccessToken();
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
    console.log("File uploaded successfully:", data);
    
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
    
    return data;
  } catch (error) {
    console.error("Error uploading file to Drive:", error);
    throw error;
  }
};

// List image files from Google Drive
export const listImageFiles = async (): Promise<DriveFile[]> => {
  try {
    console.log("Listing image files from Drive");
    
    // Get a valid token
    const accessToken = await getAccessToken();
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
    console.log(`Found ${data.files?.length || 0} files`);
    
    return data.files || [];
  } catch (error) {
    console.error("Error listing Drive files:", error);
    throw error;
  }
};

// Delete a file from Google Drive
export const deleteFile = async (fileId: string): Promise<void> => {
  try {
    console.log(`Deleting file with ID: ${fileId}`);
    
    // Get a valid token
    const accessToken = await getAccessToken();
    if (!accessToken) {
      throw new Error("Not authenticated");
    }
    
    // Make delete request
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Drive delete error: ${response.status}`, errorText);
      throw new Error(`Delete failed: ${response.status}`);
    }
    
    console.log("File deleted successfully");
  } catch (error) {
    console.error("Error deleting Drive file:", error);
    throw error;
  }
};
