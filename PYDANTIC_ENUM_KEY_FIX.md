# Pydantic v1 Enum Key Serialization Bug Fix

## Summary

Fixed a critical bug in the webhook payload validation that would cause runtime crashes for all `PULL_REQUEST` and `ISSUE_COMMENT` webhook events.

## The Problem

### Root Cause

The `SeerCodeReviewTaskRequest` Pydantic model defines a `features` dictionary with enum keys:

```python
class SeerCodeReviewConfig(BaseModel):
    features: dict[SeerCodeReviewFeature, bool] = Field(default_factory=lambda: {})
```

When Pydantic v1 parses JSON with string keys (e.g., `{"bug_prediction": true}`), it automatically converts them to enum members (`SeerCodeReviewFeature.BUG_PREDICTION`).

The original code attempted to serialize this validated payload:

```python
validated_payload = SeerCodeReviewTaskRequest.parse_obj(event_payload)
payload = json.loads(validated_payload.json())  # This would fail!
```

### Why It Failed

Pydantic v1's `.json()` method cannot serialize dictionaries with non-primitive keys like enums. JSON requires string keys, but the dict had enum objects as keys, causing a `TypeError` at runtime.

## The Solution

### 1. Fixed the Enum Key Serialization

Created a helper function to recursively convert enum keys to their string values:

```python
def convert_enum_keys_to_strings(obj: Any) -> Any:
    """
    Recursively convert enum keys in dictionaries to their string values.

    This is needed because Pydantic v1 converts string keys to enum members when parsing,
    but JSON serialization requires string keys.
    """
    if isinstance(obj, dict):
        return {
            (k.value if isinstance(k, Enum) else k): convert_enum_keys_to_strings(v)
            for k, v in obj.items()
        }
    elif isinstance(obj, list):
        return [convert_enum_keys_to_strings(item) for item in obj]
    elif isinstance(obj, Enum):
        return obj.value
    else:
        return obj
```

### 2. Added Feature Flag for Validation

Added a new option `seer.code_review.validate_webhook_payload` (default: `False`) to control whether validation happens:

```python
should_validate = options.get("seer.code_review.validate_webhook_payload", False)
if should_validate and github_event != GithubWebhookType.CHECK_RUN:
    validated_payload = SeerCodeReviewTaskRequest.parse_obj(event_payload)
    # Convert to dict and handle enum keys
    payload = convert_enum_keys_to_strings(validated_payload.dict())
else:
    payload = event_payload
```

### 3. Benefits

- **Safe Deployment**: Validation is disabled by default, preventing immediate breakage
- **Gradual Rollout**: Can be enabled incrementally to test in production
- **Proper Fix**: When enabled, the validation works correctly with enum key conversion

## Testing

Added comprehensive tests:

1. **Unit tests** for `convert_enum_keys_to_strings`:
   - Enum key conversion
   - Enum value conversion
   - Nested structure handling
   - Non-enum value preservation
   - Real `SeerCodeReviewFeature` enum handling

2. **Integration tests**:
   - Validation enabled: verifies enum keys are properly converted to strings
   - Validation disabled: verifies payload passes through without modification

All 26 tests in `test_webhooks.py` pass.

## Files Changed

1. `src/sentry/seer/code_review/webhooks/task.py`
   - Added `convert_enum_keys_to_strings` helper function
   - Modified `process_github_webhook_event` to use feature flag and proper serialization
   - Added imports for `Enum` and `options`

2. `src/sentry/options/defaults.py`
   - Registered new option: `seer.code_review.validate_webhook_payload`

3. `tests/sentry/seer/code_review/test_webhooks.py`
   - Added `TestConvertEnumKeysToStrings` test class with 5 unit tests
   - Added integration tests for validation feature flag

## Deployment Plan

1. Deploy with validation disabled (current default)
2. Monitor for any issues
3. Enable validation in staging environment
4. Test thoroughly with real webhook payloads
5. Gradually roll out to production using the feature flag
6. Once stable, consider making validation the default

## Related Issues

This fix resolves the runtime crash that would occur when:

- Processing `PULL_REQUEST` webhook events with feature flags
- Processing `ISSUE_COMMENT` webhook events with feature flags
- Any webhook that includes the `SeerCodeReviewConfig.features` dictionary
