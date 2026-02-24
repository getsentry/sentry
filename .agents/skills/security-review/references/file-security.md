# File Security Reference

## Overview

File operations present multiple security risks: path traversal attacks, malicious file uploads, XML External Entity (XXE) attacks, and insecure file permissions. This reference covers secure patterns for handling files.

---

## Path Traversal Prevention

### The Vulnerability

```python
# VULNERABLE: User-controlled path
@app.route('/download')
def download():
    filename = request.args.get('file')
    return send_file(f'/uploads/{filename}')

# Attack: ?file=../../../etc/passwd
# Results in: /uploads/../../../etc/passwd → /etc/passwd
```

### Prevention Techniques

```python
import os
from pathlib import Path

# Method 1: Validate and canonicalize path
def safe_join(base_directory, user_path):
    """Safely join paths, preventing traversal."""
    # Resolve to absolute path
    base = Path(base_directory).resolve()
    target = (base / user_path).resolve()

    # Verify target is under base
    if not str(target).startswith(str(base)):
        raise ValueError("Path traversal detected")

    return str(target)

# Method 2: Use allowlist of files
ALLOWED_FILES = {'report.pdf', 'manual.pdf', 'readme.txt'}

def download_file(filename):
    if filename not in ALLOWED_FILES:
        raise ValueError("File not allowed")
    return send_file(os.path.join(UPLOAD_DIR, filename))

# Method 3: Use indirect references
def get_file_by_id(file_id):
    # Map ID to filename in database
    file_record = File.query.get(file_id)
    if not file_record or file_record.user_id != current_user.id:
        raise PermissionError()
    return send_file(file_record.storage_path)
```

### Characters to Block

```python
# Dangerous path patterns
BLOCKED_PATTERNS = [
    '..',           # Parent directory
    '~',            # Home directory
    '%2e%2e',       # URL-encoded ..
    '%252e%252e',   # Double-encoded ..
    '..\\',         # Windows backslash
    '..%5c',        # URL-encoded Windows
    '%00',          # Null byte (older systems)
]

def contains_traversal(path):
    path_lower = path.lower()
    return any(pattern in path_lower for pattern in BLOCKED_PATTERNS)
```

---

## File Upload Security

### Defense in Depth Approach

```python
import magic
import hashlib
import uuid
from pathlib import Path

# Configuration
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif'}
ALLOWED_MIMETYPES = {
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif'
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
UPLOAD_DIR = '/var/uploads'  # Outside webroot

def secure_upload(file):
    """Comprehensive file upload validation."""

    # 1. Check file size
    file.seek(0, 2)  # Seek to end
    size = file.tell()
    file.seek(0)  # Reset
    if size > MAX_FILE_SIZE:
        raise ValueError(f"File too large: {size} bytes")

    # 2. Validate extension
    original_filename = file.filename
    extension = Path(original_filename).suffix.lower().lstrip('.')
    if extension not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Extension not allowed: {extension}")

    # 3. Validate MIME type (don't trust Content-Type header)
    mime = magic.from_buffer(file.read(2048), mime=True)
    file.seek(0)
    if mime not in ALLOWED_MIMETYPES:
        raise ValueError(f"MIME type not allowed: {mime}")

    # 4. Validate extension matches content
    expected_extensions = get_extensions_for_mime(mime)
    if extension not in expected_extensions:
        raise ValueError("Extension doesn't match content type")

    # 5. Generate safe filename (ignore user input)
    safe_filename = f"{uuid.uuid4().hex}.{extension}"

    # 6. Store outside webroot
    storage_path = os.path.join(UPLOAD_DIR, safe_filename)
    file.save(storage_path)

    # 7. Set restrictive permissions
    os.chmod(storage_path, 0o640)

    return {
        'original_name': original_filename,
        'stored_name': safe_filename,
        'storage_path': storage_path,
        'size': size,
        'mime_type': mime
    }
```

### Filename Sanitization

```python
import re
import unicodedata

def sanitize_filename(filename):
    """Sanitize filename for safe storage."""
    # Normalize unicode
    filename = unicodedata.normalize('NFKD', filename)

    # Remove path components
    filename = os.path.basename(filename)

    # Remove null bytes
    filename = filename.replace('\x00', '')

    # Allow only safe characters
    filename = re.sub(r'[^a-zA-Z0-9._-]', '_', filename)

    # Prevent hidden files
    filename = filename.lstrip('.')

    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255-len(ext)] + ext

    return filename or 'unnamed'
```

### Image Validation

```python
from PIL import Image
import io

def validate_image(file_data):
    """Validate and reprocess image to strip metadata/payloads."""
    try:
        # Verify it's a valid image
        img = Image.open(io.BytesIO(file_data))
        img.verify()

        # Reopen for processing (verify closes the file)
        img = Image.open(io.BytesIO(file_data))

        # Convert to remove potential embedded content
        output = io.BytesIO()
        img.save(output, format=img.format)
        output.seek(0)

        return output.read()

    except Exception as e:
        raise ValueError(f"Invalid image: {e}")
```

### Dangerous File Types

```python
# Never allow execution
DANGEROUS_EXTENSIONS = {
    # Executables
    'exe', 'dll', 'so', 'dylib', 'bin',
    # Scripts
    'php', 'php3', 'php4', 'php5', 'phtml',
    'asp', 'aspx', 'ascx', 'ashx',
    'jsp', 'jspx',
    'cgi', 'pl', 'py', 'rb', 'sh', 'bash',
    # Server config
    'htaccess', 'htpasswd',
    'config', 'ini',
    # HTML (XSS risk)
    'html', 'htm', 'xhtml', 'svg',
    # Office macros
    'docm', 'xlsm', 'pptm',
}

# Dangerous MIME types
DANGEROUS_MIMETYPES = {
    'application/x-executable',
    'application/x-msdownload',
    'application/x-php',
    'text/html',
    'image/svg+xml',  # Can contain scripts
}
```

---

## XML External Entity (XXE) Prevention

### The Vulnerability

```xml
<!-- Malicious XML -->
<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<data>&xxe;</data>
```

### Python Prevention

```python
# VULNERABLE: Default lxml settings
from lxml import etree
doc = etree.parse(untrusted_file)  # XXE enabled by default

# SAFE: Disable external entities
from lxml import etree
parser = etree.XMLParser(
    resolve_entities=False,
    no_network=True,
    dtd_validation=False,
    load_dtd=False
)
doc = etree.parse(untrusted_file, parser)

# SAFE: defusedxml library (recommended)
import defusedxml.ElementTree as ET
doc = ET.parse(untrusted_file)  # XXE disabled by default
```

### Java Prevention

```java
// VULNERABLE: Default DocumentBuilder
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
DocumentBuilder db = dbf.newDocumentBuilder();
Document doc = db.parse(untrustedFile);

// SAFE: Disable dangerous features
DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
dbf.setFeature("http://xml.org/sax/features/external-general-entities", false);
dbf.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
dbf.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false);
dbf.setXIncludeAware(false);
dbf.setExpandEntityReferences(false);
DocumentBuilder db = dbf.newDocumentBuilder();
```

### .NET Prevention

```csharp
// SAFE in .NET 4.5.2+: XmlReader is safe by default
XmlReader reader = XmlReader.Create(stream);

// For older versions, explicitly disable
XmlReaderSettings settings = new XmlReaderSettings();
settings.DtdProcessing = DtdProcessing.Prohibit;
settings.XmlResolver = null;
XmlReader reader = XmlReader.Create(stream, settings);
```

---

## Archive (ZIP) Handling

### Zip Slip Prevention

```python
import zipfile
import os

def safe_extract(zip_path, extract_dir):
    """Safely extract ZIP, preventing path traversal."""
    extract_dir = os.path.abspath(extract_dir)

    with zipfile.ZipFile(zip_path, 'r') as zf:
        for member in zf.namelist():
            # Get absolute path of extracted file
            member_path = os.path.abspath(os.path.join(extract_dir, member))

            # Verify it's under extract directory
            if not member_path.startswith(extract_dir + os.sep):
                raise ValueError(f"Path traversal in ZIP: {member}")

            # Check for symlinks (additional safety)
            if member.endswith('/'):
                os.makedirs(member_path, exist_ok=True)
            else:
                os.makedirs(os.path.dirname(member_path), exist_ok=True)
                with zf.open(member) as source, open(member_path, 'wb') as target:
                    target.write(source.read())
```

### Zip Bomb Prevention

```python
MAX_UNCOMPRESSED_SIZE = 100 * 1024 * 1024  # 100MB
MAX_COMPRESSION_RATIO = 100

def check_zip_bomb(zip_path):
    """Detect potential zip bombs."""
    compressed_size = os.path.getsize(zip_path)

    with zipfile.ZipFile(zip_path, 'r') as zf:
        uncompressed_size = sum(info.file_size for info in zf.infolist())

        # Check total size
        if uncompressed_size > MAX_UNCOMPRESSED_SIZE:
            raise ValueError(f"Uncompressed size too large: {uncompressed_size}")

        # Check compression ratio
        if compressed_size > 0:
            ratio = uncompressed_size / compressed_size
            if ratio > MAX_COMPRESSION_RATIO:
                raise ValueError(f"Suspicious compression ratio: {ratio}")

    return True
```

---

## File Permissions

### Secure Defaults

```python
import os
import stat

# Uploaded files: readable by app, not executable
def secure_file_permissions(path):
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IRGRP)  # 640

# Directories: accessible by app
def secure_directory_permissions(path):
    os.chmod(path, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP)  # 750

# Sensitive files: only owner
def sensitive_file_permissions(path):
    os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)  # 600
```

### Temporary Files

```python
import tempfile
import os

# VULNERABLE: Predictable temp file
with open('/tmp/myapp_temp.txt', 'w') as f:
    f.write(sensitive_data)

# SAFE: Secure temp file
with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
    f.write(sensitive_data)
    temp_path = f.name
    # File has restrictive permissions automatically

# SAFE: Temp directory
with tempfile.TemporaryDirectory() as tmpdir:
    # Directory and contents deleted on exit
    pass
```

---

## Grep Patterns for Detection

```bash
# Path traversal risks
grep -rn "open(.*request\|send_file(.*request" --include="*.py"
grep -rn "fs\.readFile.*req\|fs\.writeFile.*req" --include="*.js"

# Dangerous file operations
grep -rn "os\.system.*file\|subprocess.*file" --include="*.py"

# XML parsing (XXE risk)
grep -rn "etree\.parse\|xml\.parse\|DOM\.parse" --include="*.py" --include="*.java"
grep -rn "XMLReader\|DocumentBuilder" --include="*.java"

# ZIP handling
grep -rn "zipfile\|ZipFile\|extractall" --include="*.py" --include="*.java"

# File permissions
grep -rn "chmod 777\|chmod 666\|chmod 755" --include="*.py" --include="*.sh"
```

---

## Testing Checklist

- [ ] Path traversal prevented (canonicalization + validation)
- [ ] File extensions validated against allowlist
- [ ] MIME types validated (not just Content-Type header)
- [ ] Filenames sanitized (don't use user input directly)
- [ ] Files stored outside webroot
- [ ] Restrictive file permissions set
- [ ] Upload size limits enforced
- [ ] Dangerous file types blocked
- [ ] XML parsing has XXE disabled
- [ ] ZIP extraction validates paths
- [ ] ZIP bomb detection in place
- [ ] Temporary files handled securely

---

## References

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [OWASP XXE Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html)
- [CWE-22: Path Traversal](https://cwe.mitre.org/data/definitions/22.html)
- [CWE-434: Unrestricted File Upload](https://cwe.mitre.org/data/definitions/434.html)
- [CWE-611: XXE](https://cwe.mitre.org/data/definitions/611.html)
