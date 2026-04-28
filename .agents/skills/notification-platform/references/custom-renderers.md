# Custom Renderers — Full Reference

## Architecture

The default flow is: `NotificationData` → `NotificationTemplate.render()` → `NotificationRenderedTemplate` → `NotificationRenderer.render()` → provider-specific renderable.

Custom renderers replace the last step. The provider's `get_renderer()` method dispatches to a custom renderer class based on category or data type, bypassing the default block-to-renderable conversion.

```
Template.render(data) → NotificationRenderedTemplate
                              ↓
Provider.get_renderer(data, category)
    ├── default → DefaultRenderer.render(data, rendered_template)
    └── custom  → CustomRenderer.render(data, rendered_template)
```

The custom renderer still receives the `rendered_template`, but is free to ignore it and render directly from `data`.

## When to Use

Use a custom renderer when:

- You need interactive elements (e.g., Slack buttons with action IDs)
- The output structure differs significantly from the standard subject/body/actions layout
- Different data types within the same category need completely different renderings
- You need provider-specific features (rich text blocks, adaptive cards, embeds)

Do NOT use a custom renderer when:

- The default block types (`ParagraphBlock`, `CodeBlock`, `PlainTextBlock`, `BoldTextBlock`, `CodeTextBlock`) are sufficient
- You only need to tweak styling — the default renderers establish common styles that the majority of notifications should abide by.

## File Placement

Custom renderers live at: `{provider}/renderers/{name}.py`

Example: `slack/renderers/seer.py`

## Concrete Example: SeerSlackRenderer

**File:** `src/sentry/notifications/platform/slack/renderers/seer.py`

This renderer handles three different Seer notification data types with completely different Slack outputs:

```python
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationRenderedTemplate,
)


class SeerSlackRenderer(NotificationRenderer[SlackRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        if isinstance(data, SeerAutofixTrigger):
            # Renders a single action button
            return SlackRenderable(
                blocks=[ActionsBlock(elements=[autofix_button])],
                text="Seer Autofix Trigger",
            )
        elif isinstance(data, SeerAutofixError):
            # Renders error sections
            return SlackRenderable(
                blocks=[
                    SectionBlock(text=data.error_title),
                    SectionBlock(text=MarkdownTextObject(text=f">{data.error_message}")),
                ],
                text=f"Seer stumbled: {data.error_title}",
            )
        elif isinstance(data, SeerAutofixUpdate):
            # Complex rendering: heading, summary, steps list, code changes, PR buttons
            # ... (see full source for details)
            pass
        else:
            raise ValueError(f"SeerSlackRenderer does not support {data.__class__.__name__}")
```

## Provider-Side Registration

The provider dispatches to the custom renderer by overriding `get_renderer()`:

**File:** `src/sentry/notifications/platform/slack/provider.py`

```python
from sentry.notifications.platform.slack.renderers.seer import SeerSlackRenderer

@provider_registry.register(NotificationProviderKey.SLACK)
class SlackNotificationProvider(NotificationProvider[SlackRenderable]):
    key = NotificationProviderKey.SLACK
    default_renderer = SlackRenderer  # default for all categories

    @classmethod
    def get_renderer(
        cls, *, data: NotificationData, category: NotificationCategory
    ) -> type[NotificationRenderer[SlackRenderable]]:
        if category == NotificationCategory.SEER:
            return SeerSlackRenderer
        return cls.default_renderer
```

## Creating Your Own Custom Renderer

1. Create `{provider}/renderers/{name}.py`
2. Implement the `NotificationRenderer` protocol:

```python
from sentry.notifications.platform.renderer import NotificationRenderer

class MyCustomRenderer(NotificationRenderer[ProviderRenderable]):
    provider_key = NotificationProviderKey.MY_PROVIDER

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> ProviderRenderable:
        # Build provider-specific output from data
        # rendered_template is available but can be ignored
        ...
```

3. Update the provider's `get_renderer()` to return your renderer for the relevant category
4. If using `hide_from_debugger = True` on the template, the debugger won't try to render the standard template output

## Templates with `hide_from_debugger`

When a template only makes sense with a custom renderer (e.g., `SeerAutofixUpdateTemplate`), set `hide_from_debugger = True`. The `render()` method can return a minimal `NotificationRenderedTemplate` since the custom renderer will ignore it anyway:

```python
@template_registry.register(SeerAutofixUpdate.source)
class SeerAutofixUpdateTemplate(NotificationTemplate[SeerAutofixUpdate]):
    category = NotificationCategory.SEER
    hide_from_debugger = True
    example_data = SeerAutofixUpdate(...)

    def render(self, data: SeerAutofixUpdate) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="Seer Autofix Update",
            body=[ParagraphBlock(blocks=[PlainTextBlock(text="Update")])],
        )
```
