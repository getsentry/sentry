from sentry.notifications.platform.templates.activity.base import (
    ActivityNotificationData,
)
from sentry.notifications.platform.types import (
    CodeTextBlock,
    NotificationTextBlock,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType


def get_status_change_subject(data: ActivityNotificationData) -> list[NotificationTextBlock]:
    blocks: list[NotificationTextBlock] = []
    activity_type = ActivityType(data.activity_type)

    match activity_type:
        case (
            ActivityType.SET_RESOLVED
            | ActivityType.SET_RESOLVED_BY_AGE
            | ActivityType.SET_RESOLVED_IN_COMMIT
            | ActivityType.SET_RESOLVED_IN_RELEASE
        ):
            action = "was resolved"
        case ActivityType.SET_REGRESSION:
            action = "has regressed"
        case ActivityType.SET_ESCALATING:
            action = "is escalating"
        case ActivityType.SET_IGNORED:
            action = "has been archived"
        case ActivityType.SET_UNRESOLVED:
            action = "was unresolved"
        case _:
            raise ValueError("Unsupported activity, can only be used for status changes.")

    if data.issue_short_id:
        blocks.extend([CodeTextBlock(text=data.issue_short_id), PlainTextBlock(text=action)])
    else:
        blocks.append(PlainTextBlock(text=f"A Sentry Issue {action}"))

    # Escalating is not attributable, even if we have an author for some reason
    if data.activity_user_name and not activity_type == ActivityType.SET_ESCALATING:
        blocks.append(PlainTextBlock(text=f"by {data.activity_user_name}"))

    return blocks
