# Targets and Sending — Full Reference

## Target Types

### GenericNotificationTarget (for Email)

Used when no integration is needed. The `resource_id` is the recipient's email address.

```python
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)

target = GenericNotificationTarget(
    provider_key=NotificationProviderKey.EMAIL,
    resource_type=NotificationTargetResourceType.EMAIL,
    resource_id="user@example.com",
)
```

**Real example** (from data export sending):

```python
target = GenericNotificationTarget(
    provider_key=NotificationProviderKey.EMAIL,
    resource_type=NotificationTargetResourceType.EMAIL,
    resource_id=user.email,
)
```

### IntegrationNotificationTarget (for Slack, Discord, MS Teams)

Used when sending through an integration. Requires `integration_id` and `organization_id` in addition to the base target fields.

```python
from sentry.notifications.platform.target import IntegrationNotificationTarget

target = IntegrationNotificationTarget(
    provider_key=NotificationProviderKey.SLACK,
    resource_type=NotificationTargetResourceType.CHANNEL,
    resource_id="C01ABC23DEF",  # Slack channel ID
    integration_id=integration.id,
    organization_id=organization.id,
)
```

For direct messages, use `NotificationTargetResourceType.DIRECT_MESSAGE` and the user's provider-specific ID as `resource_id`.

## Target Resource Types by Provider

| Provider | Supported resource types    |
| -------- | --------------------------- |
| Email    | `EMAIL`                     |
| Slack    | `CHANNEL`, `DIRECT_MESSAGE` |
| Discord  | `CHANNEL`, `DIRECT_MESSAGE` |
| MS Teams | `CHANNEL`, `DIRECT_MESSAGE` |

## Sending: async vs sync vs notify_target

| Method                        | Behavior                                                               | Use when                                           |
| ----------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- |
| `notify_async(targets=[...])` | Sends via Celery task. Fire-and-forget.                                | Default choice. Most notifications.                |
| `notify_sync(targets=[...])`  | Sends synchronously. Returns `dict[ProviderKey, list[str]]` of errors. | You need to report errors back to the caller.      |
| `notify_target(target=...)`   | Sends one target synchronously. Ignores notification settings.         | Low-level. Called internally by the other methods. |

All three methods require the service to be initialized with data:

```python
service = NotificationService(data=my_data)
```

### Using a Strategy

Instead of constructing targets manually, you can implement `NotificationStrategy`:

```python
from sentry.notifications.platform.types import NotificationStrategy, NotificationTarget

class MyNotificationStrategy(NotificationStrategy):
    def __init__(self, organization, project):
        self.organization = organization
        self.project = project

    def get_targets(self) -> list[NotificationTarget]:
        # Query for relevant users/channels and build targets
        return [
            GenericNotificationTarget(
                provider_key=NotificationProviderKey.EMAIL,
                resource_type=NotificationTargetResourceType.EMAIL,
                resource_id=member.email,
            )
            for member in self.get_relevant_members()
        ]
```

Then pass it to the service:

```python
service.notify_async(strategy=MyNotificationStrategy(org, project))
```

You must provide **either** `strategy` or `targets`, not both. Strategies should be used whenever a notification is targeting multiple recipients, or must do complex lookup logic to construct a valid target.

## Rollout Setup

### How rollout works

`NotificationService.has_access(organization, source)` delegates to `NotificationRolloutService`, which:

1. Checks feature flags in priority order (internal-testing > is-sentry > early-adopter > general-access)
2. Looks up the rollout rate for the source in the matched option
3. Rolls a random number against the rate

### Feature flag hierarchy

| Priority    | Feature flag                                           | Option key                                        |
| ----------- | ------------------------------------------------------ | ------------------------------------------------- |
| 1 (highest) | `organizations:notification-platform.internal-testing` | `notifications.platform-rollout.internal-testing` |
| 2           | `organizations:notification-platform.is-sentry`        | `notifications.platform-rollout.is-sentry`        |
| 3           | `organizations:notification-platform.early-adopter`    | `notifications.platform-rollout.early-adopter`    |
| 4 (lowest)  | `organizations:notification-platform.general-access`   | `notifications.platform-rollout.general-access`   |

### Option registration

The four rollout options are already registered in `src/sentry/options/defaults.py`:

```python
register(
    "notifications.platform-rollout.internal-testing",
    type=Dict,
    default={},
    flags=FLAG_AUTOMATOR_MODIFIABLE,
)
# ... same pattern for is-sentry, early-adopter, general-access
```

### Configuring rollout rates

Rollout rates are configured in `sentry-options-automator` (separate repo). Each option is a dict mapping source string to float (0.0-1.0):

```python
{
    "data-export-success": 1.0,      # 100% rollout
    "my-new-source": 0.5,            # 50% rollout
    "experimental-feature": 0.01,    # 1% rollout
}
```

### Standard sending pattern with rollout guard

```python
from sentry.notifications.platform.service import NotificationService

data = MyNotificationData(...)

if NotificationService.has_access(organization, data.source):
    service = NotificationService(data=data)
    service.notify_async(targets=[target])
```

Always guard with `has_access()` before sending. This ensures rollout controls are respected.
