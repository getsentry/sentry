# Creating a New Integration in Sentry

This guide walks through the process of creating a new integration in Sentry, covering the basic setup, notification registrations, and implementation patterns.

## Table of Contents
1. [Basic Integration Structure](#basic-integration-structure)
2. [Implementing the Integration Provider](#implementing-the-integration-provider)
3. [Implementing the Integration Installation](#implementing-the-integration-installation)
4. [Adding Notification Support](#adding-notification-support)
5. [Registering Alert Handlers](#registering-alert-handlers)
6. [Testing Your Integration](#testing-your-integration)

## Basic Integration Structure

Create a new directory for your integration under `src/sentry/integrations/`:

```
src/sentry/integrations/your_integration/
├── __init__.py
├── integration.py          # Main integration classes
├── client.py              # API client (if needed)
├── notifications.py       # Notification handlers
├── urls.py               # URL patterns (if needed)
└── README.md             # Integration documentation
```

## Implementing the Integration Provider

Create `integration.py` with the core integration classes:

```python
from sentry.integrations.base import (
    IntegrationProvider,
    IntegrationInstallation,
    IntegrationMetadata,
    FeatureDescription,
    IntegrationFeatures,
)

# Define metadata for your integration
metadata = IntegrationMetadata(
    description="Description of your integration",
    features=[
        FeatureDescription(
            "Feature description with *markdown* support",
            IntegrationFeatures.ALERT_RULE
        ),
    ],
    author="Your Name",
    noun="integration_noun",
    issue_url="https://github.com/getsentry/sentry/issues",
    source_url="https://github.com/getsentry/sentry",
    aspects={},
)

class YourIntegrationProvider(IntegrationProvider):
    """
    Provider class that handles the installation and configuration of the integration.
    """
    key = "your_integration"
    name = "Your Integration"
    metadata = metadata
    integration_cls = YourIntegration  # Reference to installation class below

    # Define supported features
    features = frozenset([
        IntegrationFeatures.ALERT_RULE,
        IntegrationFeatures.INCIDENT_MANAGEMENT,
    ])

    def get_pipeline_views(self):
        """Return configuration pipeline views."""
        return [YourIntegrationSetupView()]

    def build_integration(self, state):
        """Build integration data from pipeline state."""
        return {
            "external_id": state["external_id"],
            "name": state.get("name", "Your Integration"),
            "metadata": {
                "api_key": state["api_key"],
                # Add other metadata as needed
            }
        }

    def setup(self):
        """Initialize any bindings or registrations."""
        pass
```

## Implementing the Integration Installation

Add the installation class that handles the actual functionality:

```python
class YourIntegration(IntegrationInstallation):
    """
    Handles the integration functionality after installation.
    """

    def get_client(self):
        """Return an API client for the integration."""
        return YourIntegrationClient(
            api_key=self.model.metadata.get("api_key"),
            base_url=self.model.metadata.get("base_url"),
        )

    def get_organization_config(self):
        """Return organization-specific configuration fields."""
        return [
            {
                "name": "project_id",
                "label": "Project ID",
                "type": "text",
                "required": True,
            }
        ]
```

## Adding Notification Support

Create notification handlers for different alert types in separate files or within your integration directory:

### 1. Issue Alert Notifications

Create a handler for issue alerts:

```python
from sentry.notifications.notify import register_notification_provider
from sentry.integrations.types import ExternalProviders

@register_notification_provider(ExternalProviders.YOUR_INTEGRATION)
def send_notification(notification, recipients, shared_context, extra_context_by_actor):
    """
    Handle sending notifications through your integration.
    """
    client = get_integration_client()

    for recipient in recipients:
        context = {**shared_context, **extra_context_by_actor.get(recipient, {})}

        # Format and send the notification
        message = format_notification_message(notification, context)
        client.send_message(recipient.identifier, message)
```

### 2. Metric Alert Notifications

Register a metric alert handler:

```python
from sentry.notifications.notification_action.registry import metric_alert_handler_registry
from sentry.notifications.notification_action.types import BaseMetricAlertHandler
from sentry.workflow_engine.models import Action

@metric_alert_handler_registry.register(Action.Type.YOUR_INTEGRATION)
class YourIntegrationMetricAlertHandler(BaseMetricAlertHandler):
    def send_alert(self, notification_uuid: str) -> None:
        """Send metric alert notification."""
        client = self.get_client()

        # Build alert message
        message = self.build_metric_alert_message(
            incident=self.incident,
            new_status=self.new_status,
            metric_value=self.metric_value,
        )

        # Send to integration
        client.send_alert(
            channel=self.action.data.get("channel"),
            message=message,
            notification_uuid=notification_uuid,
        )
```

### 3. Issue Alert Handler

```python
from sentry.notifications.notification_action.registry import issue_alert_handler_registry
from sentry.notifications.notification_action.types import BaseIssueAlertHandler

@issue_alert_handler_registry.register(Action.Type.YOUR_INTEGRATION)
class YourIntegrationIssueAlertHandler(BaseIssueAlertHandler):
    @classmethod
    def get_additional_fields(cls, action: Action, mapping: ActionFieldMapping):
        """Return additional fields for the alert."""
        return {
            "priority": action.data.get("priority", "normal"),
            "tags": action.data.get("tags", []),
        }
```

### 4. Spike Protection Notifications

For spike protection, register an action:

```python
from sentry.models.notificationaction import (
    NotificationAction,
    ActionRegistration,
    ActionService,
    ActionTarget,
    ActionTrigger,
)

@NotificationAction.register_action(
    trigger_type=ActionTrigger.GS_SPIKE_PROTECTION,
    service_type=ActionService.YOUR_INTEGRATION.value,
    target_type=ActionTarget.SPECIFIC.value,
)
class YourIntegrationSpikeProtectionRegistration(ActionRegistration):
    def fire(self, data):
        """Handle spike protection notifications."""
        client = self.get_client()

        # Format spike protection alert
        message = format_spike_protection_message(data)

        # Send notification
        client.send_notification(
            target=self.action.target_identifier,
            message=message,
        )
```

## Client Implementation

Create `client.py` for API interactions:

```python
from sentry.shared_integrations.client import BaseApiClient

class YourIntegrationClient(BaseApiClient):
    def __init__(self, api_key, base_url=None):
        self.api_key = api_key
        self.base_url = base_url or "https://api.yourintegration.com"
        super().__init__()

    def request(self, method, path, headers=None, data=None):
        headers = headers or {}
        headers["Authorization"] = f"Bearer {self.api_key}"

        return self._request(
            method,
            f"{self.base_url}{path}",
            headers=headers,
            data=data,
        )

    def send_message(self, channel, message):
        """Send a message to the integration."""
        return self.post(
            "/messages",
            data={
                "channel": channel,
                "message": message,
            }
        )
```

## Registration and Setup

### 1. Register the Provider

Add your integration to the provider registry (usually in `__init__.py`):

```python
from sentry.plugins.providers import IntegrationProviderManager

providers = IntegrationProviderManager()
providers.register(YourIntegrationProvider)
```

### 2. Add to External Providers

If your integration sends notifications, add it to `ExternalProviders` in `src/sentry/integrations/types.py`:

```python
class ExternalProviders(StrEnum):
    # ... existing providers ...
    YOUR_INTEGRATION = "your_integration"
```

### 3. Add Service Type

For action-based notifications, add to `ActionService` in `src/sentry/models/notificationaction.py`:

```python
class ActionService(FlexibleIntEnum):
    # ... existing services ...
    YOUR_INTEGRATION = 8  # Next available number

    @classmethod
    def as_choices(cls):
        return (
            # ... existing choices ...
            (cls.YOUR_INTEGRATION.value, ExternalProviders.YOUR_INTEGRATION.name),
        )
```

## Testing Your Integration

Create test files following the pattern:

```python
# tests/sentry/integrations/your_integration/test_integration.py
import pytest
from sentry.testutils.cases import IntegrationTestCase

class YourIntegrationTest(IntegrationTestCase):
    provider = YourIntegrationProvider

    def test_installation(self):
        """Test integration installation flow."""
        integration = self.create_integration(
            organization=self.organization,
            external_id="test-id",
            name="Test Integration",
        )
        assert integration.name == "Test Integration"

    def test_notification_sending(self):
        """Test notification delivery."""
        # Test your notification handlers
        pass
```

## Best Practices

1. **Error Handling**: Always handle API failures gracefully and provide meaningful error messages
2. **Logging**: Use proper logging for debugging and monitoring
3. **Configuration**: Store sensitive data (API keys) in integration metadata, not in code
4. **Documentation**: Include inline documentation and a README in your integration directory
5. **Type Hints**: Use type hints for better code maintainability
6. **Testing**: Write comprehensive tests for all functionality

## Common Patterns

### Handling Multiple Notification Types

The PR example shows how to handle different notification types in one integration:

```python
# Create separate handlers for each notification type
metric_alerting/
├── __init__.py  # Metric alert handler
issue_alerting/
├── __init__.py  # Issue alert handler
spike_protection_registry/
├── __init__.py  # Spike protection handler
digest_notifications/
├── __init__.py  # Digest notification handler
```

### Integration-Specific Configuration

Store integration-specific settings in the metadata:

```python
def build_integration(self, state):
    return {
        "external_id": state["external_id"],
        "metadata": {
            "webhook_url": state["webhook_url"],
            "api_key": state["api_key"],
            "default_channel": state.get("channel", "#general"),
        }
    }
```

This documentation provides a comprehensive guide for creating a new integration in Sentry, following the patterns established in the codebase and demonstrated in PR #86262.
