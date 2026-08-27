# Custom Renderers — Full Reference

## Architecture

The default flow is: `NotificationData` → `NotificationTemplate.render()` → `NotificationRenderedTemplate` → `NotificationRenderer.render()` → provider-specific renderable.

Custom renderers replace the last step. The provider's `get_renderer()` method dispatches to a custom renderer class based on category or data type, bypassing the default section/block-to-renderable conversion.

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

- The default section and block types (`ParagraphSection`, `CodeSection`, `BlockQuoteSection`, `PlainTextBlock`, `BoldTextBlock`, `ItalicTextBlock`, `CodeTextBlock`, `LinkTextBlock`) are sufficient
- You only need to tweak styling — the default renderers establish common styles that the majority of notifications should abide by.

## File Placement

Custom renderers live at: `{provider}/renderers/{name}.py`

Example: `slack/renderers/seer_agent.py`

## Concrete Example: Seer Slack Renderers

Seer keeps its concrete renderers in domain modules such as
`seer_agent.py` and `seer_autofix.py`. The small `seer.py` module maps each
notification source to exactly one concrete renderer:

**File:** `src/sentry/notifications/platform/slack/renderers/seer.py`

```python
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.slack.renderers.seer_agent import (
    SeerAgentResponseSlackRenderer,
)
from sentry.notifications.platform.types import NotificationData, NotificationSource

_SEER_SLACK_RENDERERS: dict[
    NotificationSource, type[NotificationRenderer[SlackRenderable]]
] = {
    NotificationSource.SEER_AGENT_RESPONSE: SeerAgentResponseSlackRenderer,
    # Other Seer notification sources each map to their concrete renderer.
}

def get_seer_slack_renderer(
    data: NotificationData,
) -> type[NotificationRenderer[SlackRenderable]]:
    return _SEER_SLACK_RENDERERS[data.source]
```

## Provider-Side Registration

The provider dispatches to the custom renderer by overriding `get_renderer()`:

**File:** `src/sentry/notifications/platform/slack/provider.py`

```python
from sentry.notifications.platform.slack.renderers.seer import get_seer_slack_renderer

@provider_registry.register(NotificationProviderKey.SLACK)
class SlackNotificationProvider(NotificationProvider[SlackRenderable]):
    key = NotificationProviderKey.SLACK
    default_renderer = SlackRenderer  # default for all categories

    @classmethod
    def get_renderer(
        cls, *, data: NotificationData, category: NotificationCategory
    ) -> type[NotificationRenderer[SlackRenderable]]:
        if category == NotificationCategory.SEER:
            return get_seer_slack_renderer(data)
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
            body=[ParagraphSection(blocks=[PlainTextBlock(text="Update")])],
        )
```
