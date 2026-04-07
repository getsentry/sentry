---
name: notification-platform
description: Guide for adding notifications, custom renderers, or new providers to Sentry's NotificationPlatform. Use when asked to "add notification", "new notification", "notification platform", "send notification", "notification template", "notification renderer", "notification provider", "NotificationPlatform", "notify user", "send email notification", "send slack notification".
---

# NotificationPlatform Guide

Sentry's NotificationPlatform is a provider-based system for sending notifications across Email, Slack, Discord, and MS Teams. You define data + template, register it, and the platform handles rendering and delivery per provider.

## Glossary

| Concept                        | Role                                                                                                                                                                                                 | Location      |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `NotificationData`             | Protocol. Frozen dataclass carrying the payload for a single notification. Must declare a `source` class variable.                                                                                   | `types.py`    |
| `NotificationTemplate`         | Abstract class. Converts `NotificationData` into a `NotificationRenderedTemplate`. Registered per `NotificationSource`.                                                                              | `types.py`    |
| `NotificationRenderedTemplate` | Dataclass. Provider-agnostic output: subject, body blocks, actions, chart, footer, optional email paths.                                                                                             | `types.py`    |
| `NotificationProvider`         | Protocol. Knows how to validate a target, pick a renderer, and send the final renderable (Email, Slack, etc.).                                                                                       | `provider.py` |
| `NotificationRenderer`         | Protocol. Converts a `NotificationRenderedTemplate` into a provider-specific renderable (HTML email, Slack blocks, etc.).                                                                            | `renderer.py` |
| `NotificationTarget`           | Protocol. Identifies the recipient: email address, channel ID, or DM user ID. Two concrete classes: `GenericNotificationTarget` (email) and `IntegrationNotificationTarget` (Slack/Discord/MSTeams). | `target.py`   |
| `NotificationService`          | Entry point. Orchestrates lookup, rendering, and delivery. Provides `has_access()`, `notify_target()`, `notify_async()`, `notify_sync()`.                                                            | `service.py`  |

All paths below are relative to `src/sentry/notifications/platform/`.

## Step 1: Determine Your Operation

| I want to...                                   | Go to     |
| ---------------------------------------------- | --------- |
| Add a new notification (most common)           | Steps 2-5 |
| Add a custom renderer for an existing provider | Step 6    |
| Add an entirely new provider                   | Step 7    |

After any operation, continue to Step 8 (Test) and Step 9 (Verify).

## Step 2: Define the Notification Source

Every notification needs a unique `NotificationSource` enum value and must be mapped to a `NotificationCategory`. A `NotificationSource` should represent the domain or feature that a given notification belongs to.

> For examples, load `src/sentry/notifications/platform/types.py`.

**File:** `types.py`

1. Add the enum value under the appropriate category comment:

```python
class NotificationSource(StrEnum):
    # MY_CATEGORY
    MY_NEW_SOURCE = "my-new-source"
```

2. Add it to `NOTIFICATION_SOURCE_MAP` under the matching category key:

```python
NOTIFICATION_SOURCE_MAP[NotificationCategory.MY_CATEGORY].append(
    NotificationSource.MY_NEW_SOURCE
)
```

If no existing `NotificationCategory` fits, add a new one to the `NotificationCategory` enum first, then create its entry in `NOTIFICATION_SOURCE_MAP`.

All `NotificationCategory` options are defined in the `src/sentry/notifications/platform/types.py` file.

## Step 3: Create the Notification Data

The data class is a frozen dataclass implementing the `NotificationData` protocol. It carries everything the template needs to render.

**File:** `templates/<your_notification>.py` (new file)

```python
from dataclasses import dataclass
from sentry.notifications.platform.types import NotificationData, NotificationSource

@dataclass(frozen=True)
class MyNotificationData(NotificationData):
    source = NotificationSource.MY_NEW_SOURCE  # class variable, not a field
    title: str
    detail_url: str
```

Rules:

- `source` is a **class variable** (no type annotation), not a dataclass field
- Use `frozen=True` for serialization safety
- Only include fields needed by the template's `render()` method
- Avoid Django model instances; use primitive types or simple dataclasses for async serialization

> For full examples (DataExportSuccess, DataExportFailure), load `references/data-and-templates.md`.

## Step 4: Create the Notification Template

The template converts your data into a provider-agnostic `NotificationRenderedTemplate`.

**Same file as Step 3:** `templates/<your_notification>.py`

```python
from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationTemplate,
    ParagraphBlock,
    PlainTextBlock,
)

@template_registry.register(MyNotificationData.source)
class MyNotificationTemplate(NotificationTemplate[MyNotificationData]):
    category = NotificationCategory.MY_CATEGORY
    example_data = MyNotificationData(
        title="Example title",
        detail_url="https://example.com",
    )

    def render(self, data: MyNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=data.title,
            body=[
                ParagraphBlock(blocks=[PlainTextBlock(text="Something happened.")])
            ],
            actions=[
                NotificationRenderedAction(label="View Details", link=data.detail_url)
            ],
        )
```

**Available body block types:**

Refer to `src/sentry/notifications/platform/types.py` for the latest available block types.

**Register the import** in `templates/__init__.py`:

```python
from .my_notification import MyNotificationTemplate
```

This import is required so the `@template_registry.register` decorator executes at startup (via `sentry/notifications/apps.py`).

> For the full rendered template field reference and more examples, load `references/data-and-templates.md`.

## Step 5: Register Rollout and Send

### Rollout registration

The platform uses a tiered rollout system. Each notification source must be added to the appropriate rollout option before it will be delivered.

Rollout options are configured externally in `sentry-options-automator` (not this repo). The option keys are:

| Rollout stage    | Option key                                        |
| ---------------- | ------------------------------------------------- |
| Internal testing | `notifications.platform-rollout.internal-testing` |
| Sentry orgs      | `notifications.platform-rollout.is-sentry`        |
| Early adopter    | `notifications.platform-rollout.early-adopter`    |
| General access   | `notifications.platform-rollout.general-access`   |

Each option is a `Dict` mapping source string to rollout rate (0.0-1.0). Example:

```python
{"my-new-source": 1.0}
```

These options are registered in `src/sentry/options/defaults.py` (already done for the four stages above).

### Sending pattern

```python
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.target import GenericNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)

data = MyNotificationData(title="Export ready", detail_url="https://...")

# Guard with rollout check
if NotificationService.has_access(organization, data.source):
    service = NotificationService(data=data)
    target = GenericNotificationTarget(
        provider_key=NotificationProviderKey.EMAIL,
        resource_type=NotificationTargetResourceType.EMAIL,
        resource_id=user.email,
    )
    service.notify_async(targets=[target])
```

> For target types, async/sync decisions, and strategy patterns, load `references/targets-and-sending.md`.

## Step 6: Add a Custom Renderer

Custom renderers bypass the default template-to-renderable conversion for a specific provider + category combination. Use when the default block-based rendering is too limiting (e.g., interactive Slack buttons, rich card layouts).

**When to use:**

- The notification needs provider-specific interactive elements (buttons with action IDs, rich text blocks)
- The rendered output structure differs significantly from subject + body + actions
- You need to render different data types differently within the same provider

**How it works:** Override `get_renderer()` on the provider to return your custom renderer class for the relevant category:

```python
# In the provider class
@classmethod
def get_renderer(
    cls, *, data: NotificationData, category: NotificationCategory
) -> type[NotificationRenderer[MyRenderable]]:
    if category == NotificationCategory.MY_CATEGORY:
        return MyCustomRenderer
    return cls.default_renderer
```

**File placement:** `{provider}/renderers/{name}.py` (e.g., `slack/renderers/seer.py`)

> For architecture details and the full Seer Slack renderer example, load `references/custom-renderers.md`.

## Step 7: Add a New Provider

Adding a new provider requires implementing the `NotificationProvider` protocol, a default `NotificationRenderer`, and registering both. This should only be done when onboarding a new integration provider.

High-level steps:

1. Create `{provider_name}/provider.py` with provider + default renderer classes
2. Register with `@provider_registry.register(NotificationProviderKey.MY_PROVIDER)`
3. Add `NotificationProviderKey.MY_PROVIDER` to the `NotificationProviderKey` enum in `types.py`
4. Import the provider in `sentry/notifications/apps.py`
5. Gate availability behind a feature flag in `is_available()`

> For the full provider scaffold and protocol requirements, load `references/provider-template.md`.

## Step 8: Test

Test directory: `tests/sentry/notifications/platform/`

### Template test

```python
class TestMyNotificationTemplate:
    def test_render(self):
        data = MyNotificationData(title="Test", detail_url="https://example.com")
        template = MyNotificationTemplate()
        rendered = template.render(data)

        assert rendered.subject == "Test"
        assert len(rendered.body) == 1
        assert len(rendered.actions) == 1
        assert rendered.actions[0].link == "https://example.com"

    def test_render_example(self):
        template = MyNotificationTemplate()
        rendered = template.render_example()
        assert rendered.subject  # Verify example_data produces valid output
```

### Service integration test

```python
from unittest.mock import patch
from sentry.notifications.platform.service import NotificationService

class TestMyNotificationService:
    @patch("sentry.notifications.platform.email.provider.EmailNotificationProvider.send")
    def test_notify_target(self, mock_send):
        data = MyNotificationData(title="Test", detail_url="https://example.com")
        service = NotificationService(data=data)
        target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id="user@example.com",
        )
        service.notify_target(target=target)
        assert mock_send.called
```

### Custom renderer test

If you added a custom renderer, test that the provider dispatches to it:

```python
def test_get_renderer_returns_custom():
    data = MySpecialData(source=NotificationSource.MY_SOURCE, ...)
    renderer = MyProvider.get_renderer(data=data, category=NotificationCategory.MY_CATEGORY)
    assert renderer is MyCustomRenderer
```

## Step 9: Verify

Pre-flight checklist before submitting:

- [ ] `NotificationSource` enum value added to `types.py`
- [ ] Source added to `NOTIFICATION_SOURCE_MAP` under correct category
- [ ] Data class is `@dataclass(frozen=True)` with `source` as class variable
- [ ] Template registered with `@template_registry.register(DataClass.source)`
- [ ] Template imported in `templates/__init__.py`
- [ ] `example_data` on template produces valid output via `render_example()`
- [ ] Rollout option value configured (or ticket filed for `sentry-options-automator`)
- [ ] Sending code guarded with `NotificationService.has_access()`
- [ ] Tests pass: `pytest -svv --reuse-db tests/sentry/notifications/platform/`
- [ ] Pre-commit passes on all modified files
