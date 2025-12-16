# GitHub Webhook Pydantic Validation Implementation

## Summary

This implementation adds Pydantic validation to GitHub webhook payloads in Sentry. The changes ensure that incoming webhook events from GitHub are validated against well-defined schemas before processing, improving data integrity and catching malformed payloads early.

## Changes Made

### 1. New File: `src/sentry/integrations/github/webhook_models.py`

Created comprehensive Pydantic models for all supported GitHub webhook events:

- **`GitHubUser`**: Represents a GitHub user in webhook payloads
- **`GitHubRepository`**: Represents a GitHub repository
- **`GitHubInstallation`**: Represents a GitHub App installation
- **`GitHubCommitAuthor`**: Represents a commit author
- **`GitHubCommit`**: Represents a commit with file changes
- **`GitHubPullRequest`**: Represents a pull request
- **`GitHubIssue`**: Represents a GitHub issue

Event-specific payload models:
- **`PushEventPayload`**: Validates push event webhooks
- **`PullRequestEventPayload`**: Validates pull request event webhooks
- **`IssuesEventPayload`**: Validates issues event webhooks
- **`InstallationEventPayload`**: Validates installation event webhooks

#### Key Design Decisions:

1. **Flexible Validation**: All models use `extra = "allow"` configuration to accept additional fields that GitHub may add in the future, ensuring forward compatibility.

2. **Optional Fields**: Most fields are marked as optional (`| None`) to handle variations in webhook payloads across different GitHub event types and versions.

3. **Required Fields Only**: Only critical fields that are actually used in the codebase are marked as required (e.g., `login` and `id` for users, `ref` and `commits` for push events).

### 2. Updated: `src/sentry/integrations/github/webhook.py`

#### Imports Added:
```python
from pydantic import ValidationError
from sentry.integrations.github.webhook_models import (
    InstallationEventPayload,
    IssuesEventPayload,
    PullRequestEventPayload,
    PushEventPayload,
)
```

#### Webhook Handlers Updated:

Each webhook handler class now includes a `payload_model` property that returns the appropriate Pydantic model:

- `InstallationEventWebhook.payload_model` → `InstallationEventPayload`
- `PushEventWebhook.payload_model` → `PushEventPayload`
- `IssuesEventWebhook.payload_model` → `IssuesEventPayload`
- `PullRequestEventWebhook.payload_model` → `PullRequestEventPayload`

#### Validation Logic in `GitHubIntegrationsWebhookEndpoint.handle()`:

Added validation step after JSON parsing:

```python
# Validate payload using Pydantic if handler has a payload_model
if hasattr(event_handler, "payload_model"):
    try:
        event_handler.payload_model(**event)
    except ValidationError as e:
        logger.warning(
            "github.webhook.invalid-payload",
            extra={
                **self.get_logging_data(),
                "event_type": request.META.get("HTTP_X_GITHUB_EVENT"),
                "validation_errors": e.errors(),
            },
        )
        return HttpResponse(status=400)
```

### 3. Updated: `src/sentry/integrations/github_enterprise/webhook.py`

#### Imports Added:
```python
from pydantic import ValidationError
```

#### Validation Logic in `GitHubEnterpriseWebhookBase._handle()`:

Added the same validation logic as the main GitHub webhook handler:

```python
# Validate payload using Pydantic if handler has a payload_model
if hasattr(event_handler, "payload_model"):
    try:
        event_handler.payload_model(**event)
    except ValidationError as e:
        logger.warning(
            "github_enterprise.webhook.invalid-payload",
            extra={
                **extra,
                "event_type": github_event,
                "validation_errors": e.errors(),
            },
        )
        sentry_sdk.capture_exception(e)
        return HttpResponse("Invalid webhook payload structure", status=400)
```

## Benefits

1. **Type Safety**: Pydantic models provide runtime type checking and validation
2. **Documentation**: Models serve as living documentation of expected webhook payload structure
3. **Error Detection**: Malformed payloads are caught early with detailed error messages
4. **Backward Compatibility**: Using `hasattr()` check ensures validation is optional and doesn't break existing functionality
5. **Forward Compatibility**: `extra = "allow"` configuration allows GitHub to add new fields without breaking validation
6. **Debugging**: Validation errors are logged with detailed information for troubleshooting

## Error Handling

- **Invalid JSON**: Returns HTTP 400 (existing behavior)
- **Invalid Signature**: Returns HTTP 401 (existing behavior)
- **Invalid Payload Structure**: Returns HTTP 400 with validation errors logged
- **Valid Payload**: Continues to process webhook as before

## Compatibility

- **Existing Tests**: All existing tests should continue to pass as the validation is non-breaking
- **GitHub API Changes**: The flexible validation approach (optional fields, extra fields allowed) ensures compatibility with future GitHub API changes
- **GitHub Enterprise**: Both GitHub.com and GitHub Enterprise webhooks are validated using the same models

## Monitoring

New log messages for tracking:
- `github.webhook.invalid-payload`: When payload validation fails (GitHub.com)
- `github_enterprise.webhook.invalid-payload`: When payload validation fails (GitHub Enterprise)

Both include:
- Event type
- Validation errors (detailed Pydantic error messages)
- Request metadata

## Future Improvements

1. **Stricter Validation**: As confidence grows, more fields could be marked as required
2. **Custom Validators**: Add Pydantic validators for business logic (e.g., email format, URL validation)
3. **Metrics**: Add metrics tracking for validation failures to monitor data quality
4. **Testing**: Add specific tests for payload validation edge cases
