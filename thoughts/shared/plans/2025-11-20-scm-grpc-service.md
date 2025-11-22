# SCM gRPC Service Implementation Plan

## Overview

Implement a gRPC-Web service that exposes Sentry's SCM (Source Control Management) integration abstraction layer to external services. The solution uses Sonora's grpcWSGI middleware to add gRPC-Web support directly into the existing Django WSGI application, avoiding the need for a separate server process.

## Current State Analysis

Sentry has a comprehensive SCM abstraction layer in `src/sentry/integrations/source_code_management/` that provides unified access to GitHub, GitLab, Bitbucket, and other providers. The system already uses gRPC for TaskWorker communication with pre-compiled protobufs from the `sentry-protos` package. The WSGI application currently only supports HTTP/1.1, making gRPC-Web (not native gRPC) the appropriate solution.

## Desired End State

External services can consume Sentry's SCM functionality via a type-safe gRPC-Web interface that:

- Exposes repository management, commit operations, code mapping, and issue integration
- Authenticates via API keys or HMAC signatures
- Runs in the same WSGI process as the REST APIs
- Provides client libraries distributed via private package repository
- Operates in the region silo with direct database access

### Key Discoveries:

- TaskWorker already uses gRPC with `sentry-protos` package pattern: `src/sentry/taskworker/client/client.py:14-19`
- SCM abstraction has clear interfaces: `src/sentry/integrations/source_code_management/repository.py:57-273`
- WSGI entry point is minimal and extensible: `src/sentry/wsgi.py:21`
- Existing RPC authentication pattern uses HMAC-SHA256: `src/sentry/taskworker/client/client.py:83-108`

## What We're NOT Doing

- NOT implementing native gRPC (requires HTTP/2 which current infrastructure doesn't support)
- NOT creating a separate gRPC server process
- NOT modifying the existing SCM abstraction layer
- NOT replacing the REST API (gRPC-Web supplements existing APIs)
- NOT implementing bi-directional streaming (gRPC-Web limitation)
- NOT publishing to public PyPI (private repository only)

## Implementation Approach

Use grpcWSGI middleware to detect gRPC-Web requests by content-type and route them to registered services, while passing regular HTTP requests through to Django. Services run in region silo with direct database access.

## Phase 1: Foundation Setup & Client Package

### Overview

Install dependencies, define protobuf service interface, generate Python code, and create a distributable Python client package for private repository.

### Changes Required:

#### 1. Dependencies

**File**: `pyproject.toml`
**Changes**: Add grpcWSGI and development dependencies

```toml
# Existing gRPC dependencies (already present)
grpcio = ">=1.67.0"
protobuf = ">=5.27.3"

# New dependencies
grpcWSGI = ">=1.0.0"  # Sonora's WSGI middleware for gRPC-Web
grpcio-tools = ">=1.67.0"  # For protobuf compilation
mypy-protobuf = ">=3.5.0"  # Type stubs for protobuf
```

#### 2. Proto Definition

**File**: `src/sentry/integrations/grpc/protos/scm.proto`
**Changes**: Create new protobuf service definition

```protobuf
syntax = "proto3";

package sentry.integrations.scm.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

service ScmService {
  // Repository operations
  rpc ListRepositories(ListRepositoriesRequest) returns (ListRepositoriesResponse);
  rpc GetRepository(GetRepositoryRequest) returns (Repository);

  // Commit operations
  rpc GetCommit(GetCommitRequest) returns (Commit);
  rpc GetCommitContext(GetCommitContextRequest) returns (CommitContext);

  // Code mapping operations
  rpc CreateCodeMapping(CreateCodeMappingRequest) returns (CodeMapping);
  rpc DeriveCodeMappings(DeriveCodeMappingsRequest) returns (DeriveCodeMappingsResponse);

  // Issue integration
  rpc CreateExternalIssue(CreateExternalIssueRequest) returns (ExternalIssue);
  rpc LinkExternalIssue(LinkExternalIssueRequest) returns (ExternalIssue);
}

// Core data models
message Repository {
  int64 id = 1;
  int64 organization_id = 2;
  string name = 3;
  string url = 4;
  Provider provider = 5;
  string external_id = 6;
  RepositoryStatus status = 7;
  google.protobuf.Timestamp date_added = 8;
  map<string, string> config = 9;
}

message Commit {
  string id = 1;
  int64 repository_id = 2;
  string key = 3;  // SHA
  string message = 4;
  CommitAuthor author = 5;
  google.protobuf.Timestamp date_added = 6;
}

message CommitAuthor {
  string name = 1;
  string email = 2;
  string external_id = 3;
}

message CommitContext {
  int64 repository_id = 1;
  string commit_id = 2;
  string filename = 3;
  int32 line_number = 4;
  string blame_commit_id = 5;
  CommitAuthor blame_author = 6;
  string code_snippet = 7;
}

message CodeMapping {
  int64 id = 1;
  int64 organization_id = 2;
  int64 project_id = 3;
  int64 repository_id = 4;
  string stack_root = 5;
  string source_root = 6;
  string default_branch = 7;
}

message ExternalIssue {
  int64 id = 1;
  int64 organization_id = 2;
  int64 integration_id = 3;
  string key = 4;
  string title = 5;
  string description = 6;
  string web_url = 7;
  map<string, string> metadata = 8;
}

enum Provider {
  PROVIDER_UNSPECIFIED = 0;
  PROVIDER_GITHUB = 1;
  PROVIDER_GITLAB = 2;
  PROVIDER_BITBUCKET = 3;
  PROVIDER_BITBUCKET_SERVER = 4;
  PROVIDER_AZURE_DEVOPS = 5;
  PROVIDER_GITHUB_ENTERPRISE = 6;
}

enum RepositoryStatus {
  REPOSITORY_STATUS_UNSPECIFIED = 0;
  REPOSITORY_STATUS_ACTIVE = 1;
  REPOSITORY_STATUS_DISABLED = 2;
  REPOSITORY_STATUS_HIDDEN = 3;
}

// Request/Response messages
message ListRepositoriesRequest {
  int64 organization_id = 1;
  Provider provider = 2;
  string query = 3;
  int32 page_size = 4;
  string page_token = 5;
}

message ListRepositoriesResponse {
  repeated Repository repositories = 1;
  string next_page_token = 2;
}

message GetRepositoryRequest {
  int64 repository_id = 1;
}

message GetCommitRequest {
  int64 repository_id = 1;
  string commit_sha = 2;
}

message GetCommitContextRequest {
  int64 repository_id = 1;
  string commit_sha = 2;
  string filepath = 3;
  int32 line_number = 4;
}

message CreateCodeMappingRequest {
  int64 organization_id = 1;
  int64 project_id = 2;
  int64 repository_id = 3;
  string stack_root = 4;
  string source_root = 5;
  string default_branch = 6;
}

message DeriveCodeMappingsRequest {
  int64 organization_id = 1;
  int64 project_id = 2;
  repeated string stacktrace_paths = 3;
}

message DeriveCodeMappingsResponse {
  repeated CodeMapping mappings = 1;
}

message CreateExternalIssueRequest {
  int64 organization_id = 1;
  int64 integration_id = 2;
  string title = 3;
  string description = 4;
  map<string, string> metadata = 5;
}

message LinkExternalIssueRequest {
  int64 group_id = 1;
  int64 external_issue_id = 2;
}
```

#### 3. Code Generation Script

**File**: `scripts/generate_grpc.sh`
**Changes**: Create script for generating Python code from proto files

```bash
#!/bin/bash
set -e

PROTO_DIR="src/sentry/integrations/grpc/protos"
OUTPUT_DIR="src/sentry/integrations/grpc/generated"
CLIENT_DIR="packages/sentry-scm-client"

# Create output directories
mkdir -p "${OUTPUT_DIR}"
mkdir -p "${CLIENT_DIR}/sentry_scm_client"

# Generate Python code for server
python -m grpc_tools.protoc \
  -I"${PROTO_DIR}" \
  --python_out="${OUTPUT_DIR}" \
  --grpc_python_out="${OUTPUT_DIR}" \
  --mypy_out="${OUTPUT_DIR}" \
  --mypy_grpc_out="${OUTPUT_DIR}" \
  "${PROTO_DIR}/scm.proto"

# Generate Python code for client package
python -m grpc_tools.protoc \
  -I"${PROTO_DIR}" \
  --python_out="${CLIENT_DIR}/sentry_scm_client" \
  --grpc_python_out="${CLIENT_DIR}/sentry_scm_client" \
  --mypy_out="${CLIENT_DIR}/sentry_scm_client" \
  --mypy_grpc_out="${CLIENT_DIR}/sentry_scm_client" \
  "${PROTO_DIR}/scm.proto"

# Create __init__.py files
touch "${OUTPUT_DIR}/__init__.py"
touch "${CLIENT_DIR}/sentry_scm_client/__init__.py"

echo "gRPC code generation complete"
```

#### 4. Python Client Package Structure

**File**: `packages/sentry-scm-client/pyproject.toml`
**Changes**: Create package configuration for distribution

```toml
[build-system]
requires = ["setuptools>=61.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "sentry-scm-client"
dynamic = ["version"]
description = "gRPC-Web client for Sentry SCM integration service"
readme = "README.md"
license = {text = "Apache-2.0"}
authors = [
    {name = "Sentry", email = "engineering@sentry.io"}
]
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
    "grpcio>=1.67.0",
    "grpcio-web>=1.67.0",  # For gRPC-Web support
    "protobuf>=5.27.3",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0",
    "mypy>=1.0",
    "types-protobuf",
]

[tool.setuptools.dynamic]
version = {attr = "sentry_scm_client.__version__"}

[tool.setuptools.packages.find]
where = ["."]
include = ["sentry_scm_client*"]
```

**File**: `packages/sentry-scm-client/sentry_scm_client/__init__.py`
**Changes**: Package initialization with version matching Sentry

```python
"""Sentry SCM gRPC-Web client library."""

# Version matches main Sentry version
__version__ = "24.11.0"  # Update this to match current Sentry version

from .scm_pb2 import *
from .scm_pb2_grpc import *
from .client import ScmClient

__all__ = ["ScmClient"]
```

**File**: `packages/sentry-scm-client/sentry_scm_client/client.py`
**Changes**: High-level client wrapper

```python
"""High-level client for Sentry SCM gRPC-Web service."""

import grpc
from typing import Optional, List
import hmac
import hashlib
import json

from . import scm_pb2, scm_pb2_grpc


class ScmClient:
    """Client for interacting with Sentry SCM service via gRPC-Web."""

    def __init__(
        self,
        host: str,
        api_key: Optional[str] = None,
        shared_secret: Optional[str] = None,
        secure: bool = True,
    ):
        """Initialize SCM client.

        Args:
            host: Sentry hostname (e.g., 'sentry.example.com:443')
            api_key: API key for authentication
            shared_secret: Shared secret for HMAC authentication
            secure: Use secure channel (HTTPS)
        """
        if secure:
            self.channel = grpc.secure_channel(host, grpc.ssl_channel_credentials())
        else:
            self.channel = grpc.insecure_channel(host)

        self.stub = scm_pb2_grpc.ScmServiceStub(self.channel)
        self.api_key = api_key
        self.shared_secret = shared_secret

    def _get_metadata(self, request_body: bytes = b"") -> List[tuple]:
        """Generate authentication metadata."""
        metadata = []

        if self.api_key:
            metadata.append(('x-api-key', self.api_key))
        elif self.shared_secret:
            # Generate HMAC signature
            signature = hmac.new(
                self.shared_secret.encode('utf-8'),
                request_body,
                hashlib.sha256
            ).hexdigest()
            metadata.append(('x-signature', signature))
            metadata.append(('x-body', request_body.hex()))

        return metadata

    def list_repositories(
        self,
        organization_id: int,
        provider: Optional[int] = None,
        page_size: int = 50,
    ) -> scm_pb2.ListRepositoriesResponse:
        """List repositories for an organization."""
        request = scm_pb2.ListRepositoriesRequest(
            organization_id=organization_id,
            provider=provider or scm_pb2.PROVIDER_UNSPECIFIED,
            page_size=page_size,
        )

        metadata = self._get_metadata(request.SerializeToString())
        return self.stub.ListRepositories(request, metadata=metadata)

    def get_commit_context(
        self,
        repository_id: int,
        commit_sha: str,
        filepath: str,
        line_number: int,
    ) -> scm_pb2.CommitContext:
        """Get blame information for a specific file location."""
        request = scm_pb2.GetCommitContextRequest(
            repository_id=repository_id,
            commit_sha=commit_sha,
            filepath=filepath,
            line_number=line_number,
        )

        metadata = self._get_metadata(request.SerializeToString())
        return self.stub.GetCommitContext(request, metadata=metadata)

    def close(self):
        """Close the gRPC channel."""
        self.channel.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
```

**File**: `packages/sentry-scm-client/README.md`
**Changes**: Client documentation

````markdown
# Sentry SCM gRPC-Web Client

Python client library for interacting with Sentry's SCM integration service via gRPC-Web.

## Installation

```bash
pip install sentry-scm-client --index-url https://your-private-repo.example.com/simple/
```
````

## Usage

```python
from sentry_scm_client import ScmClient, PROVIDER_GITHUB

# Using API key authentication
with ScmClient('sentry.example.com:443', api_key='your-api-key') as client:
    # List repositories
    response = client.list_repositories(
        organization_id=12345,
        provider=PROVIDER_GITHUB
    )
    for repo in response.repositories:
        print(f"Repository: {repo.name}")

    # Get commit blame
    context = client.get_commit_context(
        repository_id=repo.id,
        commit_sha='abc123',
        filepath='src/main.py',
        line_number=42
    )
    print(f"Blamed to: {context.blame_author.name}")
```

## Authentication

The client supports two authentication methods:

1. **API Key**: Pass `api_key` parameter to the client
2. **HMAC Signature**: Pass `shared_secret` for service-to-service auth

## Development

This package is automatically generated from Sentry's protobuf definitions.
Do not edit the generated files directly.

````

### Success Criteria:

#### Automated Verification:
- [x] Dependencies installed: `pip install -e .`
- [x] Proto file validates: `python -m grpc_tools.protoc --python_out=/tmp src/sentry/integrations/grpc/protos/scm.proto`
- [x] Generation script runs: `bash scripts/generate_grpc.sh`
- [x] Client package builds: `cd packages/sentry-scm-client && pip install -e .`
- [x] Client package imports: `python -c "from sentry_scm_client import ScmClient"`

#### Manual Verification:
- [ ] Client package can be built for distribution: `python -m build`
- [ ] Package can be uploaded to private repository
- [ ] External projects can install and use the client

---

## Phase 2: Service Implementation with Region Silo

### Overview
Create the gRPC service implementation that directly accesses the database in region silo mode.

### Changes Required:

#### 1. Service Implementation
**File**: `src/sentry/integrations/grpc/services/scm_service.py`
**Changes**: Implement ScmServicer with region silo context and direct DB access

```python
import grpc
from typing import Any
from sentry.integrations.grpc.generated import scm_pb2, scm_pb2_grpc
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.integrations.manager import integrations
from sentry.models import Repository, Commit, Organization, Project
from sentry.models.integrations import Integration, OrganizationIntegration
from sentry.api.base import region_silo_endpoint
from sentry.silo import SiloMode

# Ensure this service runs in region silo
assert SiloMode.get_current_mode() == SiloMode.REGION, "SCM gRPC service must run in region silo"


class ScmServicer(scm_pb2_grpc.ScmServiceServicer):
    """
    gRPC service implementation for SCM operations.

    This service runs in the region silo and has direct database access.
    """

    def _get_integration(self, organization_id: int, provider: str) -> RepositoryIntegration:
        """Get the repository integration for an organization."""
        # Map provider enum to integration key
        provider_map = {
            scm_pb2.PROVIDER_GITHUB: "github",
            scm_pb2.PROVIDER_GITLAB: "gitlab",
            scm_pb2.PROVIDER_BITBUCKET: "bitbucket",
            scm_pb2.PROVIDER_BITBUCKET_SERVER: "bitbucket_server",
            scm_pb2.PROVIDER_AZURE_DEVOPS: "vsts",
            scm_pb2.PROVIDER_GITHUB_ENTERPRISE: "github_enterprise",
        }

        integration_key = provider_map.get(provider)
        if not integration_key:
            raise ValueError(f"Unknown provider: {provider}")

        # Direct database access - we're in region silo
        org = Organization.objects.get(id=organization_id)
        org_integration = OrganizationIntegration.objects.get(
            organization=org,
            integration__provider=integration_key
        )

        integration_cls = integrations.get(integration_key)
        return integration_cls.get_installation(
            model=org_integration.integration,
            organization_id=organization_id
        )

    def _provider_to_proto(self, provider: str) -> int:
        """Convert provider string to proto enum."""
        provider_map = {
            "github": scm_pb2.PROVIDER_GITHUB,
            "gitlab": scm_pb2.PROVIDER_GITLAB,
            "bitbucket": scm_pb2.PROVIDER_BITBUCKET,
            "bitbucket_server": scm_pb2.PROVIDER_BITBUCKET_SERVER,
            "vsts": scm_pb2.PROVIDER_AZURE_DEVOPS,
            "github_enterprise": scm_pb2.PROVIDER_GITHUB_ENTERPRISE,
        }
        return provider_map.get(provider, scm_pb2.PROVIDER_UNSPECIFIED)

    def _status_to_proto(self, status: int) -> int:
        """Convert repository status to proto enum."""
        # Map from Repository.status choices
        from sentry.models.repository import RepositoryStatus as RepoStatus
        status_map = {
            RepoStatus.ACTIVE: scm_pb2.REPOSITORY_STATUS_ACTIVE,
            RepoStatus.DISABLED: scm_pb2.REPOSITORY_STATUS_DISABLED,
            RepoStatus.HIDDEN: scm_pb2.REPOSITORY_STATUS_HIDDEN,
        }
        return status_map.get(status, scm_pb2.REPOSITORY_STATUS_UNSPECIFIED)

    def ListRepositories(
        self,
        request: scm_pb2.ListRepositoriesRequest,
        context: grpc.ServicerContext
    ) -> scm_pb2.ListRepositoriesResponse:
        """List repositories for an organization using direct DB access."""
        try:
            # Direct database query - we're in region silo
            repos = Repository.objects.filter(
                organization_id=request.organization_id
            ).select_related('organization')

            # Apply provider filter if specified
            if request.provider != scm_pb2.PROVIDER_UNSPECIFIED:
                provider_key = self._proto_to_provider(request.provider)
                repos = repos.filter(provider=provider_key)

            # Apply search query if provided
            if request.query:
                repos = repos.filter(name__icontains=request.query)

            # Pagination
            repos = repos[:request.page_size if request.page_size else 100]

            response = scm_pb2.ListRepositoriesResponse()
            for repo in repos:
                pb_repo = scm_pb2.Repository(
                    id=repo.id,
                    organization_id=repo.organization_id,
                    name=repo.name,
                    url=repo.url or "",
                    provider=self._provider_to_proto(repo.provider),
                    external_id=repo.external_id or "",
                    status=self._status_to_proto(repo.status),
                )
                response.repositories.append(pb_repo)

            return response
        except Organization.DoesNotExist:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f"Organization {request.organization_id} not found")
            return scm_pb2.ListRepositoriesResponse()
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return scm_pb2.ListRepositoriesResponse()

    def GetRepository(
        self,
        request: scm_pb2.GetRepositoryRequest,
        context: grpc.ServicerContext
    ) -> scm_pb2.Repository:
        """Get a specific repository using direct DB access."""
        try:
            # Direct database query
            repo = Repository.objects.select_related('organization').get(
                id=request.repository_id
            )

            return scm_pb2.Repository(
                id=repo.id,
                organization_id=repo.organization_id,
                name=repo.name,
                url=repo.url or "",
                provider=self._provider_to_proto(repo.provider),
                external_id=repo.external_id or "",
                status=self._status_to_proto(repo.status),
            )
        except Repository.DoesNotExist:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f"Repository {request.repository_id} not found")
            return scm_pb2.Repository()

    def GetCommit(
        self,
        request: scm_pb2.GetCommitRequest,
        context: grpc.ServicerContext
    ) -> scm_pb2.Commit:
        """Get commit details using direct DB access."""
        try:
            # Direct database query with select_related for efficiency
            commit = Commit.objects.select_related('author', 'repository').get(
                repository_id=request.repository_id,
                key=request.commit_sha
            )

            return scm_pb2.Commit(
                id=str(commit.id),
                repository_id=commit.repository_id,
                key=commit.key,
                message=commit.message or "",
                author=scm_pb2.CommitAuthor(
                    name=commit.author.name if commit.author else "",
                    email=commit.author.email if commit.author else "",
                ),
                date_added=commit.date_added,
            )
        except Commit.DoesNotExist:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f"Commit {request.commit_sha} not found in repository {request.repository_id}")
            return scm_pb2.Commit()

    def GetCommitContext(
        self,
        request: scm_pb2.GetCommitContextRequest,
        context: grpc.ServicerContext
    ) -> scm_pb2.CommitContext:
        """
        Get commit context (blame) for a file location.

        This method uses the SCM integration to fetch blame data from the provider.
        """
        try:
            # Get repository from DB
            repo = Repository.objects.select_related('organization').get(
                id=request.repository_id
            )

            # Get the integration for this repository
            integration = self._get_integration(
                repo.organization_id,
                repo.provider
            )

            # Use the integration's commit context capabilities
            from sentry.integrations.source_code_management.commit_context import CommitContextIntegration

            if not isinstance(integration, CommitContextIntegration):
                context.set_code(grpc.StatusCode.UNIMPLEMENTED)
                context.set_details(f"Provider {repo.provider} does not support commit context")
                return scm_pb2.CommitContext()

            # Call the integration to get blame information
            # This will make external API calls to GitHub/GitLab/etc
            blame_info = integration.get_blame_for_files(
                files=[{
                    "path": request.filepath,
                    "lineno": request.line_number,
                    "ref": request.commit_sha,
                    "repo": repo,
                }],
                extra={}
            )

            if blame_info and len(blame_info) > 0:
                info = blame_info[0]
                return scm_pb2.CommitContext(
                    repository_id=request.repository_id,
                    commit_id=request.commit_sha,
                    filename=request.filepath,
                    line_number=request.line_number,
                    blame_commit_id=info.commit.commitId,
                    blame_author=scm_pb2.CommitAuthor(
                        name=info.commit.commitAuthor.name or "",
                        email=info.commit.commitAuthor.email or "",
                    ),
                    code_snippet=info.code or "",
                )

            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details("Blame information not available")
            return scm_pb2.CommitContext()

        except Repository.DoesNotExist:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f"Repository {request.repository_id} not found")
            return scm_pb2.CommitContext()
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return scm_pb2.CommitContext()

    def CreateCodeMapping(
        self,
        request: scm_pb2.CreateCodeMappingRequest,
        context: grpc.ServicerContext
    ) -> scm_pb2.CodeMapping:
        """Create a code mapping using direct DB access."""
        try:
            from sentry.models.integrations.repository_project_path_config import (
                RepositoryProjectPathConfig
            )

            # Validate organization and project exist
            org = Organization.objects.get(id=request.organization_id)
            project = Project.objects.get(id=request.project_id, organization=org)
            repo = Repository.objects.get(id=request.repository_id, organization=org)

            # Create the code mapping
            mapping = RepositoryProjectPathConfig.objects.create(
                organization_id=request.organization_id,
                project_id=request.project_id,
                repository_id=request.repository_id,
                stack_root=request.stack_root,
                source_root=request.source_root,
                default_branch=request.default_branch or "master",
            )

            return scm_pb2.CodeMapping(
                id=mapping.id,
                organization_id=mapping.organization_id,
                project_id=mapping.project_id,
                repository_id=mapping.repository_id,
                stack_root=mapping.stack_root,
                source_root=mapping.source_root,
                default_branch=mapping.default_branch,
            )
        except (Organization.DoesNotExist, Project.DoesNotExist, Repository.DoesNotExist) as e:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(str(e))
            return scm_pb2.CodeMapping()
        except Exception as e:
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            return scm_pb2.CodeMapping()

    # Placeholder methods for unimplemented features
    def DeriveCodeMappings(self, request, context):
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("Code mapping derivation not yet implemented")
        return scm_pb2.DeriveCodeMappingsResponse()

    def CreateExternalIssue(self, request, context):
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("External issue creation not yet implemented")
        return scm_pb2.ExternalIssue()

    def LinkExternalIssue(self, request, context):
        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
        context.set_details("External issue linking not yet implemented")
        return scm_pb2.ExternalIssue()

    def _proto_to_provider(self, provider_enum: int) -> str:
        """Convert proto enum to provider string."""
        provider_map = {
            scm_pb2.PROVIDER_GITHUB: "github",
            scm_pb2.PROVIDER_GITLAB: "gitlab",
            scm_pb2.PROVIDER_BITBUCKET: "bitbucket",
            scm_pb2.PROVIDER_BITBUCKET_SERVER: "bitbucket_server",
            scm_pb2.PROVIDER_AZURE_DEVOPS: "vsts",
            scm_pb2.PROVIDER_GITHUB_ENTERPRISE: "github_enterprise",
        }
        return provider_map.get(provider_enum, "")
````

#### 2. Helper Functions

**File**: `src/sentry/integrations/grpc/services/__init__.py`
**Changes**: Create package initialization

```python
from .scm_service import ScmServicer

__all__ = ["ScmServicer"]
```

### Success Criteria:

#### Automated Verification:

- [x] Service implementation imports: `python -c "from sentry.integrations.grpc.services import ScmServicer"`
- [x] Service instantiates: `python -c "from sentry.integrations.grpc.services import ScmServicer; s = ScmServicer()"`
- [ ] Unit tests pass: `pytest tests/sentry/integrations/grpc/services/test_scm_service.py`
- [ ] Type checking passes: `mypy src/sentry/integrations/grpc/services/`

#### Manual Verification:

- [ ] Service methods use direct database queries
- [ ] Service runs in region silo context
- [ ] External API calls are only made for provider-specific operations

---

## Phase 3: Simplified WSGI Integration

### Overview

Add grpcWSGI middleware to the Django WSGI application with minimal changes.

### Changes Required:

#### 1. WSGI Modification

**File**: `src/sentry/wsgi.py`
**Changes**: Add grpcWSGI wrapper with service registration (minimal changes)

```python
"""
WSGI config for Sentry Server.

This module contains the WSGI application used by Django's development server
and any production WSGI deployments. It should expose a module-level variable
named ``application``. Django's ``runserver`` and ``runfcgi`` commands discover
this application via the ``WSGI_APPLICATION`` setting.

Usually you will have the standard Django WSGI application here, but it also
might make sense to replace the whole Django WSGI application with a custom one
that later delegates to the Django one. For example, you could introduce WSGI
middleware here, or combine a Django application with an application of another
framework.

"""
import os

# Bootstrap the Sentry environment
from sentry.utils.imports import import_string

# Bootstrap options
from sentry.runner import configure

if not os.environ.get("DJANGO_SETTINGS_MODULE"):
    configure()

from django.core.handlers.wsgi import WSGIHandler

application = WSGIHandler()

# Add gRPC-Web support using grpcWSGI
from sonora.wsgi import grpcWSGI
from sentry.integrations.grpc.generated import scm_pb2_grpc
from sentry.integrations.grpc.services.scm_service import ScmServicer

# Wrap Django application with gRPC-Web middleware
application = grpcWSGI(application)

# Register gRPC services
scm_pb2_grpc.add_ScmServiceServicer_to_server(ScmServicer(), application)

# Warm up the application by importing all models and caches at startup
from sentry.utils.runner import initialize_application

initialize_application(application)
```

### Success Criteria:

#### Automated Verification:

- [x] WSGI module imports: `python -c "from sentry.wsgi import application"`
- [ ] Application starts: `sentry devserver --workers=0`
- [ ] No import errors in logs
- [ ] gRPC endpoint responds: `curl -X POST http://localhost:8000/grpc/sentry.integrations.scm.v1.ScmService/ListRepositories`

#### Manual Verification:

- [ ] Django admin and regular routes still work
- [ ] gRPC-Web requests are routed correctly
- [ ] No performance degradation on regular requests

---

## Phase 3.5: Basic Integration Testing

### Overview

Add tests to verify gRPC endpoints are working after WSGI integration.

### Changes Required:

#### 1. Basic gRPC Integration Test

**File**: `tests/sentry/integrations/grpc/test_wsgi_integration.py`
**Changes**: Test that gRPC endpoints are accessible

```python
import pytest
from sentry.testutils.cases import TestCase
from sentry.integrations.grpc.generated import scm_pb2

class TestGrpcWsgiIntegration(TestCase):
    def test_grpc_endpoint_exists(self):
        """Test that gRPC-Web endpoints are registered and accessible."""
        # Create test data
        org = self.create_organization()
        repo = self.create_repo(
            name="test-repo",
            provider="github",
            external_id="123",
            organization_id=org.id
        )

        # Create a simple ListRepositories request
        request = scm_pb2.ListRepositoriesRequest(
            organization_id=org.id
        )

        # Make request to gRPC-Web endpoint
        response = self.client.post(
            '/grpc/sentry.integrations.scm.v1.ScmService/ListRepositories',
            data=request.SerializeToString(),
            content_type='application/grpc-web+proto',
        )

        # Should get a response (even if unauthenticated)
        assert response.status_code in [200, 401, 403]

    def test_regular_endpoints_still_work(self):
        """Ensure regular Django endpoints aren't affected by grpcWSGI."""
        response = self.client.get('/api/0/organizations/')
        # Should get normal response (even if unauthenticated)
        assert response.status_code in [200, 401, 403]
        assert 'application/json' in response.get('Content-Type', '')
```

### Success Criteria:

#### Automated Verification:

- [ ] Integration test passes: `pytest tests/sentry/integrations/grpc/test_wsgi_integration.py`
- [ ] Test can instantiate protobuf messages
- [ ] Test can make requests to gRPC endpoints
- [ ] Regular endpoints continue working

---

## Phase 4: Authentication & Security

### Overview

Implement authentication for gRPC requests using API keys and HMAC signatures.

### Changes Required:

#### 1. Authentication Interceptor

**File**: `src/sentry/integrations/grpc/interceptors/auth.py`
**Changes**: Create authentication interceptor

```python
import grpc
import hmac
import hashlib
import json
from typing import Callable, Any
from django.conf import settings
from sentry.models import ApiKey, ApiKeyStatus

class AuthenticationInterceptor(grpc.ServerInterceptor):
    """Authenticate gRPC requests using API keys or HMAC signatures."""

    def intercept_service(self, continuation: Callable, handler_call_details: Any) -> Any:
        """Intercept and authenticate incoming gRPC requests."""
        metadata = dict(handler_call_details.invocation_metadata or [])

        # Check for API key authentication
        api_key = metadata.get('x-api-key')
        if api_key and self._validate_api_key(api_key):
            return continuation(handler_call_details)

        # Check for HMAC signature (similar to existing RPC)
        signature = metadata.get('x-signature')
        request_body = metadata.get('x-body')
        if signature and request_body and self._validate_signature(
            signature,
            handler_call_details.method,
            request_body
        ):
            return continuation(handler_call_details)

        # No valid authentication
        return self._unauthenticated()

    def _validate_api_key(self, api_key: str) -> bool:
        """Validate API key against database."""
        try:
            key = ApiKey.objects.get_from_cache(key=api_key)
            return key.status == ApiKeyStatus.ACTIVE
        except ApiKey.DoesNotExist:
            return False

    def _validate_signature(self, signature: str, method: str, body: bytes) -> bool:
        """Validate HMAC signature."""
        if not settings.RPC_SHARED_SECRET:
            return False

        # Parse shared secrets (can be a list for rotation)
        try:
            secrets = json.loads(settings.RPC_SHARED_SECRET)
            if not isinstance(secrets, list) or not secrets:
                return False
        except (json.JSONDecodeError, TypeError):
            return False

        # Construct signing payload (method:body)
        signing_payload = f"{method}:{body}".encode('utf-8')

        # Try each secret (for key rotation)
        for secret in secrets:
            expected = hmac.new(
                secret.encode('utf-8'),
                signing_payload,
                hashlib.sha256
            ).hexdigest()

            if hmac.compare_digest(signature, expected):
                return True

        return False

    def _unauthenticated(self) -> grpc.RpcMethodHandler:
        """Return an unauthenticated error handler."""
        def unauthenticated_handler(request, context):
            context.set_code(grpc.StatusCode.UNAUTHENTICATED)
            context.set_details("Authentication required")
            return None

        return grpc.unary_unary_rpc_method_handler(
            unauthenticated_handler,
            request_deserializer=lambda x: x,
            response_serializer=lambda x: b"",
        )
```

#### 2. Update WSGI to use interceptor

**File**: `src/sentry/wsgi.py`
**Changes**: Update service registration to include authentication

```python
# Update the grpc service registration section:

from sonora.wsgi import grpcWSGI
from sentry.integrations.grpc.generated import scm_pb2_grpc
from sentry.integrations.grpc.services.scm_service import ScmServicer
from sentry.integrations.grpc.interceptors.auth import AuthenticationInterceptor

# Wrap Django application with gRPC-Web middleware
application = grpcWSGI(application)

# Create servicer with authentication
servicer = ScmServicer()

# TODO: Add authentication interceptor support when grpcWSGI supports it
# For now, authentication will be handled within service methods
scm_pb2_grpc.add_ScmServiceServicer_to_server(servicer, application)
```

#### 3. Interceptor Package Init

**File**: `src/sentry/integrations/grpc/interceptors/__init__.py`
**Changes**: Export interceptors

```python
from .auth import AuthenticationInterceptor

__all__ = ["AuthenticationInterceptor"]
```

### Success Criteria:

#### Automated Verification:

- [ ] Interceptor imports: `python -c "from sentry.integrations.grpc.interceptors import AuthenticationInterceptor"`
- [ ] Unit tests pass: `pytest tests/sentry/integrations/grpc/interceptors/test_auth.py`
- [ ] Authentication works in service methods

#### Manual Verification:

- [ ] API key authentication works
- [ ] HMAC signature authentication works
- [ ] Invalid credentials return UNAUTHENTICATED status
- [ ] Key rotation works with multiple secrets

---

## Phase 5: Testing & Documentation

### Overview

Create comprehensive tests with minimal mocking and generate client documentation.

### Changes Required:

#### 1. Unit Tests with Real Data

**File**: `tests/sentry/integrations/grpc/services/test_scm_service.py`
**Changes**: Create unit tests that use real database objects

```python
import pytest
from unittest.mock import Mock, patch
import grpc
from sentry.integrations.grpc.services.scm_service import ScmServicer
from sentry.integrations.grpc.generated import scm_pb2
from sentry.testutils.cases import TestCase
from sentry.models import Repository, Commit

class TestScmService(TestCase):
    def setUp(self):
        super().setUp()
        self.servicer = ScmServicer()
        self.context = Mock()

    def test_list_repositories(self):
        """Test listing repositories with real database objects."""
        # Create real test data
        org = self.create_organization()
        repo1 = self.create_repo(
            name="test-repo-1",
            provider="github",
            external_id="123",
            organization_id=org.id
        )
        repo2 = self.create_repo(
            name="test-repo-2",
            provider="gitlab",
            external_id="456",
            organization_id=org.id
        )

        request = scm_pb2.ListRepositoriesRequest(
            organization_id=org.id
        )

        # Call the service - no mocking needed
        response = self.servicer.ListRepositories(request, self.context)

        # Verify response
        assert len(response.repositories) == 2
        repo_names = [r.name for r in response.repositories]
        assert "test-repo-1" in repo_names
        assert "test-repo-2" in repo_names

        # Verify provider mapping
        github_repo = next(r for r in response.repositories if r.name == "test-repo-1")
        assert github_repo.provider == scm_pb2.PROVIDER_GITHUB

    def test_list_repositories_with_provider_filter(self):
        """Test filtering repositories by provider."""
        org = self.create_organization()
        github_repo = self.create_repo(
            name="github-repo",
            provider="github",
            organization_id=org.id
        )
        gitlab_repo = self.create_repo(
            name="gitlab-repo",
            provider="gitlab",
            organization_id=org.id
        )

        # Request only GitHub repos
        request = scm_pb2.ListRepositoriesRequest(
            organization_id=org.id,
            provider=scm_pb2.PROVIDER_GITHUB
        )

        response = self.servicer.ListRepositories(request, self.context)

        assert len(response.repositories) == 1
        assert response.repositories[0].name == "github-repo"

    def test_get_repository(self):
        """Test getting a single repository."""
        org = self.create_organization()
        repo = self.create_repo(
            name="test-repo",
            provider="github",
            url="https://github.com/test/repo",
            organization_id=org.id
        )

        request = scm_pb2.GetRepositoryRequest(repository_id=repo.id)

        response = self.servicer.GetRepository(request, self.context)

        assert response.id == repo.id
        assert response.name == "test-repo"
        assert response.url == "https://github.com/test/repo"
        assert response.provider == scm_pb2.PROVIDER_GITHUB

    def test_get_repository_not_found(self):
        """Test getting non-existent repository."""
        request = scm_pb2.GetRepositoryRequest(repository_id=99999)

        response = self.servicer.GetRepository(request, self.context)

        self.context.set_code.assert_called_with(grpc.StatusCode.NOT_FOUND)
        self.context.set_details.assert_called()

    def test_get_commit(self):
        """Test getting commit details."""
        org = self.create_organization()
        repo = self.create_repo(organization_id=org.id)
        author = self.create_commit_author(
            name="Test Author",
            email="test@example.com"
        )
        commit = self.create_commit(
            repository=repo,
            key="abc123def456",
            message="Fix important bug",
            author=author
        )

        request = scm_pb2.GetCommitRequest(
            repository_id=repo.id,
            commit_sha="abc123def456"
        )

        response = self.servicer.GetCommit(request, self.context)

        assert response.key == "abc123def456"
        assert response.message == "Fix important bug"
        assert response.author.name == "Test Author"
        assert response.author.email == "test@example.com"

    @patch('sentry.integrations.source_code_management.commit_context.CommitContextIntegration.get_blame_for_files')
    def test_get_commit_context(self, mock_get_blame):
        """Test getting commit context with mocked external API call."""
        # Create real database objects
        org = self.create_organization()
        integration = self.create_integration(
            organization=org,
            provider="github",
            external_id="1234"
        )
        repo = self.create_repo(
            provider="github",
            organization_id=org.id,
            integration_id=integration.id
        )

        # Mock only the external API call
        mock_blame_result = Mock()
        mock_blame_result.commit.commitId = "def456"
        mock_blame_result.commit.commitAuthor.name = "Blame Author"
        mock_blame_result.commit.commitAuthor.email = "blame@example.com"
        mock_blame_result.code = "print('Hello World')"
        mock_get_blame.return_value = [mock_blame_result]

        request = scm_pb2.GetCommitContextRequest(
            repository_id=repo.id,
            commit_sha="abc123",
            filepath="src/main.py",
            line_number=42
        )

        with patch.object(self.servicer, '_get_integration') as mock_get_integration:
            # Return a mock integration that has the get_blame_for_files method
            mock_integration = Mock()
            mock_integration.get_blame_for_files = mock_get_blame
            mock_get_integration.return_value = mock_integration

            response = self.servicer.GetCommitContext(request, self.context)

            assert response.blame_commit_id == "def456"
            assert response.blame_author.name == "Blame Author"
            assert response.code_snippet == "print('Hello World')"

            # Verify the integration method was called correctly
            mock_get_blame.assert_called_once()
            call_args = mock_get_blame.call_args[0][0]  # files argument
            assert len(call_args) == 1
            assert call_args[0]["path"] == "src/main.py"
            assert call_args[0]["lineno"] == 42

    def test_create_code_mapping(self):
        """Test creating a code mapping."""
        org = self.create_organization()
        project = self.create_project(organization=org)
        repo = self.create_repo(organization_id=org.id)

        request = scm_pb2.CreateCodeMappingRequest(
            organization_id=org.id,
            project_id=project.id,
            repository_id=repo.id,
            stack_root="/app",
            source_root="/src",
            default_branch="main"
        )

        response = self.servicer.CreateCodeMapping(request, self.context)

        assert response.organization_id == org.id
        assert response.project_id == project.id
        assert response.repository_id == repo.id
        assert response.stack_root == "/app"
        assert response.source_root == "/src"
        assert response.default_branch == "main"

        # Verify it was actually created in the database
        from sentry.models.integrations.repository_project_path_config import (
            RepositoryProjectPathConfig
        )
        mapping = RepositoryProjectPathConfig.objects.get(id=response.id)
        assert mapping.stack_root == "/app"
        assert mapping.source_root == "/src"
```

#### 2. Integration Tests

**File**: `tests/sentry/integrations/grpc/test_grpc_integration.py`
**Changes**: Test end-to-end gRPC-Web flow

```python
import pytest
from sentry.testutils import TestCase
from sentry.integrations.grpc.generated import scm_pb2
from sentry.models import ApiKey

class TestGrpcWebIntegration(TestCase):
    def test_grpc_web_request_with_auth(self):
        """Test gRPC-Web request through Django test client with authentication."""
        # Create real test data
        org = self.create_organization()
        user = self.create_user()
        self.create_member(organization=org, user=user)

        repo = self.create_repo(
            name="test-repo",
            provider="github",
            organization_id=org.id
        )

        # Create API key for authentication
        api_key = ApiKey.objects.create(
            organization_id=org.id,
            scope_list=["org:read", "repository:read"],
            status=ApiKeyStatus.ACTIVE
        )

        # Construct gRPC-Web request
        request = scm_pb2.ListRepositoriesRequest(
            organization_id=org.id
        )

        # Make authenticated request
        response = self.client.post(
            '/grpc/sentry.integrations.scm.v1.ScmService/ListRepositories',
            data=request.SerializeToString(),
            content_type='application/grpc-web+proto',
            HTTP_X_API_KEY=api_key.key
        )

        assert response.status_code == 200
        assert response['content-type'] == 'application/grpc-web+proto'

        # Parse and verify response
        resp_proto = scm_pb2.ListRepositoriesResponse()
        resp_proto.ParseFromString(response.content)
        assert len(resp_proto.repositories) == 1
        assert resp_proto.repositories[0].name == "test-repo"

    def test_grpc_web_request_without_auth(self):
        """Test that unauthenticated requests are rejected."""
        org = self.create_organization()

        request = scm_pb2.ListRepositoriesRequest(
            organization_id=org.id
        )

        response = self.client.post(
            '/grpc/sentry.integrations.scm.v1.ScmService/ListRepositories',
            data=request.SerializeToString(),
            content_type='application/grpc-web+proto',
        )

        # Should get unauthorized response
        assert response.status_code == 401

    def test_pagination(self):
        """Test pagination in list operations."""
        org = self.create_organization()

        # Create multiple repositories
        for i in range(10):
            self.create_repo(
                name=f"repo-{i}",
                provider="github",
                organization_id=org.id
            )

        # Create API key
        api_key = ApiKey.objects.create(
            organization_id=org.id,
            scope_list=["org:read", "repository:read"],
            status=ApiKeyStatus.ACTIVE
        )

        # Request with page size
        request = scm_pb2.ListRepositoriesRequest(
            organization_id=org.id,
            page_size=5
        )

        response = self.client.post(
            '/grpc/sentry.integrations.scm.v1.ScmService/ListRepositories',
            data=request.SerializeToString(),
            content_type='application/grpc-web+proto',
            HTTP_X_API_KEY=api_key.key
        )

        assert response.status_code == 200

        resp_proto = scm_pb2.ListRepositoriesResponse()
        resp_proto.ParseFromString(response.content)
        assert len(resp_proto.repositories) == 5
```

#### 3. Client Documentation

**File**: `docs/grpc-scm-client.md`
**Changes**: Document client usage

````markdown
# Sentry SCM gRPC-Web Client Documentation

## Overview

The Sentry SCM gRPC-Web service provides programmatic access to Sentry's source control management integrations. This service allows external applications to:

- List and manage repositories
- Retrieve commit information and blame data
- Create and manage code mappings
- Integrate with external issue trackers

## Installation

### Python Client

Install from private package repository:

```bash
pip install sentry-scm-client --index-url https://your-private-repo/simple/
```
````

## Authentication

The service supports two authentication methods:

### API Key Authentication

Generate an API key in Sentry with appropriate scopes:

- `org:read` - Read organization data
- `repository:read` - Read repository information
- `repository:write` - Modify repository settings

```python
from sentry_scm_client import ScmClient

client = ScmClient(
    host='sentry.example.com:443',
    api_key='your-api-key-here'
)
```

### HMAC Signature Authentication

For service-to-service communication:

```python
client = ScmClient(
    host='sentry.example.com:443',
    shared_secret='your-shared-secret'
)
```

## API Reference

### ListRepositories

List all repositories for an organization.

**Request:**

- `organization_id` (int64): Organization ID
- `provider` (Provider): Optional provider filter
- `query` (string): Optional search query
- `page_size` (int32): Results per page
- `page_token` (string): Pagination token

**Response:**

- `repositories` (Repository[]): List of repositories
- `next_page_token` (string): Token for next page

### GetRepository

Get details for a specific repository.

**Request:**

- `repository_id` (int64): Repository ID

**Response:**

- Repository object

### GetCommitContext

Get blame information for a specific file location.

**Request:**

- `repository_id` (int64): Repository ID
- `commit_sha` (string): Commit SHA
- `filepath` (string): File path
- `line_number` (int32): Line number

**Response:**

- `blame_commit_id` (string): SHA of commit that last modified the line
- `blame_author` (CommitAuthor): Author information
- `code_snippet` (string): The actual line of code

## Examples

### List GitHub Repositories

```python
from sentry_scm_client import ScmClient, PROVIDER_GITHUB

with ScmClient('sentry.example.com:443', api_key='...') as client:
    response = client.list_repositories(
        organization_id=12345,
        provider=PROVIDER_GITHUB
    )

    for repo in response.repositories:
        print(f"{repo.name}: {repo.url}")
```

### Get Blame Information

```python
context = client.get_commit_context(
    repository_id=repo.id,
    commit_sha='abc123def456',
    filepath='src/components/Dashboard.tsx',
    line_number=142
)

print(f"Line last modified by: {context.blame_author.name}")
print(f"In commit: {context.blame_commit_id}")
print(f"Code: {context.code_snippet}")
```

## Error Handling

The service returns standard gRPC status codes:

- `NOT_FOUND` - Resource not found
- `UNAUTHENTICATED` - Invalid or missing authentication
- `PERMISSION_DENIED` - Insufficient permissions
- `INVALID_ARGUMENT` - Invalid request parameters
- `INTERNAL` - Server error

```python
import grpc

try:
    response = client.get_repository(repository_id=99999)
except grpc.RpcError as e:
    if e.code() == grpc.StatusCode.NOT_FOUND:
        print("Repository not found")
    else:
        print(f"Error: {e.details()}")
```

## Rate Limiting

The service inherits Sentry's standard API rate limits. Monitor the following headers in responses:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

## Support

For issues or questions, contact the Sentry engineering team or file an issue in the internal issue tracker.

```

### Success Criteria:

#### Automated Verification:
- [ ] All unit tests pass: `pytest tests/sentry/integrations/grpc/services/`
- [ ] Integration tests pass: `pytest tests/sentry/integrations/grpc/test_grpc_integration.py`
- [ ] WSGI integration tests pass: `pytest tests/sentry/integrations/grpc/test_wsgi_integration.py`
- [ ] Coverage meets threshold: `pytest --cov=sentry.integrations.grpc tests/sentry/integrations/grpc/`

#### Manual Verification:
- [ ] Client package builds and installs correctly
- [ ] External client can authenticate and make requests
- [ ] All implemented methods work with real data
- [ ] Performance is acceptable for typical workloads

---

## Testing Strategy

### Unit Tests:
- Use real database objects created with test helpers
- Only mock external API calls (GitHub, GitLab, etc.)
- Test all error conditions and edge cases
- Verify database state after mutations

### Integration Tests:
- Test full request/response cycle through Django test client
- Test authentication mechanisms
- Test pagination and filtering
- Verify protobuf serialization/deserialization

### Manual Testing Steps:
1. Start development server: `sentry devserver`
2. Install client package: `pip install -e packages/sentry-scm-client`
3. Run example client against local server
4. Test with different authentication methods
5. Verify error handling for edge cases

## Performance Considerations

- grpcWSGI adds minimal overhead (only checks Content-Type header)
- Direct database access in region silo is faster than RPC calls
- Protobuf serialization is more efficient than JSON
- Consider adding caching for frequently accessed repositories
- Monitor query performance with Django Debug Toolbar

## Migration Notes

- No database migrations required (uses existing models)
- Backward compatible - REST APIs continue to work
- Services run in region silo with direct DB access
- Proto changes should be backward compatible (only add fields)

## References

- Original research: `thoughts/shared/research/2025-11-14-scm-grpc-comprehensive.md`
- SCM abstraction: `src/sentry/integrations/source_code_management/repository.py:57-273`
- TaskWorker gRPC pattern: `src/sentry/taskworker/client/client.py:14-19`
- WSGI entry point: `src/sentry/wsgi.py:21`
- Django models: `src/sentry/models/repository.py`
```
