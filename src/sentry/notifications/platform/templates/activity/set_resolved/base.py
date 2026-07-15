from sentry.notifications.platform.templates.activity.base import (
    ActivityNotificationData,
)
from sentry.notifications.platform.types import (
    CodeTextBlock,
    NotificationTextBlock,
    PlainTextBlock,
)


def get_resolution_subject(data: ActivityNotificationData) -> list[NotificationTextBlock]:
    blocks: list[NotificationTextBlock] = []
    if data.issue_short_id:
        blocks.extend(
            [CodeTextBlock(text=data.issue_short_id), PlainTextBlock(text="was resolved")]
        )
    else:
        blocks.append(PlainTextBlock(text="A Sentry Issue was resolved"))

    if data.activity_user_name:
        blocks.append(PlainTextBlock(text=f"by {data.activity_user_name}"))

    return blocks
