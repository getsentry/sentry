# New Provider — Full Reference

## Provider Protocol Requirements

| Attribute/Method               | Type                                      | Description                                                                                                                                                       |
| ------------------------------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`                          | `NotificationProviderKey`                 | Unique enum value for this provider                                                                                                                               |
| `default_renderer`             | `type[NotificationRenderer[RenderableT]]` | Default renderer class                                                                                                                                            |
| `target_class`                 | `type[NotificationTarget]`                | Target class this provider accepts                                                                                                                                |
| `target_resource_types`        | `list[NotificationTargetResourceType]`    | Supported resource types                                                                                                                                          |
| `validate_target(target)`      | classmethod                               | Validates target is correct type for provider                                                                                                                     |
| `get_renderer(data, category)` | classmethod                               | Returns renderer class (default or custom)                                                                                                                        |
| `is_available(organization)`   | classmethod                               | Whether provider is enabled                                                                                                                                       |
| `send(target, renderable)`     | classmethod                               | Delivers the rendered notification, typically by instantiating an `IntegrationInstallation` class of the matching provider type, and invoking its dispatch method |

## Provider Scaffold

Based on the Discord provider pattern (`src/sentry/notifications/platform/discord/provider.py`):

````python
from __future__ import annotations

from typing import TYPE_CHECKING

from sentry.notifications.platform.provider import NotificationProvider, NotificationProviderError
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.target import (
    IntegrationNotificationTarget,
    PreparedIntegrationNotificationTarget,
)
from sentry.notifications.platform.types import (
    NotificationBodyFormattingBlock,
    NotificationBodyFormattingBlockType,
    NotificationBodyTextBlock,
    NotificationBodyTextBlockType,
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationTarget,
    NotificationTargetResourceType,
)
from sentry.organizations.services.organization.model import RpcOrganizationSummary

# Define the renderable type for this provider
type MyRenderable = dict  # Replace with actual type


class MyDefaultRenderer(NotificationRenderer[MyRenderable]):
    provider_key = NotificationProviderKey.MY_PROVIDER

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> MyRenderable:
        # Convert rendered_template blocks into provider-specific format
        body = cls.render_body_blocks(rendered_template.body)
        # Build and return provider-specific renderable
        return {"subject": rendered_template.subject, "body": body}

    @classmethod
    def render_body_blocks(cls, body: list[NotificationBodyFormattingBlock]) -> str:
        parts = []
        for block in body:
            if block.type == NotificationBodyFormattingBlockType.PARAGRAPH:
                parts.append(cls.render_text_blocks(block.blocks))
            elif block.type == NotificationBodyFormattingBlockType.CODE_BLOCK:
                parts.append(f"```{cls.render_text_blocks(block.blocks)}```")
        return "\n".join(parts)

    @classmethod
    def render_text_blocks(cls, blocks: list[NotificationBodyTextBlock]) -> str:
        texts = []
        for block in blocks:
            if block.type == NotificationBodyTextBlockType.PLAIN_TEXT:
                texts.append(block.text)
            elif block.type == NotificationBodyTextBlockType.BOLD_TEXT:
                texts.append(f"**{block.text}**")
            elif block.type == NotificationBodyTextBlockType.CODE:
                texts.append(f"`{block.text}`")
        return " ".join(texts)


@provider_registry.register(NotificationProviderKey.MY_PROVIDER)
class MyNotificationProvider(NotificationProvider[MyRenderable]):
    key = NotificationProviderKey.MY_PROVIDER
    default_renderer = MyDefaultRenderer
    target_class = IntegrationNotificationTarget  # or GenericNotificationTarget
    target_resource_types = [
        NotificationTargetResourceType.CHANNEL,
        NotificationTargetResourceType.DIRECT_MESSAGE,
    ]

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        # Gate behind a feature flag until ready
        return False

    @classmethod
    def send(cls, *, target: NotificationTarget, renderable: MyRenderable) -> None:
        if not isinstance(target, cls.target_class):
            raise NotificationProviderError(
                f"Target '{target.__class__.__name__}' is not valid for {cls.__name__}"
            )
        # Deliver the renderable via your provider's API
        ...
````

## Registration Steps

### 1. Add provider key enum

**File:** `src/sentry/notifications/platform/types.py`

```python
class NotificationProviderKey(StrEnum):
    # ... existing keys ...
    MY_PROVIDER = "my_provider"
```

### 2. Import in apps.py

**File:** `src/sentry/notifications/apps.py`

```python
class Config(AppConfig):
    name = "sentry.notifications"

    def ready(self) -> None:
        # Register providers
        import sentry.notifications.platform.discord.provider
        import sentry.notifications.platform.email.provider
        import sentry.notifications.platform.msteams.provider
        import sentry.notifications.platform.my_provider.provider  # Add this
        import sentry.notifications.platform.slack.provider
        # Register templates
        import sentry.notifications.platform.templates
```

### 3. Feature flag gating

Use `is_available()` to gate behind a feature flag:

```python
@classmethod
def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
    if organization is None:
        return False
    from sentry import features
    return features.has("organizations:my-provider-notifications", organization)
```

The `provider_registry.get_available(organization)` method filters providers by `is_available()`, so unavailable providers won't be used for multi-provider sends.

## File Structure

```
src/sentry/notifications/platform/
└── my_provider/
    ├── __init__.py
    ├── provider.py          # Provider + default renderer
    └── renderers/           # Optional custom renderers
        └── __init__.py
```
