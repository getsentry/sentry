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


@template_registry.register(NotificationSource.ACTIVITY_SET_UNRESOLVED)
class SetUnresolvedActivityTemplate(NotificationTemplate[ActivityNotificationData]):
    category = NotificationCategory.ACTIVITY
    example_data = create_activity_notification_example(ActivityType.SET_UNRESOLVED)

    def render(self, data: ActivityNotificationData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=get_status_change_subject(data),
            body=[
                ParagraphSection(
                    blocks=[
                        build_issue_link(data.issue_short_id, data.issue_url),
                        PlainTextBlock(text="has been unresolved."),
                    ]
                ),
                *get_issue_description(data=data),
            ],
            footer=build_footer(data=data),
        )
