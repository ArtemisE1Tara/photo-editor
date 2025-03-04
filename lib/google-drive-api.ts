// Helper functions for Google Drive API operations

/**
 * Uploads an image to Google Drive
 * @param imageData Base64 encoded image data
 * @param fileName Name of the file to save
 * @param accessToken Google OAuth access token
 * @returns Promise with the created file metadata
 */
export async function uploadImageToGoogleDrive(imageData: string, fileName: string, accessToken: string): Promise<any> {
  try {
    // Extract the base64 data (remove the data:image/jpeg;base64, part)
    const base64Data = imageData.split(",")[1]

    // Convert base64 to blob
    const byteCharacters = atob(base64Data)
    const byteArrays = []

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512)

      const byteNumbers = new Array(slice.length)
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i)
      }

      const byteArray = new Uint8Array(byteNumbers)
      byteArrays.push(byteArray)
    }

    const blob = new Blob(byteArrays, { type: "image/jpeg" })

    // Create form data for the request
    const metadata = {
      name: fileName,
      mimeType: "image/jpeg",
    }

    const form = new FormData()
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }))
    form.append("file", blob)

    // Upload to Google Drive
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    })

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error uploading to Google Drive:", error)
    throw error
  }
}

/**
 * Lists files from Google Drive
 * @param accessToken Google OAuth access token
 * @param query Optional search query
 * @returns Promise with the list of files
 */
export async function listFilesFromGoogleDrive(
  accessToken: string,
  query = "mimeType contains 'image/'",
): Promise<any[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      fields: "files(id, name, mimeType, thumbnailLink, webViewLink, createdTime)",
      orderBy: "createdTime desc",
    })

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`)
    }

    const data = await response.json()
    return data.files || []
  } catch (error) {
    console.error("Error listing files from Google Drive:", error)
    throw error
  }
}

/**
 * Gets a file from Google Drive
 * @param fileId ID of the file to get
 * @param accessToken Google OAuth access token
 * @returns Promise with the file data
 */
export async function getFileFromGoogleDrive(fileId: string, accessToken: string): Promise<any> {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get file: ${response.statusText}`)
    }

    return await response.blob()
  } catch (error) {
    console.error("Error getting file from Google Drive:", error)
    throw error
  }
}

/**
 * Deletes a file from Google Drive
 * @param fileId ID of the file to delete
 * @param accessToken Google OAuth access token
 * @returns Promise that resolves when the file is deleted
 */
export async function deleteFileFromGoogleDrive(fileId: string, accessToken: string): Promise<void> {
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`)
    }
  } catch (error) {
    console.error("Error deleting file from Google Drive:", error)
    throw error
  }
}

