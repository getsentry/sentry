# Custom Renderers — Full Reference

## Architecture

The default flow is: `NotificationData` → `NotificationTemplate.render()` → `NotificationRenderedTemplate` → `NotificationRenderer.render()` → provider-specific renderable.

Custom renderers replace the last step. The provider's `get_renderer()` method dispatches to a custom renderer class based on category or data type, bypassing the default section/block-to-renderable conversion.

```
Template.render(data) → NotificationRenderedTemplate
                              ↓
Provider.get_renderer(data, category)
    ├── default → DefaultRenderer.render(data, rendered_template, link_decorator)
    └── custom  → CustomRenderer.render(data, rendered_template, link_decorator)
```

The custom renderer still receives the `rendered_template`, but is free to ignore it and render directly from `data`. It must still decorate its links (see [Links](#links)).

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

Example: `slack/renderers/seer.py`

## Concrete Example: SeerSlackRenderer

**File:** `src/sentry/notifications/platform/slack/renderers/seer.py`

This renderer handles three different Seer notification data types with completely different Slack outputs:

```python
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.tracking import NotificationLinkDecorator
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationRenderedTemplate,
)


class SeerSlackRenderer(NotificationRenderer[SlackRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls,
        *,
        data: DataT,
        rendered_template: NotificationRenderedTemplate,
        link_decorator: NotificationLinkDecorator,
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

## Links

`NotificationService.render_template()` decorates the template's links only when the provider uses its default renderer. A custom renderer gets the `link_decorator` instead, and must decorate each Sentry URL it emits itself:

```python
LinkButtonElement(
    text="View in Sentry",
    url=link_decorator.decorate_url(data.group_link),
)
```

`decorate_url` adds the tracking parameters and records the link's kind in `link_decorator.links`, which is reported when the notification is sent. Non-Sentry URLs come back unchanged.

The kind comes from `classify_link` in `tracking.py`. When a notification links to a new kind of Sentry page, add a `NotificationLink` value and match the page's path in `classify_link`, with a case in `test_classify_link`. Unmatched pages are tagged `other`.

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
        cls,
        *,
        data: DataT,
        rendered_template: NotificationRenderedTemplate,
        link_decorator: NotificationLinkDecorator,
    ) -> ProviderRenderable:
        # Build provider-specific output from data
        # rendered_template is available but can be ignored
        # Pass every Sentry URL through link_decorator.decorate_url()
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
