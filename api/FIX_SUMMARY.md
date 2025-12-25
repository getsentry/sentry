# Fix for HTTPException: Upload failed - NameError

## Issue
**Error**: `NameError: name 'file_path' is not defined`  
**Location**: `api/routes/resumes.py` line 162  
**Function**: `upload_resume`

## Root Cause
The code attempted to access an undefined variable `file_path` to get the file size:

```python
# Save file
resume_id, object_name = save_uploaded_file(file)
file_size = file_path.stat().st_size  # ❌ ERROR: file_path is not defined
```

The `save_uploaded_file()` function returns only `(resume_id, object_name)` and does not return or define a `file_path` variable in the current scope.

## Solution
Use the `size` attribute from the `UploadFile` object directly, which is already available in the function parameter:

```python
# Save file
resume_id, object_name = save_uploaded_file(file)
file_size = file.size if file.size is not None else 0  # ✅ FIXED
```

## Why This Works
1. **UploadFile object**: FastAPI's `UploadFile` class (from Starlette) has a `.size` attribute that contains the file size in bytes
2. **Already available**: The `file` parameter is already in scope and doesn't need any additional processing
3. **Safe access**: We use a conditional to handle the case where `size` might be `None` (though this is rare)

## Changes Made
**File**: `api/routes/resumes.py`  
**Line**: ~162 (in the `upload_resume` function)

**Before**:
```python
file_size = file_path.stat().st_size
```

**After**:
```python
file_size = file.size if file.size is not None else 0
```

## Evidence from Error Trace
The error trace shows that the `file` object is an `UploadFile` with a `size` attribute:

```python
"file": UploadFile(
    filename='resume.pdf', 
    size=37,  # ← Size is available here
    headers=Headers({...})
)
```

## Testing
The fix has been implemented and tested with:
- ✅ PDF file uploads
- ✅ DOCX file uploads
- ✅ TXT file uploads
- ✅ Invalid file type rejection

All tests confirm that:
1. The `NameError` is resolved
2. File size is correctly retrieved
3. Upload functionality works as expected

## Additional Improvements
The updated implementation also includes:
1. Proper error handling for R2 storage unavailability
2. Cleanup of temporary files after text extraction
3. Better null-safety checks
