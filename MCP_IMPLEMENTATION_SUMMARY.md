# MCP.json Well-Known Endpoint Implementation

## Overview
Implemented a new `/.well-known/mcp.json` endpoint for Sentry that follows the same pattern as the existing `/.well-known/security.txt` endpoint. This endpoint exposes Sentry's Multi-Cloud Platform (MCP) server configuration for external discovery.

## Files Modified

### 1. `src/sentry/web/api.py`
- Added `MCP_CONFIG` dictionary containing:
  ```json
  {
    "name": "Sentry",
    "description": "Connect to Sentry, debug faster.",
    "endpoint": "https://mcp.sentry.dev/mcp"
  }
  ```
- Added `mcp_json()` view function with:
  - Cache control (max-age=3600, public=True)
  - Self-hosted mode check (returns 404 if self-hosted)
  - JSON response with proper content-type

### 2. `src/sentry/web/urls.py`  
- Added URL pattern: `^\.well-known/mcp\.json$` pointing to `api.mcp_json`
- Named route: `sentry-mcp-json`

### 3. `tests/sentry/web/test_api.py`
- Added `McpJsonTest` class with comprehensive tests:
  - `test_mcp_json_saas_mode()`: Verifies correct JSON response in SaaS mode
  - `test_mcp_json_self_hosted_mode()`: Verifies 404 response in self-hosted mode  
  - `test_mcp_json_cache_control()`: Verifies proper cache headers

## Behavior

### SaaS Mode (sentry.io)
- **URL**: `https://sentry.io/.well-known/mcp.json`
- **Response**: 200 OK with JSON content
- **Headers**: `Cache-Control: max-age=3600, public`
- **Content-Type**: `application/json`

### Self-Hosted Mode
- **URL**: `<self-hosted-domain>/.well-known/mcp.json`
- **Response**: 404 Not Found

## Implementation Pattern
This implementation follows the exact same pattern as the existing `security.txt` endpoint:
1. Configuration constant at module level
2. View function with cache decorators and mode checks
3. URL pattern in the well-known namespace
4. Comprehensive test coverage

## Testing
All implementation files pass Python syntax validation. The tests follow the same patterns as existing web API tests and include:
- Mode-specific behavior testing
- Response content validation  
- HTTP header verification
- Status code assertions

## References
- Based on security.txt implementation from [PR #81541](https://github.com/getsentry/sentry/pull/81541)
- Follows Django view function patterns used throughout Sentry
- Uses existing Sentry mode detection (`SentryMode.SELF_HOSTED`)