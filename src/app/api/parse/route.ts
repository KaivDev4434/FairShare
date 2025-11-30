import { NextRequest, NextResponse } from 'next/server';
import { extractBillData, extractBillDataSimple, BillData } from '@/lib/llm';

const DOCLING_SERVICE_URL = process.env.DOCLING_SERVICE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload PDF, JPG, or PNG.' },
        { status: 400 }
      );
    }
    
    // Step 1: Parse document with Docling service
    const doclingFormData = new FormData();
    doclingFormData.append('file', file);
    
    let markdown: string;
    
    try {
      const parseResponse = await fetch(`${DOCLING_SERVICE_URL}/parse`, {
        method: 'POST',
        body: doclingFormData,
      });
      
      if (!parseResponse.ok) {
        throw new Error(`Docling service error: ${parseResponse.status}`);
      }
      
      const parseResult = await parseResponse.json();
      
      if (!parseResult.success || !parseResult.markdown) {
        throw new Error(parseResult.error || 'Failed to parse document');
      }
      
      markdown = parseResult.markdown;
    } catch (error) {
      console.error('Docling service unavailable:', error);
      return NextResponse.json(
        { 
          error: 'Document parsing service unavailable. Please ensure the Docling service is running.',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 503 }
      );
    }
    
    // Step 2: Extract structured data using LLM (Ollama → Perplexity fallback)
    let billData: BillData;
    
    try {
      billData = await extractBillData(markdown);
    } catch (error) {
      console.warn('LLM extraction failed, trying simple extraction:', error);
      // Fallback to simple pattern-based extraction
      billData = extractBillDataSimple(markdown);
      
      if (billData.items.length === 0) {
        return NextResponse.json(
          { 
            error: 'Could not extract items from document. The bill format may not be recognized.',
            markdown, // Return markdown so frontend can show manual entry
          },
          { status: 422 }
        );
      }
    }
    
    return NextResponse.json({
      success: true,
      data: billData,
      markdown, // Include for debugging/manual editing
    });
    
  } catch (error) {
    console.error('Parse API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

