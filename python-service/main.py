"""
FairShare Document Parsing Service
Uses Docling to extract text and tables from PDFs and images.
"""

import io
import tempfile
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Docling imports
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import PdfFormatOption, ImageFormatOption

app = FastAPI(
    title="FairShare Document Parser",
    description="Extract text and tables from bills and invoices",
    version="1.0.0"
)

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ParseResponse(BaseModel):
    """Response model for document parsing"""
    success: bool
    markdown: Optional[str] = None
    error: Optional[str] = None


# Initialize the document converter with optimized settings for invoices
def get_converter():
    """Create a configured document converter"""
    # PDF pipeline options
    pdf_pipeline_options = PdfPipelineOptions()
    pdf_pipeline_options.do_ocr = True  # Enable OCR for scanned documents
    pdf_pipeline_options.do_table_structure = True  # Important for invoice tables
    
    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_pipeline_options),
            InputFormat.IMAGE: ImageFormatOption(),  # Enable image processing
        }
    )
    return converter


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "healthy", "service": "FairShare Document Parser"}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok"}


@app.post("/parse", response_model=ParseResponse)
async def parse_document(file: UploadFile = File(...)):
    """
    Parse a document (PDF or image) and extract text/tables as Markdown.
    
    Supported formats:
    - PDF (including scanned PDFs with OCR)
    - Images: JPG, JPEG, PNG
    
    Returns:
    - markdown: Extracted content in Markdown format with tables preserved
    """
    
    # Validate file type
    allowed_types = {
        "application/pdf": ".pdf",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg", 
        "image/png": ".png",
    }
    
    content_type = file.content_type or ""
    if content_type not in allowed_types:
        # Try to infer from filename
        filename = file.filename or ""
        ext = Path(filename).suffix.lower()
        if ext not in [".pdf", ".jpg", ".jpeg", ".png"]:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {content_type}. Supported: PDF, JPG, PNG"
            )
    
    try:
        # Read file content
        content = await file.read()
        
        # Create a temporary file (Docling needs a file path)
        suffix = allowed_types.get(content_type, Path(file.filename or "").suffix or ".pdf")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            # Initialize converter and process document
            converter = get_converter()
            result = converter.convert(tmp_path)
            
            # Export to Markdown (preserves table structure)
            markdown_content = result.document.export_to_markdown()
            
            return ParseResponse(
                success=True,
                markdown=markdown_content
            )
            
        finally:
            # Clean up temp file
            os.unlink(tmp_path)
            
    except Exception as e:
        return ParseResponse(
            success=False,
            error=f"Failed to parse document: {str(e)}"
        )


@app.post("/parse-base64", response_model=ParseResponse)
async def parse_document_base64(data: dict):
    """
    Parse a document from base64 encoded data.
    
    Expected payload:
    {
        "content": "base64-encoded-content",
        "filename": "invoice.pdf"
    }
    """
    import base64
    
    try:
        content_b64 = data.get("content", "")
        filename = data.get("filename", "document.pdf")
        
        # Decode base64 content
        content = base64.b64decode(content_b64)
        
        # Determine file extension
        ext = Path(filename).suffix.lower() or ".pdf"
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
            tmp_file.write(content)
            tmp_path = tmp_file.name
        
        try:
            converter = get_converter()
            result = converter.convert(tmp_path)
            markdown_content = result.document.export_to_markdown()
            
            return ParseResponse(
                success=True,
                markdown=markdown_content
            )
            
        finally:
            os.unlink(tmp_path)
            
    except Exception as e:
        return ParseResponse(
            success=False,
            error=f"Failed to parse document: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

