# Changes Required to Support Flutter Mapping File Uploads

## Current State

Sentry already has internal support for Flutter/Dart deobfuscation:

- The `dart_symbols` file type is recognized in events (see `src/sentry/lang/dart/utils.py`)
- Flutter mapping files are expected to be JSON arrays with alternating deobfuscated/obfuscated names
- The deobfuscation logic exists and works for view hierarchies

However, there's no direct way to upload these files through the API.

## Required Changes

### Option 1: Extend Existing Debug Files Upload (Recommended)

1. **Add dart_symbols to KNOWN_DIF_FORMATS** in `src/sentry/constants.py`:

```python
KNOWN_DIF_FORMATS: dict[str, str] = {
    # ... existing formats ...
    "application/x-dart-symbols+json": "dart_symbols",
}
```

2. **Extend detect_dif_from_path** in `src/sentry/models/debugfile.py`:

```python
def detect_dif_from_path(path, name=None, debug_id=None, accept_unknown=False):
    # ... existing code ...

    # Add detection for dart_symbols files
    if path.endswith('.json') and 'dart' in (name or path).lower():
        if debug_id is None:
            # Try to extract from filename
            basename = os.path.basename(path)
            match = re.match(r'([a-fA-F0-9-]+)\.json', basename)
            if match:
                debug_id = normalize_debug_id(match.group(1))
            else:
                raise BadDif("Missing debug_id for dart_symbols")

        try:
            with open(path, 'rb') as fp:
                data = json.load(fp)
                # Validate it's a proper Flutter mapping file
                if not isinstance(data, list) or len(data) % 2 != 0:
                    raise BadDif("Invalid dart_symbols format")
        except json.JSONDecodeError as e:
            raise BadDif(f"Invalid dart_symbols: {e}")

        return [
            DifMeta(
                file_format="dart_symbols",
                arch="any",
                debug_id=debug_id,
                name=name,
                path=path,
                data={"features": ["mapping"]}
            )
        ]
```

3. **Update file extension handling** in `ProjectDebugFile.file_extension`:

```python
@property
def file_extension(self) -> str:
    # ... existing code ...
    if self.file_format == "dart_symbols":
        return ".json"
    # ... rest of code ...
```

### Option 2: Create a Dedicated Flutter Symbols Endpoint

Create a new endpoint specifically for Flutter symbols at `/api/0/projects/{org}/{project}/flutter-symbols/`:

```python
@region_silo_endpoint
class ProjectFlutterSymbolsEndpoint(ProjectEndpoint):
    permission_classes = (ProjectReleasePermission,)

    def post(self, request: Request, project: Project) -> Response:
        """Upload Flutter/Dart symbol mapping file"""

        debug_id = request.data.get('debug_id')
        if not debug_id:
            debug_id = str(uuid.uuid4())

        mapping = request.data.get('mapping')
        if not mapping or not isinstance(mapping, list) or len(mapping) % 2 != 0:
            return Response(
                {"error": "Invalid mapping format"},
                status=400
            )

        # Create the file
        file_content = json.dumps(mapping).encode('utf-8')
        checksum = hashlib.sha1(file_content).hexdigest()

        # Store as a File
        file = File.objects.create(
            name=f"dart_symbols/{debug_id}.json",
            type="project.dart_symbols",
            checksum=checksum,
            size=len(file_content),
            headers={"Content-Type": "application/x-dart-symbols+json"}
        )
        file.putfile(BytesIO(file_content))

        # Create ProjectDebugFile entry
        debug_file = ProjectDebugFile.objects.create(
            file=file,
            debug_id=debug_id,
            project_id=project.id,
            checksum=checksum,
            object_name="flutter_mapping",
            cpu_name="any",
            data={
                "type": "dart_symbols",
                "features": ["mapping"]
            }
        )

        return Response(serialize(debug_file, request.user), status=201)
```

## Testing the Upload

Once the changes are implemented, you can test uploading a Flutter mapping file:

### Using the Debug Files Endpoint (Option 1):

```bash
# Create a Flutter mapping file
echo '["MaterialApp", "ax", "Scaffold", "ay", "Container", "az"]' > flutter_mapping.json

# Create a zip file
zip flutter_symbols.zip flutter_mapping.json

# Upload it
curl -X POST "https://sentry.io/api/0/projects/ORG/PROJECT/files/dsyms/" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -F "file=@flutter_symbols.zip"
```

### Using a Dedicated Endpoint (Option 2):

```bash
curl -X POST "https://sentry.io/api/0/projects/ORG/PROJECT/flutter-symbols/" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "debug_id": "12345678-1234-1234-1234-123456789012",
       "mapping": ["MaterialApp", "ax", "Scaffold", "ay", "Container", "az"]
     }'
```

## Event Association

For the uploaded symbols to be used, events need to include the debug_id in their debug_meta:

```json
{
  "debug_meta": {
    "images": [
      {
        "type": "dart_symbols",
        "uuid": "12345678-1234-1234-1234-123456789012"
      }
    ]
  }
}
```

## Summary

While Sentry has the infrastructure to use Flutter mapping files for deobfuscation, it currently lacks a proper upload mechanism. The recommended approach is to extend the existing debug files upload system to recognize dart_symbols files, as this maintains consistency with other debug file types and reuses existing infrastructure.
