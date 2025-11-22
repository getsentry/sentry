# gRPC-Web Integration for Sentry

This directory contains the gRPC-Web integration for Sentry's SCM (Source Code Management) service.

## Overview

The gRPC-Web integration allows external services and clients to communicate with Sentry's SCM functionality using the gRPC-Web protocol. This enables efficient, type-safe RPC calls over HTTP/1.1 and HTTP/2.

## Architecture

```
Client (gRPC-Web) → HTTP/HTTPS → Django/grpcWSGI → ScmServicer → Database
```

- **grpcWSGI (Sonora)**: Middleware that intercepts gRPC-Web requests and routes them to service handlers
- **ScmServicer**: Implementation of the SCM service that handles gRPC requests
- **Direct DB Access**: Service runs in region silo with direct database access

## Directory Structure

```
src/sentry/integrations/grpc/
├── protos/
│   └── scm.proto              # Protocol buffer definitions
├── generated/
│   ├── scm_pb2.py            # Generated message classes
│   └── scm_pb2_grpc.py       # Generated service stubs
├── services/
│   └── scm_service.py        # Service implementation
├── interceptors/
│   └── auth.py               # Authentication interceptor
├── middleware.py             # CSRF exemption middleware
└── client/
    └── scm_client.py         # Python client library
```

## Available Services

### ScmService

The SCM service provides the following RPC methods:

1. **ListRepositories**: List repositories for an organization
2. **GetRepository**: Get a specific repository by ID
3. **GetCommit**: Get commit details
4. **GetCommitContext**: Get context for a specific line in a commit
5. **CreateCodeMapping**: Create a code mapping between stack traces and source code
6. **DeriveCodeMappings**: Automatically derive code mappings from stack traces
7. **CreateExternalIssue**: Create an issue in an external tracker
8. **LinkExternalIssue**: Link a Sentry group to an external issue

## Usage

### Endpoint Format

gRPC-Web endpoints follow the format:

```
http://sentry-host/{service_name}/{method_name}
```

**Important**: Do NOT include a trailing slash for gRPC endpoints. URLs with trailing slashes will be handled by Django's URL routing instead of grpcWSGI.

Examples:

- ✓ Correct: `http://localhost:8000/sentry.integrations.scm.v1.ScmService/ListRepositories`
- ✗ Wrong: `http://localhost:8000/sentry.integrations.scm.v1.ScmService/ListRepositories/`

### Content Types

The following content types are supported:

- `application/grpc-web+proto` (binary protobuf)
- `application/grpc-web+json` (JSON encoding)
- `application/grpc-web-text` (base64 encoded)
- `application/grpc-web-text+proto` (base64 encoded protobuf)

### Message Format

gRPC-Web messages use the following format:

```
[1 byte flags][4 bytes length][message data]
```

- Flags: 0x00 = uncompressed, 0x01 = compressed
- Length: Big-endian 32-bit integer
- Message: Serialized protobuf or JSON

### Python Client Example (Using Sonora)

```python
from sentry_grpc_scm import ScmGrpcClient

# Create client using Sonora transport
client = ScmGrpcClient(
    base_url='http://localhost:8000',
    auth_token='your-auth-token'  # Optional
)

# List repositories
repos = client.list_repositories(
    organization_id=123,
    page_size=10
)
print(f"Found {len(repos)} repositories")

# Create an external issue
issue = client.create_external_issue(
    organization_id=123,
    integration_id=1,
    title="Bug Report",
    description="Issue description"
)
print(f"Created issue: {issue['key']}")
```

### Python Client Example (Low-Level)

```python
import struct
import requests
import scm_pb2

# Create request
request = scm_pb2.ListRepositoriesRequest(
    organization_id=123,
    page_size=10
)

# Serialize to gRPC-Web format
message_bytes = request.SerializeToString()
grpc_web_payload = struct.pack('!BI', 0, len(message_bytes)) + message_bytes

# Send request
response = requests.post(
    'http://localhost:8000/sentry.integrations.scm.v1.ScmService/ListRepositories',
    data=grpc_web_payload,
    headers={
        'Content-Type': 'application/grpc-web+proto',
        'X-Grpc-Auth-Token': 'your-auth-token'  # Optional authentication
    }
)

# Parse response
if response.headers.get('grpc-status') == '0':
    # Skip framing bytes and parse message
    message_data = response.content[5:]
    result = scm_pb2.ListRepositoriesResponse()
    result.ParseFromString(message_data)
    print(f"Found {len(result.repositories)} repositories")
```

### JavaScript/TypeScript Client Example

```typescript
import {ScmServiceClient} from './generated/scm_grpc_web_pb';
import {ListRepositoriesRequest} from './generated/scm_pb';

const client = new ScmServiceClient('http://localhost:8000');

const request = new ListRepositoriesRequest();
request.setOrganizationId(123);
request.setPageSize(10);

client.listRepositories(request, {}, (err, response) => {
  if (err) {
    console.error('Error:', err.message);
    return;
  }
  console.log('Repositories:', response.getRepositoriesList());
});
```

## Authentication

### Development Mode

By default, authentication is disabled in development for easier testing. All requests are allowed without credentials.

### Production Mode

To enable authentication, set in Django settings:

```python
GRPC_REQUIRE_AUTH = True
```

### Authentication Methods

1. **Token Authentication**

   ```
   X-Grpc-Auth-Token: your-auth-token
   ```

   Configure allowed tokens via Sentry options:

   ```python
   # In sentry/options/defaults.py
   register(
       "grpc.auth_tokens",
       default=["token1", "token2"],
       flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK,
   )

   # Or set via environment/config
   SENTRY_OPTIONS["grpc.auth_tokens"] = "token1,token2,token3"
   ```

2. **HMAC Signature (Service-to-Service)**

   ```
   X-Signature: hmac-sha256-signature
   X-Body: hex-encoded-request-body
   X-Method: /sentry.integrations.scm.v1.ScmService/ListRepositories
   ```

   Configure HMAC secrets via Sentry options:

   ```python
   # In sentry/options/defaults.py
   register(
       "grpc.hmac_secrets",
       default=[],
       flags=FLAG_ALLOW_EMPTY | FLAG_PRIORITIZE_DISK,
   )

   # Or set via environment/config
   SENTRY_OPTIONS["grpc.hmac_secrets"] = "secret1,secret2"
   ```

   The client automatically signs requests if secrets are configured. Multiple secrets support key rotation.

## Error Handling

gRPC status codes are returned in the `grpc-status` header:

| Code | Name              | Description                |
| ---- | ----------------- | -------------------------- |
| 0    | OK                | Success                    |
| 3    | INVALID_ARGUMENT  | Invalid request parameters |
| 5    | NOT_FOUND         | Resource not found         |
| 7    | PERMISSION_DENIED | Permission denied          |
| 13   | INTERNAL          | Internal server error      |
| 16   | UNAUTHENTICATED   | Authentication required    |

Error messages are provided in the `grpc-message` header (URL-encoded).

## Testing

### Unit Tests

```bash
pytest tests/sentry/integrations/grpc/
```

### Integration Tests

```bash
pytest tests/sentry/integrations/grpc/test_wsgi_integration.py
```

### Manual Testing

1. Start the dev server:

   ```bash
   devservices serve
   ```

2. Run the test client:
   ```bash
   python test_grpc_web_client.py
   ```

## Development

### Regenerating Protocol Buffers

When modifying `scm.proto`, regenerate the Python code:

```bash
./scripts/generate_grpc.sh
```

### Adding New Methods

1. Define the method in `protos/scm.proto`
2. Regenerate the code
3. Implement the method in `services/scm_service.py`
4. Add tests in `tests/sentry/integrations/grpc/`

### Debugging

Enable debug logging in Django settings:

```python
LOGGING = {
    'loggers': {
        'grpcWSGI': {
            'level': 'DEBUG',
        },
    }
}
```

## Performance Considerations

1. **Connection Pooling**: gRPC-Web uses HTTP, so standard HTTP connection pooling applies
2. **Message Size**: Keep messages under 4MB for optimal performance
3. **Pagination**: Use page_size and page_token for large result sets
4. **Caching**: Responses are not cached by default; implement client-side caching as needed

## Security Considerations

1. **CSRF Protection**: gRPC-Web requests are automatically exempt from CSRF checks
2. **Rate Limiting**: Standard Sentry API rate limits apply
3. **Input Validation**: All inputs are validated against protobuf schemas
4. **SQL Injection**: Uses Django ORM for database queries

## Limitations

1. **Streaming**: gRPC-Web supports server streaming but not client streaming
2. **Metadata**: grpcWSGI has limited support for gRPC metadata/headers
3. **Interceptors**: Server interceptors are not fully supported by grpcWSGI

## Troubleshooting

### Common Issues

1. **HTML Response Instead of gRPC**
   - Ensure URL has no trailing slash
   - Check Content-Type header is `application/grpc-web+proto`

2. **Authentication Failures**
   - Verify API key is active
   - Check GRPC_REQUIRE_AUTH setting

3. **404 Not Found**
   - Verify service and method names match exactly
   - Check URL path format

### Debug Checklist

- [ ] Server is running on correct port
- [ ] URL has no trailing slash
- [ ] Content-Type header is set correctly
- [ ] Request body is properly formatted (flags + length + message)
- [ ] API key is provided (if auth enabled)

## Resources

- [gRPC-Web Specification](https://github.com/grpc/grpc/blob/master/doc/PROTOCOL-WEB.md)
- [Protocol Buffers Documentation](https://developers.google.com/protocol-buffers)
- [grpcWSGI/Sonora Documentation](https://github.com/public/grpcWSGI)
- [Sentry API Documentation](https://docs.sentry.io/api/)
