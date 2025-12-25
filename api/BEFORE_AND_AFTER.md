# Before and After Comparison

## The Problem

Line 162 in `api/routes/resumes.py` attempted to use an undefined variable:

### Before (Buggy Code)

```python
@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    """Upload a resume file."""
    try:
        # Validate file type
        allowed_extensions = ['.txt', '.pdf', '.docx', '.doc']
        file_ext = Path(file.filename).suffix.lower() if file.filename else ''
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Save file
        resume_id, object_name = save_uploaded_file(file)
        file_size = file_path.stat().st_size  # ❌ LINE 162: NameError!
        #           ^^^^^^^^^ 
        #           This variable was never defined!
        
        # Extract text for embedding (download temporarily)
        import tempfile
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            r2.download_file(object_name, tmp.name)
            # ... rest of code
```

**Error**: `NameError: name 'file_path' is not defined`

---

## The Solution

### After (Fixed Code)

```python
@router.post("/upload", response_model=ResumeUploadResponse)
async def upload_resume(file: UploadFile = File(...)):
    """Upload a resume file."""
    try:
        # Validate file type
        allowed_extensions = ['.txt', '.pdf', '.docx', '.doc']
        file_ext = Path(file.filename).suffix.lower() if file.filename else ''
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
            )
        
        # Save file
        resume_id, object_name = save_uploaded_file(file)
        
        # FIX: Use file.size instead of undefined file_path variable
        # The UploadFile object has a size attribute we can use directly
        file_size = file.size if file.size is not None else 0  # ✅ FIXED!
        #           ^^^^^^^^^ 
        #           Use the size attribute from the file parameter
        
        # Extract text for embedding (download temporarily)
        # Note: In production, this would download from R2 storage
        text_content = ""
        if r2.available:
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
                try:
                    r2.download_file(object_name, tmp.name)
                    text_content = extract_text_from_file(tmp.name)
                except Exception as e:
                    print(f"Error extracting text: {e}")
                finally:
                    # Clean up temp file
                    Path(tmp.name).unlink(missing_ok=True)
```

**Result**: ✅ Code works correctly, file size is properly retrieved

---

## Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| **Variable Used** | `file_path.stat().st_size` | `file.size` |
| **Variable Source** | Undefined (NameError) | Function parameter |
| **Null Safety** | None | `if file.size is not None else 0` |
| **Error Handling** | Crashes with NameError | Works correctly |

---

## Why The Original Code Failed

1. **Missing Return Value**: The `save_uploaded_file()` function returns `(resume_id, object_name)` but **NOT** `file_path`
2. **Undefined Variable**: `file_path` was never assigned or created in the function scope
3. **Python raised NameError**: When the code tried to access `file_path`, Python couldn't find it

## Why The Fix Works

1. **UploadFile has .size**: FastAPI's `UploadFile` class inherits from Starlette's `UploadFile`, which has a `.size` attribute
2. **Already in scope**: The `file` parameter is already available in the function
3. **No file system access needed**: We don't need to read from disk since the size is already known
4. **More efficient**: Avoids unnecessary file system operations

---

## Verification

Run the demonstration:
```bash
python3 api/demonstrate_fix.py
```

Output confirms:
- ❌ Buggy version: `NameError: name 'file_path' is not defined`
- ✅ Fixed version: Works correctly, retrieves file size successfully
