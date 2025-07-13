# OAuth Error Handling with Sentry Event IDs - Minimal Implementation

## Summary

This implementation adds Sentry event ID reporting **only** where Sentry events were already being captured in the OAuth flows. Following the user's requirement to remove all new telemetry except where we already recorded to Sentry.

## File Modified

### `src/sentry/identity/oauth2.py`

**Changes Made:**
- Modified the existing `sentry_sdk.capture_exception(exc)` call in the `exchange_token` method to capture and use the event ID
- Added event ID to the JSON response payload as `"errorId"` only for this specific error case

**Key Implementation:**
```python
def exchange_token(self, request: HttpRequest, pipeline: IdentityPipeline, code: str) -> dict[str, str]:
    with record_event(IntegrationPipelineViewType.TOKEN_EXCHANGE, pipeline.provider.key).capture() as lifecycle:
        try:
            req: Response = self.get_access_token(pipeline, code)
            req.raise_for_status()
        except HTTPError as e:
            error_resp = e.response
            exc = ApiError.from_response(error_resp, url=self.access_token_url)
            event_id = sentry_sdk.capture_exception(exc)  # <-- Modified existing capture
            lifecycle.record_failure(exc)
            error_response = {
                "error": f"Could not retrieve access token. Received {exc.code}: {exc.text}",
            }
            if event_id:
                error_response["errorId"] = event_id  # <-- Added event ID to response
            return error_response
        # ... other exception handlers remain unchanged
```

## What Was Removed

All the new telemetry I initially added was removed, including:
- New Sentry captures in `OAuthTokenView.error()`
- New Sentry captures in `OAuth2CallbackView.dispatch()` for various error conditions
- Pipeline error method modifications
- Template changes for event ID display

## What Remains

Only the **one existing place** where Sentry was already capturing exceptions now also includes the event ID in the response:
- The HTTPError exception handler in `exchange_token` method
- This was already calling `sentry_sdk.capture_exception(exc)`
- Now it captures the returned event ID and includes it in the JSON response

## Error Response Format

Only the HTTPError case in token exchange now includes event IDs:

```json
{
  "error": "Could not retrieve access token. Received 400: invalid_grant",
  "errorId": "abc123def456..."
}
```

All other OAuth errors remain exactly as they were before, with no new telemetry added.

## Benefits

- **Minimal Impact**: Only touches code that was already sending data to Sentry
- **Debugging**: The specific "invalid_grant" error mentioned in the Slack thread can now be tracked with event IDs
- **Consistency**: Follows the same `"errorId"` pattern used elsewhere in the codebase
- **No New Telemetry**: Respects the requirement to not add new Sentry captures

This focused implementation addresses the core issue (invalid_grant errors not having event IDs) without adding telemetry beyond what was already there.
