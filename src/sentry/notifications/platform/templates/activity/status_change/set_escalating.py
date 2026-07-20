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


def get_escalating_explanation(data: ActivityNotificationData) -> str:
    if data.activity_data:
        if forecast := int(data.activity_data.get("forecast", 0)):
            event_word = "event" if forecast == 1 else "events"
            return f"has been flagged as escalating because over {forecast} {event_word} happened in an hour."
        if data.activity_data.get("expired_snooze"):
            return "has been flagged as escalating because your archive condition has expired."
    return "has been flagged as escalating."


@template_registry.register(NotificationSource.ACTIVITY_SET_ESCALATING)
class SetEscalatingActivityTemplate(NotificationTemplate[ActivityNotificationData]):
    category = NotificationCategory.ACTIVITY
    example_data = create_activity_notification_example(ActivityType.SET_ESCALATING)

    def render(self, data: ActivityNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=get_status_change_subject(data),
            body=[
                ParagraphSection(
                    blocks=[
                        build_issue_link(data.issue_short_id, data.issue_url),
                        PlainTextBlock(text=get_escalating_explanation(data)),
                    ]
                ),
                *get_issue_description(data=data),
            ],
            footer=build_footer(data=data),
        )
