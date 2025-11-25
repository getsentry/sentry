#!/usr/bin/env bash
# Script to build and publish the gRPC protobuf package

set -e

# Configuration
PACKAGE_NAME="sentry-grpc-protos"
VERSION="${1:-0.1.0}"
BUILD_DIR="build/grpc-protos"
DIST_DIR="dist"

echo "Building gRPC protobuf package version ${VERSION}..."

# Clean previous builds
rm -rf ${BUILD_DIR} ${DIST_DIR}
mkdir -p ${BUILD_DIR}

# Copy only generated protobuf files
echo "Copying generated protobuf files..."
mkdir -p ${BUILD_DIR}/sentry_grpc_protos
cp -r src/sentry/integrations/grpc/generated/*.py ${BUILD_DIR}/sentry_grpc_protos/
cp -r src/sentry/integrations/grpc/generated/*.pyi ${BUILD_DIR}/sentry_grpc_protos/ 2>/dev/null || true

# Remove any __pycache__ directories
find ${BUILD_DIR} -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

# Create __init__.py
cat > ${BUILD_DIR}/sentry_grpc_protos/__init__.py << 'EOF'
"""
Sentry gRPC Protocol Buffer definitions.

This package contains the generated protobuf code for Sentry's gRPC services and includes
a client helper function (`grpc_channel`) for easy client creation with authentication support.

Example usage:
    from sentry_integrations_client import grpc_channel, scm_pb2, scm_pb2_grpc

    # Create gRPC channel with authentication
    channel = grpc_channel(
        base_url="http://localhost:8000",
        auth_token="your-token"
    )

    # Create service stub
    stub = scm_pb2_grpc.ScmServiceStub(channel)

    # Make a request
    request = scm_pb2.GetRepositoriesRequest(organization_id=1)
    response = stub.GetRepositories(request)
"""

__version__ = "VERSION_PLACEHOLDER"

# Re-export the main modules for convenience
from . import scm_pb2, scm_pb2_grpc

__all__ = ["scm_pb2", "scm_pb2_grpc"]
EOF

# Replace version placeholder
sed -i '' "s/VERSION_PLACEHOLDER/${VERSION}/g" ${BUILD_DIR}/sentry_grpc_protos/__init__.py

# Create setup.py
cat > ${BUILD_DIR}/setup.py << EOF
from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="${PACKAGE_NAME}",
    version="${VERSION}",
    author="Sentry",
    author_email="engineering@sentry.io",
    description="Protocol buffer definitions for Sentry gRPC services",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/getsentry/sentry",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "License :: OSI Approved :: Apache Software License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.8",
    install_requires=[
        "grpcio>=1.48.0",
        "protobuf>=3.20.0",
    ],
    extras_require={
        "client": [
            "sonora>=0.1.0",  # For creating gRPC-Web clients
        ],
        "dev": [
            "grpcio-tools>=1.48.0",
            "mypy-protobuf>=3.0.0",
        ]
    }
)
EOF

# Create README.md
cat > ${BUILD_DIR}/README.md << 'EOF'
# Sentry gRPC Protocol Buffers

This package contains the generated Protocol Buffer definitions for Sentry's gRPC services.

## Installation

```bash
pip install sentry-grpc-protos

# To install with client support (includes Sonora)
pip install sentry-grpc-protos[client]
```

## What's Included

This package contains **only** the generated protobuf code:
- `scm_pb2.py` - Message definitions
- `scm_pb2_grpc.py` - Service stubs
- Type hints (`.pyi` files) for better IDE support

## Creating a Client

This package includes a client helper function `grpc_channel` that simplifies creating gRPC-Web clients with authentication support.

### Basic Usage

```python
from sentry_integrations_client import grpc_channel, scm_pb2, scm_pb2_grpc

# Create gRPC channel with authentication
channel = grpc_channel(
    base_url="http://localhost:8000",
    auth_token="your-auth-token"
)

# Create service stub
stub = scm_pb2_grpc.ScmServiceStub(channel)

# Make requests
request = scm_pb2.GetRepositoriesRequest(
    organization_id=123,
    page_size=10
)
response = stub.GetRepositories(request)

for repo in response.repositories:
    print(f"Repository: {repo.name}")
```

### Authentication

The Sentry gRPC service supports two authentication methods:

1. **Token Authentication**
   ```python
   channel = grpc_channel(
       base_url="http://localhost:8000",
       auth_token="your-token"
   )
   ```

2. **HMAC Signature** (for service-to-service)
   ```python
   channel = grpc_channel(
       base_url="http://localhost:8000",
       hmac_secret="your-secret"
   )
   ```

   The HMAC signature is automatically generated and included in each request.

### Advanced Example with Error Handling

```python
from sentry_integrations_client import grpc_channel, scm_pb2, scm_pb2_grpc
import grpc

# Create gRPC channel with authentication
channel = grpc_channel(
    base_url="http://sentry.example.com",
    auth_token="token",
    verify_ssl=False  # Set to True in production
)

# Create service stub
stub = scm_pb2_grpc.ScmServiceStub(channel)

try:
    # List repositories
    request = scm_pb2.GetRepositoriesRequest(
        organization_id=123,
        provider=scm_pb2.PROVIDER_GITHUB,
        query="django"
    )
    response = stub.GetRepositories(request, timeout=30)

    for repo in response.repositories:
        print(f"Found: {repo.name} ({repo.url})")

except grpc.RpcError as e:
    print(f"gRPC error: {e.code()} - {e.details()}")
except Exception as e:
    print(f"Unexpected error: {e}")
```

### Using with Async (Advanced)

For async operations, you can use Sonora's async transport directly:

```python
from sonora.client import Client, HttpxTransport
from sentry_integrations_client import scm_pb2, scm_pb2_grpc
import httpx
import asyncio

async def list_repos():
    async with httpx.AsyncClient() as http_client:
        transport = HttpxTransport(
            client=http_client,
            base_url="http://localhost:8000",
            headers={"X-Grpc-Auth-Token": "token"}
        )

        client = Client(
            service_stub=scm_pb2_grpc.ScmServiceStub,
            transport=transport
        )

        request = scm_pb2.GetRepositoriesRequest(organization_id=123)
        response = await client.GetRepositories(request)
        return response

# Run async
repos = asyncio.run(list_repos())
```

## Available Services

### ScmService

The SCM (Source Code Management) service provides operations for:

- **Repository Operations**
  - `GetRepositories` - List repositories for an organization
  - `CheckFile` - Check if a file exists in a repository
  - `GetStacktraceLink` - Get a link to source code for stack traces
  - `GetCodeownerFile` - Retrieve CODEOWNERS file content

- **Issue Operations**
  - `CreateIssue` - Create an external issue
  - `GetIssue` - Get issue details
  - `SearchIssues` - Search for issues
  - `GetIssueUrl` - Get the URL for an issue

- **Commit Operations**
  - `GetBlameForFiles` - Get blame information for files
  - `GetCommitContextAllFrames` - Get commit context for stack frames

- **Repository Trees**
  - `GetTreesForOrg` - Get repository file trees
  - `GetCachedRepoFiles` - Get cached file listings

## Message Types

The protocol buffer definitions include:

- `Repository` - Repository information
- `Commit` - Commit details
- `ExternalIssue` - External issue tracker issues
- `CodeMapping` - Mappings between stack traces and source code
- Various request/response messages for each RPC method

## Development

### Regenerating Protocol Buffers

If you need to regenerate the protobuf files from `.proto` definitions:

```bash
pip install grpcio-tools mypy-protobuf

python -m grpc_tools.protoc \
    -I protos/ \
    --python_out=. \
    --grpc_python_out=. \
    --mypy_out=. \
    protos/scm.proto
```

## Client Implementation

This package includes a `grpc_channel` helper function built on top of [Sonora](https://github.com/public/sonora), a Python library that provides gRPC-Web client functionality. Sonora offers:

- Simple, Pythonic API
- Support for both sync (requests) and async (httpx) transports
- Automatic message serialization/deserialization
- Proper error handling with gRPC status codes
- No need for a gRPC proxy - works directly with gRPC-Web servers

## Requirements

- Python 3.8+
- grpcio >= 1.48.0
- protobuf >= 3.20.0
- sonora >= 0.1.0 (for client functionality)

## License

Apache License 2.0

## Support

For issues related to:
- Protocol buffer definitions: [Create an issue](https://github.com/getsentry/sentry/issues)
- Client implementation: The `grpc_channel` helper is included in this package. For advanced usage, see [Sonora documentation](https://github.com/public/sonora)
EOF

# Create pyproject.toml for modern Python packaging
cat > ${BUILD_DIR}/pyproject.toml << EOF
[build-system]
requires = ["setuptools>=45", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "${PACKAGE_NAME}"
version = "${VERSION}"
description = "Protocol buffer definitions for Sentry gRPC services"
readme = "README.md"
authors = [
    {name = "Sentry", email = "engineering@sentry.io"},
]
license = {text = "Apache-2.0"}
classifiers = [
    "Development Status :: 4 - Beta",
    "Intended Audience :: Developers",
    "License :: OSI Approved :: Apache Software License",
    "Programming Language :: Python :: 3",
    "Programming Language :: Python :: 3.8",
    "Programming Language :: Python :: 3.9",
    "Programming Language :: Python :: 3.10",
    "Programming Language :: Python :: 3.11",
    "Programming Language :: Python :: 3.12",
]
requires-python = ">=3.8"
dependencies = [
    "grpcio>=1.48.0",
    "protobuf>=3.20.0",
]

[project.optional-dependencies]
client = [
    "sonora>=0.1.0",
]
dev = [
    "grpcio-tools>=1.48.0",
    "mypy-protobuf>=3.0.0",
]

[project.urls]
"Homepage" = "https://github.com/getsentry/sentry"
"Bug Reports" = "https://github.com/getsentry/sentry/issues"
"Source" = "https://github.com/getsentry/sentry"

[tool.setuptools.packages.find]
where = ["."]
include = ["sentry_grpc_protos*"]
EOF

# Build the package
echo "Building package..."
cd ${BUILD_DIR}
python -m build

# Move artifacts to dist directory
cd ../..
mkdir -p ${DIST_DIR}
mv ${BUILD_DIR}/dist/* ${DIST_DIR}/

echo "Package built successfully!"
echo "Artifacts in ${DIST_DIR}:"
ls -la ${DIST_DIR}/

echo ""
echo "To publish to PyPI:"
echo "  python -m twine upload ${DIST_DIR}/*"
echo ""
echo "To publish to internal repository:"
echo "  python -m twine upload --repository-url <internal-pypi-url> ${DIST_DIR}/*"
echo ""
echo "To install locally for testing:"
echo "  pip install ${DIST_DIR}/${PACKAGE_NAME}-${VERSION}-py3-none-any.whl"
echo ""
echo "To install with client support:"
echo "  pip install '${DIST_DIR}/${PACKAGE_NAME}-${VERSION}-py3-none-any.whl[client]'"
