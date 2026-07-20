from datetime import datetime
from typing import Any

import orjson
from django.utils import timezone

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    CodeSection,
    CodeTextBlock,
    NotificationCategory,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    ParagraphSection,
    PlainTextBlock,
)


def format_date(date: datetime) -> str:
    return date.strftime("%I:%M %p on %B %d, %Y (%Z)")


class DataExportSuccess(NotificationData):
    source: NotificationSource = NotificationSource.DATA_EXPORT_SUCCESS
    export_url: str
    expiration_date: datetime


@template_registry.register(NotificationSource.DATA_EXPORT_SUCCESS)
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
                ParagraphSection(
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


class DataExportFailure(NotificationData):
    source: NotificationSource = NotificationSource.DATA_EXPORT_FAILURE
    error_message: str
    error_payload: dict[str, Any]
    creation_date: datetime


@template_registry.register(NotificationSource.DATA_EXPORT_FAILURE)
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
                ParagraphSection(
                    blocks=[
                        PlainTextBlock(
                            text=f"Well, this is a little awkward. The data export you created at {format_date(data.creation_date)} didn't work. Sorry about that."
                        )
                    ]
                ),
                ParagraphSection(
                    blocks=[
                        PlainTextBlock(text="It looks like there was an error: "),
                        CodeTextBlock(text=data.error_message),
                    ]
                ),
                ParagraphSection(
                    blocks=[
                        PlainTextBlock(
                            text="This is what you sent us. Maybe it'll help you sort this out: "
                        )
                    ]
                ),
                CodeSection(
                    blocks=[PlainTextBlock(text=orjson.dumps(data.error_payload).decode())]
                ),
            ],
            actions=[
                NotificationRenderedAction(label="Documentation", link="https://docs.sentry.io/"),
                NotificationRenderedAction(label="Help Center", link="https://www.sentry.help/"),
            ],
        )
