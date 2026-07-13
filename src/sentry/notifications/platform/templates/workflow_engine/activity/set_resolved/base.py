from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.notifications.platform.templates.workflow_engine.activity.base import (
    build_example_alert_footer,
)
from sentry.notifications.platform.types import (
    CodeTextBlock,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationTextBlock,
    PlainTextBlock,
)
from sentry.users.services.user.service import user_service


def get_resolution_subject(activity: Activity, group: Group) -> list[NotificationTextBlock]:
    blocks: list[NotificationTextBlock] = []
    if group.qualified_short_id:
        blocks.extend(
            [CodeTextBlock(text=group.qualified_short_id), PlainTextBlock(text="was resolved")]
        )
    else:
        blocks.append(PlainTextBlock(text="A Sentry Issue was resolved"))

    if activity.user_id:
        user = user_service.get_user(user_id=activity.user_id)
        if user:
            blocks.append(PlainTextBlock(text=f"by {user.get_display_name()}"))

    return blocks


def get_example_resolution_subject() -> list[NotificationTextBlock]:
    return [CodeTextBlock(text="EXAMPLE-1"), PlainTextBlock(text="was resolved by Jane Doe")]


def render_resolution_example(body: list[NotificationSection]) -> NotificationRenderedTemplate:
    return NotificationRenderedTemplate(
        subject=get_example_resolution_subject(),
        body=body,
        footer=build_example_alert_footer(),
    )
