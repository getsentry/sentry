from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.activity.base import (
    ActivityNotificationData,
    build_footer,
    build_issue_link,
    create_activity_notification_example,
    get_issue_description,
)
from sentry.notifications.platform.templates.activity.status_change.base import (
    get_resolution_subject,
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
from sentry.utils.dates import format_duration


@template_registry.register(NotificationSource.ACTIVITY_SET_RESOLVED_BY_AGE)
class SetResolvedByAgeActivityTemplate(NotificationTemplate[ActivityNotificationData]):
    category = NotificationCategory.ACTIVITY
    example_data = create_activity_notification_example(
        ActivityType.SET_RESOLVED_BY_AGE,
        activity_data={"age": 168},
    )

    def render(self, data: ActivityNotificationData) -> NotificationRenderedTemplate:
        resolution_text = "was resolved automatically due to inactivity."
        if data.activity_data and "age" in data.activity_data:
            hours = int(data.activity_data["age"])
            # Matches how it's displayed in the UI, if <= 30 hours, display 'hours', otherwise 'days'.
            duration = format_duration(hours * 60, floor_to_largest_unit=hours <= 30)
            resolution_text = f"was resolved automatically after {duration} of inactivity."

        return NotificationRenderedTemplate(
            subject=get_resolution_subject(data),
            body=[
                ParagraphSection(
                    blocks=[
                        build_issue_link(data.issue_short_id, data.issue_url),
                        PlainTextBlock(text=resolution_text),
                    ]
                ),
                *get_issue_description(data=data),
            ],
            footer=build_footer(data=data),
        )
