from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.activity.base import (
    ActivityNotificationData,
    build_footer,
    build_issue_link,
    create_activity_notification_example,
    get_issue_description,
)
from sentry.notifications.platform.templates.activity.status_change.base import (
    get_status_change_subject,
)
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTemplate,
    ParagraphSection,
    PlainTextBlock,
)
from sentry.types.activity import ActivityType
from sentry.utils.dates import format_duration, parse_timestamp


def get_archive_explanation(data: ActivityNotificationData) -> str:
    """
    Matches getIgnoredMessage from groupActivityItem.tsx.
    """

    if not data.activity_data:
        return "has been archived forever."

    ignore_duration = data.activity_data.get("ignoreDuration")

    if ignore_duration:
        duration = format_duration(int(ignore_duration))
        return f"has been archived for {duration}."

    ignore_count = data.activity_data.get("ignoreCount")
    ignore_window = data.activity_data.get("ignoreWindow")
    if ignore_count and ignore_window:
        window = format_duration(int(ignore_window))
        return f"has been archived until it happens {ignore_count} time(s) in {window}."

    if ignore_count:
        return f"has been archived until it happens {ignore_count} time(s)."

    ignore_user_count = data.activity_data.get("ignoreUserCount")
    ignore_user_window = data.activity_data.get("ignoreUserWindow")
    if ignore_user_count and ignore_user_window:
        window = format_duration(int(ignore_user_window))
        return f"has been archived until it affects {ignore_user_count} user(s) in {window}."

    if ignore_user_count:
        return f"has been archived until it affects {ignore_user_count} user(s)."

    ignore_until = data.activity_data.get("ignoreUntil")
    if ignore_until:
        # TODO(Leander): This should probably be derived from the recipient's user preferences
        # but we'd have to extend the NotificationData type, so we can do that later.
        dt = parse_timestamp(ignore_until)
        formatted = dt.strftime("%b %-d, %Y, %-I:%M %p UTC") if dt else ignore_until
        return f"has been archived until {formatted}."

    ignore_until_escalating = data.activity_data.get("ignoreUntilEscalating")
    if ignore_until_escalating:
        return "has been archived until it escalates."

    return "has been archived forever."


@template_registry.register(NotificationSource.ACTIVITY_SET_IGNORED)
class SetIgnoredActivityTemplate(NotificationTemplate[ActivityNotificationData]):
    category = NotificationCategory.ACTIVITY
    example_data = create_activity_notification_example(ActivityType.SET_IGNORED)

    def render(self, data: ActivityNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=get_status_change_subject(data),
            body=[
                ParagraphSection(
                    blocks=[
                        build_issue_link(data.issue_short_id, data.issue_url),
                        PlainTextBlock(text=get_archive_explanation(data)),
                    ]
                ),
                *get_issue_description(data=data),
            ],
            footer=build_footer(data=data),
        )
