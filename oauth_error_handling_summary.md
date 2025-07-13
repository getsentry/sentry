# OAuth Error Handling with Sentry Event IDs

## Summary

This implementation adds Sentry event ID capture and reporting to OAuth error flows, similar to how it's done elsewhere in the codebase. When OAuth errors occur, the system now:

1. Captures the error as a Sentry event
2. Includes the event ID in JSON error responses
3. Displays the event ID in error dialogs/templates

## Files Modified

### 1. `src/sentry/web/frontend/oauth_token.py`

**Changes Made:**
- Added `import sentry_sdk` (already present)
- Modified the `error()` method to capture Sentry events when OAuth token errors occur
- Added event ID to the JSON response payload as `"errorId"`

**Key Implementation:**
```python
def error(self, request: HttpRequest, name, reason=None, status=400):
    # ... existing code ...

    # Capture the error as a Sentry event
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("oauth_error", name)
        scope.set_extra("client_id", client_id)
        scope.set_extra("redirect_uri", redirect_uri)
        scope.set_extra("reason", reason)
        scope.set_extra("status", status)
        event_id = sentry_sdk.capture_message(
            f"OAuth token error: {name}",
            level="error"
        )

    # ... logging code ...

    error_response = {"error": name}
    if event_id:
        error_response["errorId"] = event_id

    return HttpResponse(
        json.dumps(error_response), content_type="application/json", status=status
    )
```

### 2. `src/sentry/identity/oauth2.py`

**Changes Made:**
- Modified the `OAuth2CallbackView.dispatch()` method to capture Sentry events for all OAuth2 error scenarios
- Added event ID to error messages passed to `pipeline.error()`
- Enhanced error context with provider information and error details

**Key Implementation:**
- For each error condition (invalid state, no code, token exchange errors, etc.), the code now:
  1. Captures the error as a Sentry event with relevant context
  2. Appends the event ID to the error message
  3. Passes the event ID to `pipeline.error()`

**Example for invalid state error:**
```python
if state != pipeline.fetch_state("state"):
    # ... existing logging code ...

    # Capture the error as a Sentry event
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("oauth_error", "invalid_state")
        scope.set_extra("provider", pipeline.provider.key)
        scope.set_extra("state", state)
        scope.set_extra("pipeline_state", pipeline.fetch_state("state"))
        scope.set_extra("code", code)
        event_id = sentry_sdk.capture_message(
            f"OAuth2 invalid state error",
            level="error"
        )

    error_message = ERR_INVALID_STATE
    if event_id:
        error_message += f"\nEvent ID: {event_id}"

    return pipeline.error(error_message, event_id=event_id)
```

### 3. `src/sentry/pipeline/base.py`

**Changes Made:**
- Modified the `error()` method to accept an optional `event_id` parameter
- Added event ID to the template context when available
- Enhanced logging to include event ID

**Key Implementation:**
```python
def error(self, message: str, event_id: str | None = None) -> HttpResponseBase:
    self.get_logger().error(
        f"PipelineError: {message}",
        extra={
            "organization_id": self.organization.id if self.organization else None,
            "provider": self.provider.key,
            "error": message,
            "event_id": event_id,
        },
    )

    context = {"error": message}
    if event_id:
        context["event_id"] = event_id

    return render_to_response(
        template="sentry/pipeline-error.html",
        context=context,
        request=self.request,
    )
```

### 4. `src/sentry/templates/sentry/pipeline-error.html`

**Changes Made:**
- Added display of event ID when available
- Styled the event ID display to match the existing error template patterns

**Key Implementation:**
```html
<pre>{{ error }}</pre>

{% if event_id %}
<p style="margin-top: 20px; color: #666; font-size: 14px;">
  <strong>Event ID:</strong> {{ event_id }}
</p>
{% endif %}
```

## How It Works

1. **OAuth Token Errors**: When `/oauth/token/` endpoint encounters an error, it now captures the error as a Sentry event and includes the event ID in the JSON response as `"errorId"`.

2. **OAuth2 Identity Provider Errors**: During OAuth2 authentication flows, any errors (invalid state, missing code, token exchange failures, etc.) are captured as Sentry events, and the event ID is included in the error message displayed to users.

3. **Pipeline Error Display**: The generic pipeline error template now displays event IDs when they're available, making it easier for users to report issues and for developers to debug problems.

## Benefits

- **Better Error Tracking**: All OAuth errors are now captured in Sentry with proper context
- **User-Friendly Error Reporting**: Users can provide event IDs when reporting issues
- **Developer Debugging**: Developers can quickly find and debug specific error instances
- **Consistency**: Follows the same pattern used elsewhere in the Sentry codebase

## Error Response Format

JSON error responses now include event IDs:

```json
{
  "error": "invalid_grant",
  "errorId": "abc123def456..."
}
```

## Template Display

Error pages now show event IDs:

```
Whoops! Looks like something went wrong! Give that another try.

OAuth2 invalid state error
Event ID: abc123def456...

Event ID: abc123def456...
```

This implementation addresses the original issue mentioned in the Slack thread where "errors should be exposing an eventID with them" and makes it so "sentry can monitor its own errors" effectively.
