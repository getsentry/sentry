#!/usr/bin/env python3
"""
Demonstration of the fix for the NameError issue.

This script shows why the original code failed and how the fix resolves it.
"""


class MockUploadFile:
    """Mock UploadFile class to simulate FastAPI's UploadFile."""
    
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self.content = content
        self.size = len(content)  # UploadFile has a size attribute
        
    def __repr__(self):
        return f"UploadFile(filename='{self.filename}', size={self.size})"


def save_uploaded_file(file: MockUploadFile) -> tuple:
    """
    Simulates the save_uploaded_file function.
    Returns (resume_id, object_name) but NOT file_path.
    """
    import uuid
    from pathlib import Path
    
    resume_id = str(uuid.uuid4())
    file_ext = Path(file.filename).suffix
    object_name = f"resumes/{resume_id}{file_ext}"
    
    # Note: This function does NOT return file_path
    return resume_id, object_name


def buggy_version(file: MockUploadFile):
    """Original buggy version that causes NameError."""
    print("=" * 60)
    print("BUGGY VERSION (Original Code)")
    print("=" * 60)
    
    try:
        # Save file
        resume_id, object_name = save_uploaded_file(file)
        print(f"✓ File saved: {object_name}")
        
        # This line causes NameError because file_path is not defined
        file_size = file_path.stat().st_size  # ❌ ERROR!
        print(f"File size: {file_size}")
        
    except NameError as e:
        print(f"❌ ERROR: {e}")
        print("   → 'file_path' was never defined!")
        return False
    
    return True


def fixed_version(file: MockUploadFile):
    """Fixed version that uses file.size."""
    print("\n" + "=" * 60)
    print("FIXED VERSION (New Code)")
    print("=" * 60)
    
    try:
        # Save file
        resume_id, object_name = save_uploaded_file(file)
        print(f"✓ File saved: {object_name}")
        
        # Use file.size instead of undefined file_path
        file_size = file.size if file.size is not None else 0  # ✅ WORKS!
        print(f"✓ File size: {file_size} bytes")
        print(f"✓ Resume ID: {resume_id}")
        
        return True
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        return False


def main():
    """Run demonstration of both versions."""
    print("\n" + "=" * 60)
    print("DEMONSTRATION: NameError Fix")
    print("=" * 60)
    print("\nSimulating upload of 'resume.pdf' with 1024 bytes")
    
    # Create a mock file upload
    mock_file = MockUploadFile(
        filename="resume.pdf",
        content=b"X" * 1024  # 1024 bytes of data
    )
    
    print(f"\nFile object: {mock_file}")
    print(f"File has .size attribute: {hasattr(mock_file, 'size')}")
    print(f"File size value: {mock_file.size}")
    
    # Show the buggy version
    buggy_result = buggy_version(mock_file)
    
    # Show the fixed version
    fixed_result = fixed_version(mock_file)
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Buggy version passed: {buggy_result} ❌")
    print(f"Fixed version passed: {fixed_result} ✅")
    print("\nThe fix successfully resolves the NameError by using")
    print("the file.size attribute instead of the undefined file_path.")
    print("=" * 60)


if __name__ == "__main__":
    main()
