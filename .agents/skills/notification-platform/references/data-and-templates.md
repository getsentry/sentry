# Data Classes and Templates — Full Reference

## Complete Example: DataExportSuccess

**File:** `src/sentry/notifications/platform/templates/data_export.py`

```python
from dataclasses import dataclass
from datetime import datetime

from django.utils import timezone

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    ParagraphBlock,
    PlainTextBlock,
)


def format_date(date: datetime) -> str:
    return date.strftime("%I:%M %p on %B %d, %Y (%Z)")


@dataclass(frozen=True)
class DataExportSuccess(NotificationData):
    source = NotificationSource.DATA_EXPORT_SUCCESS
    export_url: str
    expiration_date: datetime


@template_registry.register(DataExportSuccess.source)
class DataExportSuccessTemplate(NotificationTemplate[DataExportSuccess]):
    category = NotificationCategory.DATA_EXPORT
    example_data = DataExportSuccess(
        export_url="https://example.com/export",
        expiration_date=timezone.now(),
    )

    def render(self, data: DataExportSuccess) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="Your data is ready.",
            body=[
                ParagraphBlock(
                    blocks=[
                        PlainTextBlock(
                            text="See, that wasn't so bad. We're all done assembling your download."
                        )
                    ],
                )
            ],
            actions=[NotificationRenderedAction(label="Take Me There", link=data.export_url)],
            footer=f"This download file expires at {format_date(data.expiration_date)}.",
        )
```

## Complete Example: DataExportFailure (with CodeBlock)

```python
@dataclass(frozen=True)
class DataExportFailure(NotificationData):
    source = NotificationSource.DATA_EXPORT_FAILURE
    error_message: str
    error_payload: dict[str, Any]
    creation_date: datetime


@template_registry.register(DataExportFailure.source)
class DataExportFailureTemplate(NotificationTemplate[DataExportFailure]):
    category = NotificationCategory.DATA_EXPORT
    example_data = DataExportFailure(
        error_message="An error occurred while exporting your data.",
        error_payload={"export_type": "Issues-by-Tag", "project": [1234567890], "key": "user"},
        creation_date=timezone.now(),
    )

    def render(self, data: DataExportFailure) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="We couldn't export your data.",
            body=[
                ParagraphBlock(
                    blocks=[
                        PlainTextBlock(
                            text=f"The data export you created at {format_date(data.creation_date)} didn't work."
                        )
                    ]
                ),
                ParagraphBlock(
                    blocks=[
                        PlainTextBlock(text="It looks like there was an error: "),
                        CodeTextBlock(text=data.error_message),
                    ]
                ),
                CodeBlock(blocks=[PlainTextBlock(text=orjson.dumps(data.error_payload).decode())]),
            ],
            actions=[
                NotificationRenderedAction(label="Documentation", link="https://docs.sentry.io/"),
            ],
        )
```

## NotificationCategory to NotificationSource Mapping

> For a complete list of `NotificationCategory` to `NotificationSource` mappings, load `src/sentry/notifications/platform/types.py`.

## NotificationRenderedTemplate Field Reference

| Field             | Type                                    | Required | Description                                                                                                     |
| ----------------- | --------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `subject`         | `str`                                   | Yes      | Title/subject line. No formatting — displayed as-is.                                                            |
| `body`            | `list[NotificationBodyFormattingBlock]` | Yes      | Main content using block types below.                                                                           |
| `actions`         | `list[NotificationRenderedAction]`      | No       | Buttons/links. Each has `label` (str) and `link` (str).                                                         |
| `chart`           | `NotificationRenderedImage`             | No       | Image with `url` and `alt_text` fields.                                                                         |
| `footer`          | `str`                                   | No       | Extra text after actions. No formatting.                                                                        |
| `email_html_path` | `str`                                   | No       | Custom Django HTML template path. Data class passed as context. Default: `sentry/emails/platform/default.html`. |
| `email_text_path` | `str`                                   | No       | Custom Django text template path. Data class passed as context.                                                 |

## Notes on Special Template Fields

### `hide_from_debugger`

Set `hide_from_debugger = True` on templates that only use custom renderers and bypass `NotificationRenderedTemplate` rendering. These won't appear in the internal debugger at `sentry.io/debug/notifications`. Example: `SeerAutofixUpdateTemplate`.

### `render_example()`

The default implementation calls `self.render(data=self.example_data)`. Override only if the example rendering needs special behavior. The `example_data` class variable must produce a valid rendered template — the debugger uses this to preview notifications.

### `get_data_class()`

Returns the `NotificationData` subclass for this template by inspecting `example_data.__class__`. Used internally for deserialization in async tasks. You do not need to override this.
