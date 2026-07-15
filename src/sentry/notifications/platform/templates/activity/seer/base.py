from django.conf import settings

from sentry.notifications.platform.templates.activity.base import (
    FOOTER_DELIMITER,
    ActivityNotificationData,
    build_footer,
)
from sentry.notifications.platform.types import (
    CodeTextBlock,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationTextBlock,
    PlainTextBlock,
)


def get_subject(label: str, data: ActivityNotificationData) -> list[NotificationTextBlock]:
    if data.issue_short_id:
        return [PlainTextBlock(text=f"{label} for"), CodeTextBlock(text=data.issue_short_id)]
    else:
        return [PlainTextBlock(text=f"{label} for a Sentry Issue")]


def build_template(
    data: ActivityNotificationData,
    subject: list[NotificationTextBlock],
    body: list[NotificationSection],
) -> NotificationRenderedTemplate:
    footer = build_footer(data=data)
    if settings.DEBUG and data.activity_data:
        footer.append(PlainTextBlock(text=FOOTER_DELIMITER))
        footer.append(PlainTextBlock(text=f"Run ID: {data.activity_data.get('run_id')}"))

    return NotificationRenderedTemplate(subject=subject, body=body, footer=footer)
