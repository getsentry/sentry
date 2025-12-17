from dataclasses import dataclass
from datetime import datetime
from typing import Any

import orjson
from django.utils import timezone

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.types import NotificationTemplateSource
from sentry.notifications.platform.types import (
    CodeBlock,
    CodeTextBlock,
    NotificationCategory,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationTemplate,
    ParagraphBlock,
    PlainTextBlock,
)


def format_date(date: datetime) -> str:
    return date.strftime("%I:%M %p on %B %d, %Y (%Z)")


@dataclass(frozen=True)
class DataExportSuccess(NotificationData):
    source = NotificationTemplateSource.DATA_EXPORT_SUCCESS
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
                            text="See, that wasn't so bad. We're all done assembling your download. Now have at it."
                        )
                    ],
                )
            ],
            actions=[NotificationRenderedAction(label="Take Me There", link=data.export_url)],
            footer=f"This download file expires at {format_date(data.expiration_date)}. So don't get attached.",
        )


@dataclass(frozen=True)
class DataExportFailure(NotificationData):
    source = NotificationTemplateSource.DATA_EXPORT_FAILURE
    error_message: str
    error_payload: dict[str, Any]
    creation_date: datetime


@template_registry.register(DataExportFailure.source)
class DataExportFailureTemplate(NotificationTemplate[DataExportFailure]):
    category = NotificationCategory.DATA_EXPORT
    example_data = DataExportFailure(
        error_message="An error occurred while exporting your data.",
        error_payload={
            "export_type": "Issues-by-Tag",
            "project": [1234567890],
            "key": "user",
        },
        creation_date=timezone.now(),
    )

    def render(self, data: DataExportFailure) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="We couldn't export your data.",
            body=[
                ParagraphBlock(
                    blocks=[
                        PlainTextBlock(
                            text=f"Well, this is a little awkward. The data export you created at {format_date(data.creation_date)} didn't work. Sorry about that."
                        )
                    ]
                ),
                ParagraphBlock(
                    blocks=[
                        PlainTextBlock(text="It looks like there was an error: "),
                        CodeTextBlock(text=data.error_message),
                    ]
                ),
                ParagraphBlock(
                    blocks=[
                        PlainTextBlock(
                            text="This is what you sent us. Maybe it'll help you sort this out: "
                        )
                    ]
                ),
                CodeBlock(blocks=[PlainTextBlock(text=orjson.dumps(data.error_payload).decode())]),
            ],
            actions=[
                NotificationRenderedAction(label="Documentation", link="https://docs.sentry.io/"),
                NotificationRenderedAction(
                    label="Help Center", link="https://sentry.zendesk.com/hc/en-us"
                ),
            ],
        )
