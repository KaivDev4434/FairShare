/**
 * Docling Service Client
 * Communicates with the Python Docling microservice for document parsing
 */

const DOCLING_SERVICE_URL = process.env.DOCLING_SERVICE_URL || 'http://localhost:8000';

export interface ParseResult {
  success: boolean;
  markdown?: string;
  error?: string;
}

/**
 * Parse a document file (PDF/image) through the Docling service
 */
export async function parseDocument(file: File): Promise<ParseResult> {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch(`${DOCLING_SERVICE_URL}/parse`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `Service error: ${response.status} ${response.statusText}`,
      };
    }
    
    const result = await response.json();
    return result as ParseResult;
    
  } catch (error) {
    console.error('Docling service error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to document parsing service',
    };
  }
}

/**
 * Parse a document from base64 encoded content
 */
export async function parseDocumentBase64(content: string, filename: string): Promise<ParseResult> {
  try {
    const response = await fetch(`${DOCLING_SERVICE_URL}/parse-base64`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content, filename }),
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `Service error: ${response.status} ${response.statusText}`,
      };
    }
    
    const result = await response.json();
    return result as ParseResult;
    
  } catch (error) {
    console.error('Docling service error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect to document parsing service',
    };
  }
}

/**
 * Check if the Docling service is healthy
 */
export async function checkDoclingHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${DOCLING_SERVICE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

