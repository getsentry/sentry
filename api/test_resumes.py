"""
Tests for resume upload functionality.
"""
import io
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from api.routes.resumes import router


# Create test app
app = FastAPI()
app.include_router(router, prefix="/api/v1/resumes")

client = TestClient(app)


def test_upload_resume_pdf():
    """Test uploading a PDF resume successfully."""
    # Create a mock PDF file
    pdf_content = b"%PDF-1.4 mock pdf content"
    files = {
        "file": ("resume.pdf", io.BytesIO(pdf_content), "application/pdf")
    }
    
    response = client.post("/api/v1/resumes/upload", files=files)
    
    assert response.status_code == 200
    data = response.json()
    assert "resume_id" in data
    assert "file_size" in data
    assert data["file_size"] >= 0  # Should have a valid file size
    assert "uploaded_at" in data
    assert "message" in data


def test_upload_resume_invalid_type():
    """Test uploading an invalid file type returns 400."""
    # Create a mock file with invalid extension
    file_content = b"some content"
    files = {
        "file": ("resume.exe", io.BytesIO(file_content), "application/octet-stream")
    }
    
    response = client.post("/api/v1/resumes/upload", files=files)
    
    assert response.status_code == 400
    data = response.json()
    assert "Invalid file type" in data["detail"]


def test_upload_resume_docx():
    """Test uploading a DOCX resume successfully."""
    # Create a mock DOCX file
    docx_content = b"PK mock docx content"
    files = {
        "file": ("resume.docx", io.BytesIO(docx_content), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    }
    
    response = client.post("/api/v1/resumes/upload", files=files)
    
    assert response.status_code == 200
    data = response.json()
    assert "resume_id" in data
    assert "file_size" in data
    assert data["file_size"] >= 0


def test_upload_resume_txt():
    """Test uploading a TXT resume successfully."""
    # Create a mock TXT file
    txt_content = b"Plain text resume content"
    files = {
        "file": ("resume.txt", io.BytesIO(txt_content), "text/plain")
    }
    
    response = client.post("/api/v1/resumes/upload", files=files)
    
    assert response.status_code == 200
    data = response.json()
    assert "resume_id" in data
    assert "file_size" in data
    assert data["file_size"] == len(txt_content)


def test_parse_resume():
    """Test parsing resume text."""
    request_data = {
        "text": "Sample resume text for parsing"
    }
    
    response = client.post("/api/v1/resumes/parse", json=request_data)
    
    assert response.status_code == 200
    data = response.json()
    assert "parsed_data" in data


def test_list_resumes():
    """Test listing resumes."""
    response = client.get("/api/v1/resumes/")
    
    assert response.status_code == 200
    data = response.json()
    assert "resumes" in data


if __name__ == "__main__":
    # Run a quick smoke test
    print("Running smoke tests...")
    test_upload_resume_pdf()
    print("✓ PDF upload test passed")
    test_upload_resume_invalid_type()
    print("✓ Invalid type test passed")
    test_upload_resume_txt()
    print("✓ TXT upload test passed")
    print("\nAll tests passed! The fix is working correctly.")
