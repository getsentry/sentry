from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.notifications.platform.types import (
    CodeTextBlock,
    LinkTextBlock,
    NotificationTextBlock,
    PlainTextBlock,
)
from sentry.users.services.user.service import user_service
from sentry.utils.http import absolute_uri

EXAMPLE_ISSUE_URL = "https://sentry.io/organizations/example/issues/1/"


def get_resolution_subject(activity: Activity, group: Group) -> list[NotificationTextBlock]:
    blocks: list[NotificationTextBlock] = []
    if group.qualified_short_id:
        blocks.extend(
            [CodeTextBlock(text=group.qualified_short_id), PlainTextBlock(text="was resolved")]
        )
    else:
        blocks.append(PlainTextBlock(text="A Sentry Issue was resolved"))

    if activity.user_id:
        user = user_service.get_user(id=activity.user_id)
        blocks.append(PlainTextBlock(text=f"by {user.get_display_name()}"))

    return blocks


def get_resolution_issue_label(group: Group) -> NotificationTextBlock:
    group_label = group.qualified_short_id or "This issue"
    return LinkTextBlock(text=group_label, url=absolute_uri(group.get_absolute_url()))


def get_example_resolution_subject() -> list[NotificationTextBlock]:
    return [CodeTextBlock(text="EXAMPLE-1"), PlainTextBlock(text="was resolved by Jane Doe")]


def get_example_resolution_issue_label() -> NotificationTextBlock:
    return LinkTextBlock(text="EXAMPLE-1", url=EXAMPLE_ISSUE_URL)
