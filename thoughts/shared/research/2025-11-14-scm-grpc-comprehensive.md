---
date: 2025-11-14T16:35:38-08:00
researcher: mikeihbe
git_commit: 3132554bb477e04ed8c188e851276f77163e9985
branch: ihbe/detectors-slowdb
repository: sentry
topic: 'SCM Integration gRPC Service Implementation'
tags: [research, codebase, scm, grpc, integration, rpc, implementation]
status: complete
last_updated: 2025-11-14
last_updated_by: mikeihbe
---

# Comprehensive Research: SCM Integration gRPC Service Implementation

**Date**: 2025-11-14 16:35:38 PST
**Researcher**: mikeihbe
**Git Commit**: 3132554bb477e04ed8c188e851276f77163e9985
**Branch**: ihbe/detectors-slowdb
**Repository**: sentry

## Executive Summary

This research documents how to add a gRPC interface for Sentry's SCM (Source Control Management) integration abstraction layer that external services can consume. The solution uses **Sonora's grpcWSGI middleware** to add gRPC-Web support to the existing Django WSGI application without requiring a separate server process.

### Key Findings

1. **Existing SCM abstraction**: Sentry has a comprehensive SCM abstraction layer in `src/sentry/integrations/source_code_management/`
2. **gRPC already in use**: Sentry uses gRPC for TaskWorker/TaskBroker communication (`src/sentry/taskworker/client/client.py`)
3. **WSGI limitations**: Current infrastructure only supports HTTP/1.1, not HTTP/2 required for native gRPC
4. **Solution**: Use grpcWSGI to serve gRPC-Web alongside REST APIs in the same process

## Part 1: Current Architecture Analysis

### SCM Integration Abstraction Layer

The SCM abstraction layer provides a unified interface across multiple source control providers:

#### Core Components

- **Location**: `src/sentry/integrations/source_code_management/`
- **Base classes**:
  - `BaseRepositoryIntegration`: Core abstraction for all SCM integrations
  - `RepositoryIntegration`: Extended functionality for repository operations
  - `RepositoryClient`: Abstract client interface for SCM APIs

#### Functionality Modules

- `commit_context.py`: Commit context and blame functionality
- `issues.py`: Issue tracking integration for SCM providers
- `search.py`: Repository and code search capabilities
- `webhook.py`: Webhook handling for SCM events
- `status_check.py`: Commit status and CI/CD integration
- `repo_trees.py`: Repository tree and file browsing
- `metrics.py`: Performance metrics for SCM operations
- `tasks.py`: Background tasks for SCM operations

#### Provider Implementations

- GitHub: `src/sentry/integrations/github/`
- GitLab: `src/sentry/integrations/gitlab/`
- Bitbucket: `src/sentry/integrations/bitbucket/`
- Bitbucket Server: `src/sentry/integrations/bitbucket_server/`
- Azure DevOps: `src/sentry/integrations/vsts/`
- GitHub Enterprise: `src/sentry/integrations/github_enterprise/`

### Existing RPC Infrastructure

Sentry has an internal RPC framework for cross-silo communication that IS NOT RELEVANT FOR THIS PROJECT:

#### Hybrid Cloud RPC (`src/sentry/hybridcloud/rpc/`)

- **Purpose**: Communication between control and region silos
- **Transport**: HTTP/1.1 with JSON serialization
- **Authentication**: HMAC-SHA256 signatures
- **Pattern**: Not suitable for external services (requires full codebase)

### Current gRPC Usage

Sentry already uses gRPC in specific areas:

#### TaskWorker Client (`src/sentry/taskworker/client/client.py`)

- Uses `grpcio>=1.67.0` and `protobuf>=5.27.3`
- Connects to external TaskBroker service
- Implements `RequestSignatureInterceptor` for auth
- All protobuf definitions from `sentry-protos` package

#### Key Pattern

- No `.proto` files in repository
- Client-only implementation (no gRPC servers)
- Uses pre-compiled protobuf from external package

## Part 2: gRPC Implementation Design

### Proposed Architecture

```
External Services
        │
        ▼ (gRPC-Web over HTTP/1.1)
┌──────────────┐
│   nginx/ALB  │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│   Django + grpcWSGI  │
│   (Single Process)   │
├──────────────────────┤
│ - REST APIs (/api)   │
│ - gRPC-Web (/grpc)   │
│ - SCM Abstraction    │
└──────────────────────┘
```

### Why grpcWSGI?

**Sonora's grpcWSGI** enables gRPC without a separate server:

- Wraps existing WSGI application
- Detects gRPC-Web requests by content-type
- Routes to registered services
- Falls through to Django for regular HTTP
- Works with HTTP/1.1 (no HTTP/2 required)

## Part 3: Implementation Plan

### Step 1: Install Dependencies

Add to `pyproject.toml`:

```toml
# gRPC and protobuf (already present)
grpcio = ">=1.67.0"
protobuf = ">=5.27.3"

# New additions
grpcWSGI = ">=1.0.0"  # Sonora's WSGI middleware
mypy-protobuf = ">=3.5.0"  # Type stubs for protobuf
```

### Step 2: Define Proto Service

Create `src/sentry/integrations/grpc/protos/scm.proto`:

```protobuf
syntax = "proto3";

package sentry.integrations.scm.v1;

import "google/protobuf/timestamp.proto";
import "google/protobuf/empty.proto";

// SCM Service provides access to source control management operations
service ScmService {
  // Repository operations
  rpc ListRepositories(ListRepositoriesRequest) returns (ListRepositoriesResponse);
  rpc GetRepository(GetRepositoryRequest) returns (Repository);
  rpc CreateRepository(CreateRepositoryRequest) returns (Repository);
  rpc UpdateRepository(UpdateRepositoryRequest) returns (Repository);
  rpc DeleteRepository(DeleteRepositoryRequest) returns (google.protobuf.Empty);

  // Commit operations
  rpc GetCommit(GetCommitRequest) returns (Commit);
  rpc ListCommits(ListCommitsRequest) returns (ListCommitsResponse);
  rpc GetCommitContext(GetCommitContextRequest) returns (CommitContext);

  // Code mapping operations
  rpc CreateCodeMapping(CreateCodeMappingRequest) returns (CodeMapping);
  rpc UpdateCodeMapping(UpdateCodeMappingRequest) returns (CodeMapping);
  rpc DeleteCodeMapping(DeleteCodeMappingRequest) returns (google.protobuf.Empty);
  rpc DeriveCodeMappings(DeriveCodeMappingsRequest) returns (DeriveCodeMappingsResponse);

  // Issue integration
  rpc CreateExternalIssue(CreateExternalIssueRequest) returns (ExternalIssue);
  rpc LinkExternalIssue(LinkExternalIssueRequest) returns (ExternalIssue);
  rpc SyncIssueStatus(SyncIssueStatusRequest) returns (google.protobuf.Empty);

  // Search operations
  rpc SearchRepositories(SearchRepositoriesRequest) returns (SearchRepositoriesResponse);
  rpc SearchCode(SearchCodeRequest) returns (SearchCodeResponse);
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
  repeated FileChange file_changes = 7;
}

message CommitAuthor {
  string name = 1;
  string email = 2;
  string external_id = 3;
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
  string key = 4;  // e.g., "JIRA-123"
  string title = 5;
  string description = 6;
  string web_url = 7;
  map<string, string> metadata = 8;
}

// Enums
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

// Request/Response messages for each RPC method
// (See full proto definition in implementation section)
```

### Step 3: Generate Python Code

Create generation script:

```bash
python -m grpc_tools.protoc \
  -I./src/sentry/integrations/grpc/protos \
  --python_out=./src/sentry/integrations/grpc/generated \
  --grpc_python_out=./src/sentry/integrations/grpc/generated \
  --mypy_out=./src/sentry/integrations/grpc/generated \
  --mypy_grpc_out=./src/sentry/integrations/grpc/generated \
  ./src/sentry/integrations/grpc/protos/scm.proto
```

### Step 4: Implement Service

Think hard as you write this service. These services should be as small as possible. Almost all the steps will be the same: 1) fetch the integration installation (important for authorization), run an SCM abstract level function and return the results. If we can dynamically generate these methods based on base class methods and consistent logic, is ideal.

Create `src/sentry/integrations/grpc/services/scm_service.py`:

```python
import grpc
from sentry.integrations.grpc.generated import scm_pb2, scm_pb2_grpc
from sentry.integrations.services.repository import repository_service
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.integrations.manager import integrations
from sentry.models import Repository, Commit

class ScmServicer(scm_pb2_grpc.ScmServiceServicer):
    """gRPC service implementation for SCM operations."""

    def _get_integration(self, organization_id: int, provider: str) -> RepositoryIntegration:
        """Get the repository integration for an organization."""
        integration = integrations.get(provider)
        return integration.get_installation(organization_id)

    def ListRepositories(
        self,
        request: scm_pb2.ListRepositoriesRequest,
        context: grpc.ServicerContext
    ) -> scm_pb2.ListRepositoriesResponse:
        """List repositories for an organization."""

        # Use existing repository service
        repos = repository_service.get_repositories(
            organization_id=request.organization_id
        )

        response = scm_pb2.ListRepositoriesResponse()
        for repo in repos:
            pb_repo = scm_pb2.Repository(
                id=repo.id,
                organization_id=request.organization_id,
                name=repo.name,
                url=repo.url or "",
                provider=self._provider_to_proto(repo.provider),
                external_id=repo.external_id or "",
                status=self._status_to_proto(repo.status),
            )
            response.repositories.append(pb_repo)

        return response

    def GetCommitContext(
        self,
        request: scm_pb2.GetCommitContextRequest,
        context: grpc.ServicerContext
    ) -> scm_pb2.CommitContext:
        """Get commit context (blame) for a file location."""

        repo = Repository.objects.get(id=request.repository_id)
        integration = self._get_integration(
            repo.organization_id,
            repo.provider
        )

        # Call into existing SCM abstraction
        blame_info = integration.get_commit_context(
            repo=repo,
            filepath=request.filepath,
            commitsha=request.commit_sha,
            line_no=request.line_number
        )

        if not blame_info:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details("Blame information not available")
            return scm_pb2.CommitContext()

        return scm_pb2.CommitContext(
            repository_id=request.repository_id,
            commit_id=request.commit_sha,
            filename=request.filepath,
            line_number=request.line_number,
            blame_commit_id=blame_info.get("commitId", ""),
            blame_author=scm_pb2.CommitAuthor(
                name=blame_info.get("author", {}).get("name", ""),
                email=blame_info.get("author", {}).get("email", ""),
            ),
            code_snippet=blame_info.get("code", ""),
        )

    # Additional methods implementation...
```

### Step 5: Integrate with WSGI

Modify `src/sentry/wsgi.py`:

```python
"""
WSGI configuration for Sentry with gRPC-Web support.
"""
from django.core.wsgi import get_wsgi_application

# Initialize Django
application = get_wsgi_application()

# Add gRPC-Web support via Sonora's grpcWSGI
try:
    from sonora.wsgi import grpcWSGI
    from sentry.integrations.grpc.generated import scm_pb2_grpc
    from sentry.integrations.grpc.services.scm_service import ScmServicer

    # Wrap Django application with gRPC-Web middleware
    application = grpcWSGI(application)

    # Register gRPC services
    scm_pb2_grpc.add_ScmServiceServicer_to_server(
        ScmServicer(),
        application
    )

except ImportError:
    # grpcWSGI not installed, continue with regular WSGI
    import logging
    logger = logging.getLogger(__name__)
    logger.info("grpcWSGI not available, gRPC-Web endpoints disabled")

# Existing warmup code continues...
```

### Step 6: Add Authentication

Create `src/sentry/integrations/grpc/interceptors/auth.py`:

```python
import grpc
import hmac
import hashlib
from django.conf import settings

class AuthenticationInterceptor(grpc.ServerInterceptor):
    """Authenticate gRPC requests using API keys or HMAC signatures."""

    def intercept_service(self, continuation, handler_call_details):
        metadata = dict(handler_call_details.invocation_metadata or [])

        # Check for API key authentication
        api_key = metadata.get('x-api-key')
        if api_key and self._validate_api_key(api_key):
            return continuation(handler_call_details)

        # Check for HMAC signature (similar to existing RPC)
        signature = metadata.get('x-signature')
        if signature and self._validate_signature(signature, handler_call_details):
            return continuation(handler_call_details)

        # No valid authentication
        return self._unauthenticated()

    def _validate_api_key(self, api_key: str) -> bool:
        """Validate API key against database."""
        from sentry.models import ApiKey
        try:
            key = ApiKey.objects.get_from_cache(key=api_key)
            return key.status == ApiKeyStatus.ACTIVE
        except ApiKey.DoesNotExist:
            return False

    def _validate_signature(self, signature: str, handler_call_details) -> bool:
        """Validate HMAC signature."""
        if not settings.RPC_SHARED_SECRET:
            return False

        expected = self._generate_signature(handler_call_details)
        return hmac.compare_digest(signature, expected)
```

### Step 7: Client Generation

Create client generation script for external services:

```bash
#!/bin/bash
# generate_client.sh - Generate gRPC client in various languages

PROTO_DIR="./protos"
OUTPUT_DIR="./generated"

# Python client
python -m grpc_tools.protoc \
  -I${PROTO_DIR} \
  --python_out=${OUTPUT_DIR}/python \
  --grpc_python_out=${OUTPUT_DIR}/python \
  ${PROTO_DIR}/scm.proto

```

### Step 8: Example Client Usage

Python client example:

```python
import grpc
from generated import scm_pb2, scm_pb2_grpc

# Connect to Sentry's gRPC-Web endpoint
channel = grpc.insecure_channel('sentry.example.com:443')
stub = scm_pb2_grpc.ScmServiceStub(channel)

# Add authentication
metadata = [('x-api-key', 'your-api-key')]

# List repositories
request = scm_pb2.ListRepositoriesRequest(
    organization_id=12345,
    provider=scm_pb2.PROVIDER_GITHUB,
    page_size=50
)

response = stub.ListRepositories(request, metadata=metadata)
for repo in response.repositories:
    print(f"Repository: {repo.name} ({repo.url})")

# Get commit context
context_request = scm_pb2.GetCommitContextRequest(
    repository_id=repo.id,
    commit_sha="abc123",
    filepath="src/main.py",
    line_number=42
)

context = stub.GetCommitContext(context_request, metadata=metadata)
print(f"Blame: {context.blame_author.name} at {context.blame_commit_id}")
```

## Part 4: Testing Strategy

### Unit Tests

Create `tests/sentry/integrations/grpc/test_scm_service.py`:

```python
import pytest
from unittest.mock import Mock, patch
from sentry.integrations.grpc.services.scm_service import ScmServicer
from sentry.integrations.grpc.generated import scm_pb2

class TestScmService:
    def setup_method(self):
        self.servicer = ScmServicer()

    def test_list_repositories(self):
        request = scm_pb2.ListRepositoriesRequest(
            organization_id=1,
            provider=scm_pb2.PROVIDER_GITHUB
        )

        with patch('sentry.integrations.services.repository.repository_service.get_repositories') as mock_get:
            mock_get.return_value = [
                Mock(id=1, name="test-repo", url="https://github.com/test/repo")
            ]

            response = self.servicer.ListRepositories(request, Mock())

            assert len(response.repositories) == 1
            assert response.repositories[0].name == "test-repo"
```

### Integration Tests

```python
def test_grpc_web_integration(client):
    """Test gRPC-Web endpoint through Django test client."""

    # gRPC-Web uses POST with special headers
    response = client.post(
        '/grpc/sentry.integrations.scm.v1.ScmService/ListRepositories',
        data=scm_pb2.ListRepositoriesRequest(
            organization_id=1
        ).SerializeToString(),
        content_type='application/grpc-web+proto',
        HTTP_X_API_KEY='test-key'
    )

    assert response.status_code == 200
    assert response['content-type'] == 'application/grpc-web+proto'

    # Parse response
    resp_proto = scm_pb2.ListRepositoriesResponse()
    resp_proto.ParseFromString(response.content)
    assert len(resp_proto.repositories) > 0
```

## Part 5: Key Operations Exposed

### Repository Management

- List repositories by organization
- Create/update/delete repository connections
- Sync repository metadata

### Commit Operations

- Get commit details
- Get commit context (blame)
- List commits for a repository
- Get file changes for commits

### Code Mapping

- Create/update/delete code mappings
- Derive code mappings from stack traces
- Get code owners information

### Issue Integration

- Create external issues in SCM providers
- Link Sentry issues to external issues
- Sync issue status bidirectionally

### Search Operations

- Search repositories
- Search code within repositories
- Search issues in external trackers

## Benefits of This Approach

1. **No separate server required** - grpcWSGI runs in the same WSGI process
2. **Reuses existing code** - Calls into existing SCM abstraction layer
3. **Multi-language clients** - Proto files generate clients for any language
4. **Type safety** - Protobuf provides strong typing across service boundaries
5. **API versioning** - Proto files provide clear API contracts
6. **Minimal infrastructure changes** - Just a middleware wrapper

## Considerations

1. **Performance**: gRPC-Web over HTTP/1.1 won't have the same performance as native gRPC
2. **Streaming**: Limited to server streaming only with gRPC-Web
3. **Monitoring**: Add OpenTelemetry instrumentation for gRPC calls
4. **Documentation**: Generate API docs from proto files using protoc-gen-doc
5. **Breaking changes**: Use buf for detecting breaking changes in proto files
6. **Authentication**: Reuse existing API key infrastructure

## Alternative: REST-to-gRPC Gateway

If gRPC adoption is slow, add REST endpoints that internally use gRPC:

```python
@api_endpoint
def list_repositories_rest(request, organization_id):
    # Create gRPC request
    grpc_request = scm_pb2.ListRepositoriesRequest(
        organization_id=organization_id
    )

    # Call gRPC service
    response = servicer.ListRepositories(grpc_request, None)

    # Convert to JSON
    return JsonResponse({
        'repositories': [MessageToDict(repo) for repo in response.repositories]
    })
```

## File References

### SCM Abstraction Layer

- `src/sentry/integrations/source_code_management/repository.py` - Core abstraction classes
- `src/sentry/integrations/github/repository.py` - GitHub implementation
- `src/sentry/integrations/gitlab/repository.py` - GitLab implementation
- `src/sentry/integrations/bitbucket/repository.py` - Bitbucket implementation

### Existing gRPC Usage

- `src/sentry/taskworker/client/client.py` - TaskWorker gRPC client
- `pyproject.toml:43,57` - gRPC dependencies

### WSGI Configuration

- `src/sentry/wsgi.py` - WSGI application entry point
- `src/sentry/services/http.py:67` - HTTP protocol configuration

### Existing Services

- `src/sentry/integrations/services/repository/` - Basic repository service
- `src/sentry/hybridcloud/rpc/` - Internal RPC framework (not for external use)

## Conclusion

This implementation provides a production-ready gRPC interface for external services to consume Sentry's SCM integration layer without requiring additional infrastructure. The grpcWSGI approach integrates seamlessly with the existing Django WSGI application while maintaining full compatibility with current REST APIs.
