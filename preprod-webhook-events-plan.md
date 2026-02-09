# Preprod Artifact Webhook Events Plan

## Overview

Add new webhook event types to the Integration Platform for when artifact size processing and build distribution finishes. This allows Sentry Apps to subscribe to these events and receive notifications (e.g., for custom Slack integrations).

## Event Types

- `artifact.size_completed` - Fired when size metrics processing completes
- `artifact.distribution_completed` - Fired when installable app processing completes

## Permission Scope

`project:read` - Since preprod artifacts are project-scoped

## Files to Modify

### 1. `src/sentry/sentry_apps/utils/webhooks.py`

Add resource and action type enums:

```python
class ArtifactActionType(SentryAppActionType):
    SIZE_COMPLETED = "size_completed"
    DISTRIBUTION_COMPLETED = "distribution_completed"

# Add to SentryAppResourceType enum:
ARTIFACT = "artifact"

# Add to EVENT_EXPANSION mapping:
SentryAppResourceType.ARTIFACT: SentryAppResourceType.map_sentry_app_webhook_events(
    SentryAppResourceType.ARTIFACT.value, ArtifactActionType
),
```

### 2. `src/sentry/sentry_apps/metrics.py`

Add event type enum entries:

```python
class SentryAppEventType(StrEnum):
    # ... existing entries
    ARTIFACT_SIZE_COMPLETED = "artifact.size_completed"
    ARTIFACT_DISTRIBUTION_COMPLETED = "artifact.distribution_completed"
```

### 3. `src/sentry/sentry_apps/models/sentry_app.py`

Add permission mapping:

```python
REQUIRED_EVENT_PERMISSIONS = {
    # ... existing entries
    "artifact": "project:read",
}
```

### 4. `src/sentry/sentry_apps/tasks/sentry_apps.py` (or new file)

Create webhook sending task:

```python
@instrumented_task(
    name="sentry.sentry_apps.tasks.sentry_apps.send_artifact_webhook",
    # ... task config
)
def send_artifact_webhook(artifact_id: int, event: str, **kwargs) -> None:
    # Load artifact, prepare payload, send webhook
    pass
```

### 5. `src/sentry/preprod/tasks.py`

Trigger webhooks at completion points:

- **Size completed**: After `PreprodArtifactSizeMetrics` reaches `COMPLETED` state in `assemble_preprod_artifact_size_analysis` (around line 680)
- **Distribution completed**: After `installable_app_file_id` is set in `assemble_preprod_artifact_installable_app`

### 6. Tests

Add tests in `tests/sentry/sentry_apps/` for the new webhook events.

## Payload Structure

### `artifact.size_completed`

```json
{
  "action": "size_completed",
  "data": {
    "artifact_id": "123",
    "project": {"id": "456", "slug": "my-app"},
    "organization": {"id": "789", "slug": "my-org"},
    "app_name": "My App",
    "build_version": "1.2.3",
    "build_number": "42",
    "platform": "ios",
    "size_metrics": [
      {
        "type": "main_artifact",
        "identifier": null,
        "min_install_size": 12345678,
        "max_install_size": 15000000,
        "min_download_size": 8000000,
        "max_download_size": 10000000
      },
      {
        "type": "watch_artifact",
        "identifier": null,
        "min_install_size": 1234567,
        "max_install_size": 1500000,
        "min_download_size": 800000,
        "max_download_size": 1000000
      }
    ],
    "web_url": "https://sentry.io/organizations/my-org/projects/my-app/preprod/artifacts/123/"
  }
}
```

### `artifact.distribution_completed`

```json
{
  "action": "distribution_completed",
  "data": {
    "artifact_id": "123",
    "project": {"id": "456", "slug": "my-app"},
    "organization": {"id": "789", "slug": "my-org"},
    "app_name": "My App",
    "build_version": "1.2.3",
    "build_number": "42",
    "platform": "ios",
    "web_url": "https://sentry.io/organizations/my-org/projects/my-app/preprod/artifacts/123/"
  }
}
```

## Size Metric Types

From `PreprodArtifactSizeMetricsType`:

- `main_artifact` - Primary app artifact
- `watch_artifact` - watchOS companion app
- `android_dynamic_feature` - Android dynamic feature module (uses `identifier` field)

## Completion Points in Code

### Size Metrics Completion

- File: `src/sentry/preprod/tasks.py`
- Function: `assemble_preprod_artifact_size_analysis`
- State transition: `PreprodArtifactSizeMetrics` → `COMPLETED`

### Distribution Completion

- File: `src/sentry/preprod/tasks.py`
- Function: `assemble_preprod_artifact_installable_app`
- Trigger: `installable_app_file_id` is set on `PreprodArtifact`

## Reference: Existing Webhook Pattern

Look at how `issue.created` or `error.created` events are sent for implementation reference:

- `src/sentry/sentry_apps/tasks/sentry_apps.py` - `process_resource_change_bound`
- `src/sentry/receivers/sentry_apps.py` - Signal receivers
