# Fix Summary: Integration Not Found Error Handling (SENTRY-5CXK)

## Problem

When Seer calls the `trigger_coding_agent_launch` RPC endpoint with an `integration_id` that doesn't belong to the specified `organization_id`, the system would:

1. Raise a generic `NotFound("Integration not found")` exception
2. Return `{"success": False}` without any error details
3. Provide minimal logging context to help debug the issue

This made it difficult to:

- Understand why the integration lookup failed
- Debug integration configuration issues
- Distinguish between different failure scenarios (not connected vs. inactive vs. wrong provider)

## Root Cause

The `_validate_and_get_integration` function in `src/sentry/seer/autofix/coding_agent.py` was checking if the OrganizationIntegration exists and is active, but:

- Used a single generic error message for all failure cases
- Didn't log the specific reason for failure
- Didn't provide enough context in error messages

The RPC endpoint wrapper in `src/sentry/seer/endpoints/seer_rpc.py` caught exceptions but:

- Didn't return error details to the caller (Seer)
- Made it impossible for Seer to understand what went wrong

## Solution

### 1. Enhanced Error Messages

Modified `_validate_and_get_integration` to provide specific error messages for each scenario:

#### Before:

```python
if not org_integration or org_integration.status != ObjectStatus.ACTIVE:
    raise NotFound("Integration not found")
```

#### After:

```python
if not org_integration:
    raise NotFound(
        f"Integration {integration_id_int} is not connected to organization {organization.id}"
    )

if org_integration.status != ObjectStatus.ACTIVE:
    raise NotFound(
        f"Integration {integration_id_int} is not active for organization {organization.id}"
    )
```

### 2. Structured Logging

Added warning-level logs for each failure scenario with relevant context:

```python
logger.warning(
    "coding_agent.integration_not_connected",
    extra={
        "organization_id": organization.id,
        "integration_id": integration_id_int,
    },
)
```

Other log keys added:

- `coding_agent.integration_not_active` - Integration is disabled/pending deletion
- `coding_agent.integration_deleted` - Integration was deleted
- `coding_agent.invalid_provider` - Integration is not a coding agent provider
- `coding_agent.invalid_installation` - Installation type is incorrect

### 3. Error Details in RPC Response

Modified the RPC endpoint to return error details:

#### Before:

```python
try:
    launch_coding_agents_for_run(...)
    return {"success": True}
except (NotFound, PermissionDenied, ValidationError, APIException):
    logger.exception(...)
    return {"success": False}
```

#### After:

```python
try:
    launch_coding_agents_for_run(...)
    return {"success": True, "error": None}
except (NotFound, PermissionDenied, ValidationError, APIException) as e:
    logger.exception(..., extra={..., "error_type": type(e).__name__})
    return {"success": False, "error": str(e)}
```

## Impact

### Improved Debugging

- Specific error messages help quickly identify the issue
- Structured logs provide searchable, filterable error data
- Error details help Seer understand and handle failures appropriately

### Better Monitoring

- Each failure scenario has its own log key for tracking
- Metrics can be built on top of structured log keys
- Easier to identify patterns in integration failures

### Backward Compatibility

- Maintains existing exception types (NotFound, ValidationError)
- Adds optional `error` field to response (backward compatible)
- No breaking changes to existing callers

## Testing

### Test Coverage Added

1. **`TestValidateAndGetIntegration`** - Tests for `_validate_and_get_integration`:
   - `test_integration_not_connected_to_organization`
   - `test_integration_not_active`
   - `test_integration_deleted`
   - `test_not_a_coding_agent_integration`

2. **`TestTriggerCodingAgentLaunch`** - Tests for RPC endpoint:
   - `test_trigger_coding_agent_launch_success`
   - `test_trigger_coding_agent_launch_integration_not_found`
   - `test_trigger_coding_agent_launch_other_exception`

## Example Error Messages

### Integration Not Connected

```
Integration 999 is not connected to organization 123
```

### Integration Not Active

```
Integration 456 is not active for organization 123
```

### Wrong Provider Type

```
Not a coding agent integration
```

## Files Changed

1. `src/sentry/seer/autofix/coding_agent.py`
   - Enhanced `_validate_and_get_integration` with specific error messages and logging

2. `src/sentry/seer/endpoints/seer_rpc.py`
   - Modified `trigger_coding_agent_launch` to return error details

3. `tests/sentry/seer/autofix/test_coding_agent.py`
   - Added `TestValidateAndGetIntegration` test class

4. `tests/sentry/seer/endpoints/test_seer_rpc.py`
   - Created new test file with `TestTriggerCodingAgentLaunch` test class

## Deployment Notes

- No database migrations required
- No configuration changes needed
- No feature flags required
- Backward compatible with existing callers
- Safe to deploy without coordination
