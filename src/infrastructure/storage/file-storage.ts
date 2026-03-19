/**
 * File Storage Infrastructure
 * Handles file uploads to Pruna's storage service
 */

import { httpClient } from "../api/http-client";
import { logger } from "../logging/pruna-logger";
import { PRUNA_FILES_URL, UPLOAD_CONFIG } from "../services/pruna-provider.constants";

export class FileStorageService {
  async uploadFile(
    base64Data: string,
    apiKey: string,
    sessionId: string
  ): Promise<string> {
    const log = logger;

    // Validation
    if (!base64Data?.trim()) {
      log.error(sessionId, 'file-storage', 'Empty file data');
      throw new Error("File data is empty. Provide a base64 string or URL.");
    }

    // Already a URL
    if (base64Data.startsWith('http')) {
      log.info(sessionId, 'file-storage', 'File already a URL', {
        url: base64Data.substring(0, 80) + '...',
      });
      return base64Data;
    }

    // Process base64
    const rawBase64 = this.extractBase64(base64Data);
    const dataUri = this.createDataUri(rawBase64);
    const formData = this.createFormData(dataUri);

    log.info(sessionId, 'file-storage', 'Uploading file', {
      size: Math.round(rawBase64.length / 1024) + 'KB',
    });

    try {
      const response = await httpClient.request<{ urls?: { get?: string }; id?: string }>(
        {
          url: PRUNA_FILES_URL,
          method: 'POST',
          headers: { apikey: apiKey },
          body: formData,
          timeout: UPLOAD_CONFIG.timeoutMs,
        },
        sessionId,
        'file-storage'
      );

      const fileUrl = response.data.urls?.get ||
                     (response.data.id ? `${PRUNA_FILES_URL}/${response.data.id}` : PRUNA_FILES_URL);

      log.info(sessionId, 'file-storage', 'Upload complete', {
        url: fileUrl.substring(0, 80) + '...',
      });

      return fileUrl;

    } catch (error) {
      log.error(sessionId, 'file-storage', 'Upload failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private extractBase64(data: string): string {
    const base64Index = data.indexOf('base64,');
    return base64Index !== -1 ? data.substring(base64Index + 7) : data;
  }

  private createDataUri(base64: string): string {
    return `data:image/jpeg;base64,${base64}`;
  }

  private createFormData(dataUri: string): FormData {
    const formData = new FormData();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const fileName = `vivoim_${timestamp}_${randomId}.jpg`;

    (formData as unknown as { append: (name: string, value: { uri: string; type: string; name: string }) => void })
      .append('content', {
        uri: dataUri,
        type: 'image/jpeg',
        name: fileName,
      });

    return formData;
  }
}

export const fileStorageService = new FileStorageService();
